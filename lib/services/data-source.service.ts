import { dataSourceSecrets, db } from "@/db"
import type { SessionPathwayBuilder } from "@flowcore/pathways"
import { randomUUID } from "crypto"
import { and, eq } from "drizzle-orm"
import { ulid } from "ulid"
import { z } from "zod"
import * as datasourceContract from "../pathways/contracts/datasource.0"
import type { SecretReference } from "./secret-provider.service"
import { getSecretProvider } from "./secret-provider.service"
import { usableApi } from "./usable-api.service"

const GRAPHABLE_VERSION = "0.2.0"
const GRAPHABLE_APP_TAG = "app:graphable"

/**
 * Zod schema for data source fragment content (stored in Usable fragment.content)
 * NO secret references - those are stored in control plane database
 *
 * ARCHITECTURAL NOTE:
 * - All configuration data MUST be in the JSON content (fragment.content)
 * - fragment.title, fragment.summary, and fragment frontmatter are for Usable convenience and AI search
 * - These metadata fields should be synced from the JSON content for consistency
 * - The JSON content is the source of truth for all configuration
 * - Secret references are stored in control plane database (dataSourceSecrets table), NOT in fragments
 */
export const dataSourceFragmentDataSchema = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().min(1, "Name is required"), // Name is stored in JSON content (source of truth)
  description: z.string().optional(), // Description is stored in JSON content (source of truth)
  databaseType: z.enum(["postgresql"]).default("postgresql"), // PostgreSQL for MVP
  connectionParameters: z
    .object({
      schema: z.string().optional(),
      ssl: z
        .object({
          mode: z.enum(["prefer", "require", "disable"]).optional(),
          rejectUnauthorized: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

/**
 * Data source fragment structure (stored in Usable)
 * Fragment ID is used as the data source ID (no separate UUID)
 *
 * ARCHITECTURAL NOTE:
 * - All configuration data is in the JSON content (fragment.content)
 * - fragment.title is synced from content.name for Usable search convenience
 * - The JSON content is the source of truth
 * - Secret references are stored separately in control plane database
 */
export type DataSourceFragmentData = z.infer<typeof dataSourceFragmentDataSchema>

/**
 * Zod schema for creating a data source
 * Name is required and stored in JSON content (source of truth)
 */
export const createDataSourceInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  databaseType: z.enum(["postgresql"]).default("postgresql"),
  connectionParameters: z
    .object({
      schema: z.string().optional(),
      ssl: z
        .object({
          mode: z.enum(["prefer", "require", "disable"]).optional(),
          rejectUnauthorized: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  // Secret payload (will be stored in secret provider, reference stored in DB)
  secretPayload: z.string().min(1, "Secret payload is required"), // PostgreSQL connection string or JSON
  secretName: z.string().min(1, "Secret name is required"), // Name for secret in secret provider
})

/**
 * Data source creation input
 * Name is stored in JSON content (source of truth), synced to fragment.title for search
 */
export type CreateDataSourceInput = z.infer<typeof createDataSourceInputSchema>

/**
 * Zod schema for updating a data source
 */
export const updateDataSourceInputSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  connectionParameters: z
    .object({
      schema: z.string().optional(),
      ssl: z
        .object({
          mode: z.enum(["prefer", "require", "disable"]).optional(),
          rejectUnauthorized: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  // Optional secret update (only payload, name cannot be changed)
  secretPayload: z.string().min(1).optional(),
})

/**
 * Data source update input
 */
export type UpdateDataSourceInput = z.infer<typeof updateDataSourceInputSchema>

/**
 * Create a data source fragment and emit datasource.created.0 event
 * Mutation function - requires SessionPathway
 */
export async function createDataSource(
  sessionPathway: SessionPathwayBuilder<any>,
  workspaceId: string,
  dataSourceData: CreateDataSourceInput,
  accessToken: string
): Promise<{ dataSourceId: string; status: "processing" }> {
  // Get fragment type ID for "data-sources"
  const fragmentTypeId = await usableApi.getFragmentTypeIdByName(workspaceId, "data-sources", accessToken)
  if (!fragmentTypeId) {
    throw new Error("Fragment type 'data-sources' not found. Please ensure workspace is bootstrapped.")
  }

  // Generate sortable UUID for the fragment content
  const fragmentUlid = ulid()

  // Validate input data
  const validatedData = createDataSourceInputSchema.parse(dataSourceData)

  // Store secret in secret provider
  const secretProvider = getSecretProvider()
  const secretRef = await secretProvider.putSecret(workspaceId, validatedData.secretName, validatedData.secretPayload)

  // Create fragment content with ULID, name, description, databaseType, connectionParameters
  // Name and description are stored in JSON content (source of truth)
  const now = new Date().toISOString()
  const fragmentContent: DataSourceFragmentData = {
    id: fragmentUlid,
    name: validatedData.name, // Name is in JSON content (source of truth)
    description: validatedData.description, // Description is in JSON content (source of truth)
    databaseType: validatedData.databaseType,
    connectionParameters: validatedData.connectionParameters,
    createdAt: now,
    updatedAt: now,
  }

  // Validate the content structure
  const validatedContent = dataSourceFragmentDataSchema.parse(fragmentContent)

  // Create fragment in Usable
  // Sync name to fragment.title for Usable search convenience (content.name is source of truth)
  const fragment = await usableApi.createFragment(
    workspaceId,
    {
      workspaceId,
      title: validatedContent.name, // Sync from content for search
      content: JSON.stringify(validatedContent, null, 2),
      summary: validatedContent.description || validatedContent.name,
      tags: [GRAPHABLE_APP_TAG, "type:data-source", `version:${GRAPHABLE_VERSION}`],
      fragmentTypeId,
      repository: "graphable",
    },
    accessToken
  )

  if (!fragment || !fragment.id) {
    throw new Error("Failed to create data source fragment: fragment creation returned invalid result")
  }

  // Use fragment ID as data source ID (no separate UUID)
  const dataSourceId = fragment.id

  // Store secret reference in control plane database
  // SECURITY: Only store the reference/key (vaultUrl, secretName, version), NOT the actual secret
  // The secret itself remains in Azure Key Vault and is fetched on-demand when needed
  await db.insert(dataSourceSecrets).values({
    dataSourceId,
    workspaceId,
    secretRef: secretRef as unknown as Record<string, unknown>, // JSONB expects Record
  })

  // Emit datasource.created.0 event via Session Pathways
  // SECURITY: Event does NOT contain sensitive data - only IDs and metadata
  // Secret reference is stored separately in database, not in the event
  await (sessionPathway as any).write(
    `${datasourceContract.FlowcoreDataSource.flowType}/${datasourceContract.FlowcoreDataSource.eventType.created}`,
    {
      data: {
        dataSourceId, // Fragment ID
        fragmentId: dataSourceId, // Same as dataSourceId
        workspaceId,
        occurredAt: new Date().toISOString(),
        initiatedBy: (sessionPathway as any).getUserResolver
          ? (await (sessionPathway as any).getUserResolver()).entityId
          : "system",
        requestId: randomUUID(),
      },
    }
  )

  return { dataSourceId, status: "processing" }
}

/**
 * Update a data source fragment and emit datasource.updated.0 event
 * Mutation function - requires SessionPathway
 */
export async function updateDataSource(
  sessionPathway: SessionPathwayBuilder<any>,
  workspaceId: string,
  dataSourceId: string, // Fragment ID
  dataSourceData: UpdateDataSourceInput,
  accessToken: string
): Promise<{ dataSourceId: string; status: "processing" }> {
  // Get fragment from Usable (dataSourceId is the fragment ID)
  const fragment = await usableApi.getFragment(workspaceId, dataSourceId, accessToken)
  if (!fragment) {
    throw new Error(`Data source not found: ${dataSourceId}`)
  }

  // Validate and parse existing fragment content
  let existingData: DataSourceFragmentData
  try {
    const parsed = JSON.parse(fragment.content || "{}")
    existingData = dataSourceFragmentDataSchema.parse(parsed)
  } catch (error) {
    console.error("Failed to parse existing data source fragment content:", error)
    throw new Error(`Invalid data source fragment content: ${error instanceof Error ? error.message : "Unknown error"}`)
  }

  // Validate update input
  const validatedUpdate = updateDataSourceInputSchema.parse(dataSourceData)

  // Update secret if provided (only payload, name cannot be changed)
  let secretRef: SecretReference | undefined
  if (validatedUpdate.secretPayload) {
    const secretProvider = getSecretProvider()
    // Get existing secret reference
    const existingSecret = await db
      .select()
      .from(dataSourceSecrets)
      .where(eq(dataSourceSecrets.dataSourceId, dataSourceId))
      .limit(1)

    if (existingSecret.length > 0) {
      // Rotate existing secret (keeps same name, updates value)
      const existingRef = existingSecret[0].secretRef as unknown as SecretReference
      secretRef = await secretProvider.rotateSecret(existingRef, validatedUpdate.secretPayload)

      // Update secret reference in database
      await db
        .update(dataSourceSecrets)
        .set({
          secretRef: secretRef as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(dataSourceSecrets.dataSourceId, dataSourceId))
    } else {
      // Cannot create new secret without name - this should not happen in edit flow
      throw new Error("Cannot update secret: secret reference not found. Secret name is required for new secrets.")
    }
  }

  // Merge updates, preserving the ID
  // Name and description are stored in JSON content (source of truth)
  const updatedData: DataSourceFragmentData = {
    id: existingData.id, // Preserve the existing ID
    name: validatedUpdate.name !== undefined ? validatedUpdate.name : existingData.name, // Name from content
    description: validatedUpdate.description !== undefined ? validatedUpdate.description : existingData.description, // Description from content
    databaseType: existingData.databaseType, // Database type cannot be changed
    connectionParameters:
      validatedUpdate.connectionParameters !== undefined
        ? validatedUpdate.connectionParameters
        : existingData.connectionParameters,
    createdAt: existingData.createdAt, // Preserve creation time
    updatedAt: new Date().toISOString(), // Update timestamp
  }

  // Validate the merged data
  const validatedUpdatedData = dataSourceFragmentDataSchema.parse(updatedData)

  // Update fragment in Usable
  // Sync name to fragment.title for Usable search convenience (content.name is source of truth)
  await usableApi.updateFragment(
    workspaceId,
    dataSourceId, // Fragment ID
    {
      title: validatedUpdatedData.name, // Sync from content for search
      content: JSON.stringify(validatedUpdatedData, null, 2),
      summary: validatedUpdatedData.description || validatedUpdatedData.name,
    },
    accessToken
  )

  // Emit datasource.updated.0 event via Session Pathways
  // SECURITY: Event does NOT contain sensitive data - only IDs and metadata
  // Secret reference is stored separately in database, not in the event
  await (sessionPathway as any).write(
    `${datasourceContract.FlowcoreDataSource.flowType}/${datasourceContract.FlowcoreDataSource.eventType.updated}`,
    {
      data: {
        dataSourceId, // Fragment ID
        fragmentId: dataSourceId, // Same as dataSourceId
        workspaceId,
        occurredAt: new Date().toISOString(),
        initiatedBy: (sessionPathway as any).getUserResolver
          ? (await (sessionPathway as any).getUserResolver()).entityId
          : "system",
        requestId: randomUUID(),
      },
    }
  )

  return { dataSourceId, status: "processing" }
}

/**
 * Delete a data source fragment and emit datasource.deleted.0 event
 * Mutation function - requires SessionPathway
 */
export async function deleteDataSource(
  sessionPathway: SessionPathwayBuilder<any>,
  workspaceId: string,
  dataSourceId: string, // Fragment ID
  accessToken: string
): Promise<{ dataSourceId: string; status: "processing" }> {
  // Verify data source exists by fetching fragment
  const fragment = await usableApi.getFragment(workspaceId, dataSourceId, accessToken)
  if (!fragment) {
    throw new Error(`Data source not found: ${dataSourceId}`)
  }

  // Get secret reference from database
  const secretRecord = await db
    .select()
    .from(dataSourceSecrets)
    .where(eq(dataSourceSecrets.dataSourceId, dataSourceId))
    .limit(1)

  // Delete secret from secret provider if exists
  if (secretRecord.length > 0) {
    try {
      const secretProvider = getSecretProvider()
      const secretRef = secretRecord[0].secretRef as unknown as SecretReference
      await secretProvider.deleteSecret(secretRef)
    } catch (error) {
      console.error(`Failed to delete secret for data source ${dataSourceId}:`, error)
      // Continue with fragment deletion even if secret deletion fails
    }

    // Delete secret reference from database
    await db.delete(dataSourceSecrets).where(eq(dataSourceSecrets.dataSourceId, dataSourceId))
  }

  // Delete fragment from Usable
  await usableApi.deleteFragment(workspaceId, dataSourceId, accessToken)

  // Emit datasource.deleted.0 event via Session Pathways
  // SECURITY: Event does NOT contain sensitive data - only IDs and metadata
  // Secret reference is stored separately in database, not in the event
  await (sessionPathway as any).write(
    `${datasourceContract.FlowcoreDataSource.flowType}/${datasourceContract.FlowcoreDataSource.eventType.deleted}`,
    {
      data: {
        dataSourceId, // Fragment ID
        fragmentId: dataSourceId, // Same as dataSourceId
        workspaceId,
        occurredAt: new Date().toISOString(),
        initiatedBy: (sessionPathway as any).getUserResolver
          ? (await (sessionPathway as any).getUserResolver()).entityId
          : "system",
        requestId: randomUUID(),
      },
    }
  )

  return { dataSourceId, status: "processing" }
}

/**
 * Masked connection details (for display - password is hidden)
 */
export interface MaskedConnectionDetails {
  host: string
  port: number
  database: string
  user: string
  sslMode?: string
  connectionString: string // Masked connection string (password hidden)
}

/**
 * Data source with metadata (for display)
 */
export interface DataSourceWithMetadata extends DataSourceFragmentData {
  name: string
  summary?: string
  fragmentId: string
  hasSecret: boolean // Whether secret reference exists in database
  secretName?: string // Secret name (read-only, extracted from secret reference)
  connectionDetails?: ConnectionDetails // Connection details if secret exists (includes actual password for editing)
}

/**
 * Get connection details from secret (for editing purposes)
 * Includes actual password so user can edit and test
 */
export async function getConnectionDetails(
  workspaceId: string,
  dataSourceId: string
): Promise<ConnectionDetails | null> {
  // Get secret reference from database
  const secretRecord = await db
    .select()
    .from(dataSourceSecrets)
    .where(and(eq(dataSourceSecrets.dataSourceId, dataSourceId), eq(dataSourceSecrets.workspaceId, workspaceId)))
    .limit(1)

  if (secretRecord.length === 0) {
    return null
  }

  const secretRef = secretRecord[0].secretRef as unknown as SecretReference

  // Fetch actual secret from Azure Key Vault
  const secretProvider = getSecretProvider()
  let secretPayload: string
  try {
    secretPayload = await secretProvider.getSecret(secretRef)
  } catch (error) {
    console.error("Failed to retrieve secret for masked display:", error)
    return null
  }

  // Parse connection string or JSON
  let connectionConfig: {
    host: string
    port: number
    database: string
    user: string
    password: string
    ssl?: boolean | { rejectUnauthorized?: boolean }
  }

  let sslMode: string | undefined

  try {
    // Try parsing as JSON first
    const jsonConfig = JSON.parse(secretPayload)
    if (!jsonConfig.host || !jsonConfig.database || !jsonConfig.user || !jsonConfig.password) {
      throw new Error("Invalid JSON connection config - missing required fields")
    }
    connectionConfig = {
      host: jsonConfig.host,
      port: jsonConfig.port || 5432,
      database: jsonConfig.database,
      user: jsonConfig.user,
      password: jsonConfig.password,
    }
    // Handle SSL configuration in JSON format
    if (jsonConfig.ssl !== undefined) {
      if (jsonConfig.ssl === false) {
        sslMode = "disable"
      } else if (typeof jsonConfig.ssl === "object") {
        if (jsonConfig.ssl.rejectUnauthorized === false) {
          sslMode = "require"
        } else {
          sslMode = "verify-full"
        }
      } else {
        sslMode = "require"
      }
    } else {
      sslMode = "prefer" // Default for JSON if not specified
    }
  } catch (jsonError) {
    // If JSON parsing fails or is invalid, try URL parsing
    // If not JSON, try parsing as connection string URL
    try {
      const url = new URL(secretPayload)
      if (!url.hostname || !url.pathname || !url.username) {
        throw new Error("Invalid URL connection string - missing required fields")
      }
      connectionConfig = {
        host: url.hostname,
        port: parseInt(url.port || "5432", 10),
        database: url.pathname.slice(1) || "", // Remove leading /
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password || ""),
      }
      // Extract sslmode from query params
      sslMode = url.searchParams.get("sslmode") || "prefer"
    } catch (urlError) {
      console.error("Failed to parse connection string:", { jsonError, urlError })
      return null
    }
  }

  // Create actual connection string (not masked - needed for editing/testing)
  const actualConnectionString = `postgresql://${encodeURIComponent(connectionConfig.user)}:${encodeURIComponent(connectionConfig.password)}@${connectionConfig.host}:${connectionConfig.port}/${encodeURIComponent(connectionConfig.database)}${sslMode && sslMode !== "prefer" ? `?sslmode=${sslMode}` : ""}`

  return {
    host: connectionConfig.host,
    port: connectionConfig.port,
    database: connectionConfig.database,
    user: connectionConfig.user,
    password: connectionConfig.password, // Actual password (needed for editing)
    sslMode: sslMode || "prefer",
    connectionString: actualConnectionString, // Actual connection string (not masked)
  }
}

/**
 * Get data source fragment from Usable API and load secret reference
 * Read function - no SessionPathway needed
 */
export async function getDataSource(
  workspaceId: string,
  dataSourceId: string, // Fragment ID
  accessToken: string,
  includeConnectionDetails = false // Whether to include masked connection details
): Promise<DataSourceWithMetadata | null> {
  // Get fragment directly from Usable (dataSourceId is the fragment ID)
  const fragment = await usableApi.getFragment(workspaceId, dataSourceId, accessToken)
  if (!fragment) {
    return null
  }

  // Parse and validate fragment content
  // Name comes from JSON content (source of truth), not fragment.title
  // Strict validation - no fallbacks
  if (!fragment.content || fragment.content.trim() === "") {
    throw new Error(
      `Data source fragment ${dataSourceId} has empty content. This should not happen - data source may not have been created correctly.`
    )
  }

  const parsed = JSON.parse(fragment.content)
  const parsedData = dataSourceFragmentDataSchema.parse(parsed)

  // Check if secret reference exists in database
  const secretRecord = await db
    .select()
    .from(dataSourceSecrets)
    .where(eq(dataSourceSecrets.dataSourceId, dataSourceId))
    .limit(1)

  // Extract secret name from secret reference (read-only, for display)
  let secretName: string | undefined
  if (secretRecord.length > 0) {
    const secretRef = secretRecord[0].secretRef as unknown as SecretReference
    // Secret name in vault is stored as {workspaceId}-{name}, extract original name
    if (secretRef.secretName.startsWith(`${workspaceId}-`)) {
      secretName = secretRef.secretName.slice(workspaceId.length + 1)
    } else {
      // Fallback: use full secret name if format doesn't match
      secretName = secretRef.secretName
    }
  }

  // Get connection details if requested and secret exists
  let connectionDetails: ConnectionDetails | undefined
  if (includeConnectionDetails && secretRecord.length > 0) {
    connectionDetails = (await getConnectionDetails(workspaceId, dataSourceId)) || undefined
  }

  // Name comes from JSON content (source of truth)
  // fragment.title is just for search convenience and may be out of sync
  return {
    ...parsedData,
    summary: fragment.summary,
    fragmentId: fragment.id,
    hasSecret: secretRecord.length > 0,
    secretName,
    connectionDetails,
  }
}

/**
 * List data sources for a workspace
 * Read function - no SessionPathway needed
 */
export async function listDataSources(
  workspaceId: string,
  accessToken: string
): Promise<Array<{ id: string; fragmentId: string; name: string; databaseType: string; hasSecret: boolean }>> {
  // Get fragment type ID for "data-sources" to ensure proper filtering
  const fragmentTypeId = await usableApi.getFragmentTypeIdByName(workspaceId, "data-sources", accessToken)

  // If fragment type doesn't exist, return empty array (workspace not bootstrapped)
  if (!fragmentTypeId) {
    console.warn(`Fragment type 'data-sources' not found for workspace ${workspaceId}`)
    return []
  }

  // List fragments by type
  const fragments = await usableApi.listFragments(
    workspaceId,
    {
      fragmentTypeId,
      tags: [GRAPHABLE_APP_TAG, "type:data-source"],
    },
    accessToken
  )

  // Get all secret references for this workspace
  const secretRecords = await db.select().from(dataSourceSecrets).where(eq(dataSourceSecrets.workspaceId, workspaceId))

  const secretMap = new Map(secretRecords.map((r) => [r.dataSourceId, true]))

  // Parse and return data sources
  // Name comes from JSON content (source of truth), not fragment.title
  return fragments
    .map((fragment) => {
      if (!fragment.content || fragment.content.trim() === "") {
        console.warn(`Fragment ${fragment.id} has empty content, skipping`)
        return null
      }

      try {
        const parsed = JSON.parse(fragment.content)
        const parsedData = dataSourceFragmentDataSchema.parse(parsed)

        return {
          id: parsedData.id,
          fragmentId: fragment.id,
          name: parsedData.name, // From JSON content (source of truth)
          databaseType: parsedData.databaseType,
          hasSecret: secretMap.has(fragment.id),
        }
      } catch (error) {
        console.error(`Failed to parse fragment ${fragment.id}:`, error)
        return null
      }
    })
    .filter((ds): ds is NonNullable<typeof ds> => ds !== null)
}

/**
 * Test PostgreSQL connection directly from a connection string
 * Does NOT store the secret - just tests the connection
 *
 * SECURITY: Connection string is used in-memory only, never persisted
 */
export async function testConnectionString(connectionString: string): Promise<{ success: boolean; error?: string }> {
  // Parse PostgreSQL connection string/JSON
  let connectionConfig: {
    host: string
    port: number
    database: string
    user: string
    password: string
    ssl?: boolean | { rejectUnauthorized?: boolean }
  }

  let sslConfig: boolean | { rejectUnauthorized?: boolean } = false

  try {
    // Try parsing as JSON first
    connectionConfig = JSON.parse(connectionString)
    // If JSON has ssl config, use it directly
    if (connectionConfig.ssl !== undefined) {
      sslConfig = connectionConfig.ssl
    }
  } catch {
    // If not JSON, try parsing as connection string
    // Format: postgresql://user:password@host:port/database?sslmode=require
    const url = new URL(connectionString)
    connectionConfig = {
      host: url.hostname,
      port: parseInt(url.port || "5432", 10),
      database: url.pathname.slice(1), // Remove leading /
      user: url.username,
      password: url.password,
    }
    // Parse sslmode parameter from URL
    const sslMode = url.searchParams.get("sslmode") || "prefer"
    switch (sslMode) {
      case "disable":
        sslConfig = false
        break
      case "allow":
      case "prefer":
        // Try SSL but don't require it - use false to let pg negotiate
        sslConfig = false
        break
      case "require":
        // Require SSL but don't verify certificate
        sslConfig = { rejectUnauthorized: false }
        break
      case "verify-ca":
      case "verify-full":
        // Require SSL and verify certificate (verify-full also checks hostname)
        sslConfig = { rejectUnauthorized: true }
        break
      default:
        // Default to SSL for security
        sslConfig = { rejectUnauthorized: false }
    }
  }

  // Import pg dynamically to avoid loading it if not needed
  const { Client } = await import("pg")

  // Create PostgreSQL client
  const client = new Client({
    host: connectionConfig.host,
    port: connectionConfig.port,
    database: connectionConfig.database,
    user: connectionConfig.user,
    password: connectionConfig.password,
    ssl: sslConfig,
    connectionTimeoutMillis: 5000, // 5 second timeout
  })

  try {
    // Attempt connection
    await client.connect()

    // Test with simple query
    await client.query("SELECT 1")

    // Connection successful
    return { success: true }
  } catch (error) {
    // Connection failed
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown connection error",
    }
  } finally {
    // Always close connection
    await client.end().catch(() => {
      // Ignore errors during cleanup
    })
  }
}

/**
 * Test data source connection
 * Retrieves secret reference from database, then fetches actual secret from Azure Key Vault,
 * then tests PostgreSQL connection
 *
 * SECURITY: This function demonstrates the secure pattern:
 * 1. Get secret reference (key) from database: { provider, vaultUrl, secretName, version }
 * 2. Use reference to fetch actual secret from Azure Key Vault (never stored in events or fragments)
 * 3. Use secret only for connection testing, then discard
 */
export async function testDataSourceConnection(
  workspaceId: string,
  dataSourceId: string // Fragment ID
): Promise<{ success: boolean; error?: string }> {
  // Step 1: Get secret reference (key) from database - this is NOT the actual secret
  const secretRecord = await db
    .select()
    .from(dataSourceSecrets)
    .where(and(eq(dataSourceSecrets.dataSourceId, dataSourceId), eq(dataSourceSecrets.workspaceId, workspaceId)))
    .limit(1)

  if (secretRecord.length === 0) {
    return { success: false, error: "Secret reference not found for data source" }
  }

  const secretRef = secretRecord[0].secretRef as unknown as SecretReference

  // Step 2: Use secret reference to fetch actual secret from Azure Key Vault
  // The secret itself is never stored in events, fragments, or database - only the reference
  const secretProvider = getSecretProvider()
  let secretPayload: string
  try {
    secretPayload = await secretProvider.getSecret(secretRef)
  } catch (error) {
    return {
      success: false,
      error: `Failed to retrieve secret: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }

  // Parse PostgreSQL connection string/JSON
  let connectionConfig: {
    host: string
    port: number
    database: string
    user: string
    password: string
    ssl?: boolean | { rejectUnauthorized?: boolean }
  }

  try {
    // Try parsing as JSON first
    connectionConfig = JSON.parse(secretPayload)
  } catch {
    // If not JSON, try parsing as connection string
    // Format: postgresql://user:password@host:port/database
    const url = new URL(secretPayload)
    connectionConfig = {
      host: url.hostname,
      port: parseInt(url.port || "5432", 10),
      database: url.pathname.slice(1), // Remove leading /
      user: url.username,
      password: url.password,
    }
  }

  // Import pg dynamically to avoid loading it if not needed
  const { Client } = await import("pg")

  // Configure SSL - always use SSL as many PostgreSQL servers require it
  // Use rejectUnauthorized: false to allow self-signed certificates
  const sslConfig = { rejectUnauthorized: false }

  // Create PostgreSQL client
  const client = new Client({
    host: connectionConfig.host,
    port: connectionConfig.port,
    database: connectionConfig.database,
    user: connectionConfig.user,
    password: connectionConfig.password,
    ssl: sslConfig,
    connectionTimeoutMillis: 5000, // 5 second timeout
  })

  try {
    // Attempt connection
    await client.connect()

    // Test with simple query
    await client.query("SELECT 1")

    // Connection successful
    return { success: true }
  } catch (error) {
    // Connection failed
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown connection error",
    }
  } finally {
    // Always close connection
    await client.end().catch(() => {
      // Ignore errors during cleanup
    })
  }
}
