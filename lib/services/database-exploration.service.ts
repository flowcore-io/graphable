/**
 * Database exploration service for admin-only database exploration
 * Provides functionality to list tables, describe table schemas, and sample rows
 */

import { and, eq } from "drizzle-orm"
import { dataSourceSecrets, db } from "@/db"
import { logger } from "./logger.service"
import type { SecretReference } from "./secret-provider.service"
import { getSecretProvider } from "./secret-provider.service"
import { validateSqlQuery } from "./sql-validation.service"
import { getTenantLinkByWorkspace } from "./tenant.service"

/**
 * Table information
 */
export interface TableInfo {
  name: string
  schema?: string
  type?: string
}

/**
 * Column information
 */
export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  default?: unknown
}

/**
 * Table schema information
 */
export interface TableSchema {
  tableName: string
  schema?: string
  columns: ColumnInfo[]
}

/**
 * Get PostgreSQL connection config from secret
 *
 * SECURITY: This function demonstrates the secure pattern:
 * 1. Get secret reference (key) from database: { provider, vaultUrl, secretName, version }
 * 2. Use reference to fetch actual secret from Azure Key Vault (never stored in events or fragments)
 * 3. Parse connection config and return (secret is used in-memory only, never persisted)
 */
async function getConnectionConfig(
  dataSourceId: string,
  workspaceId: string
): Promise<{
  host: string
  port: number
  database: string
  user: string
  password: string
  ssl?: boolean | { rejectUnauthorized?: boolean }
}> {
  // Step 1: Get secret reference (key) from database - this is NOT the actual secret
  const secretRecord = await db
    .select()
    .from(dataSourceSecrets)
    .where(and(eq(dataSourceSecrets.dataSourceId, dataSourceId), eq(dataSourceSecrets.workspaceId, workspaceId)))
    .limit(1)

  if (secretRecord.length === 0) {
    throw new Error("Secret reference not found for data source")
  }

  const secretRef = secretRecord[0].secretRef as unknown as SecretReference

  // Step 2: Use secret reference to fetch actual secret from Azure Key Vault
  // The secret itself is never stored in events, fragments, or database - only the reference
  const secretProvider = getSecretProvider()
  const secretPayload = await secretProvider.getSecret(secretRef)

  // Parse PostgreSQL connection string/JSON
  try {
    // Try parsing as JSON first
    const jsonConfig = JSON.parse(secretPayload)
    return {
      host: jsonConfig.host,
      port: jsonConfig.port || 5432,
      database: jsonConfig.database,
      user: jsonConfig.user,
      password: jsonConfig.password,
      ssl: jsonConfig.ssl,
    }
  } catch {
    // If not JSON, try parsing as connection string
    // Format: postgresql://user:password@host:port/database?sslmode=...
    const url = new URL(secretPayload)
    const sslMode = url.searchParams.get("sslmode") || "prefer"

    // Determine SSL config based on sslmode
    let ssl: boolean | { rejectUnauthorized?: boolean } = false
    if (sslMode === "require" || sslMode === "verify-ca" || sslMode === "verify-full") {
      ssl = { rejectUnauthorized: sslMode === "verify-full" || sslMode === "verify-ca" }
    }

    return {
      host: url.hostname,
      port: parseInt(url.port || "5432", 10),
      database: url.pathname.slice(1), // Remove leading /
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password || ""),
      ssl,
    }
  }
}

/**
 * List tables in a data source (admin-only)
 * Connects to PostgreSQL and queries pg_tables
 */
export async function listTables(
  dataSourceId: string,
  workspaceId: string,
  userId: string,
  accessToken: string
): Promise<TableInfo[]> {
  // Check workspace admin role before allowing exploration
  const isAdmin = await isWorkspaceAdmin(workspaceId, userId, accessToken)
  if (!isAdmin) {
    throw new Error("Forbidden: Database exploration requires workspace admin access")
  }

  const connectionConfig = await getConnectionConfig(dataSourceId, workspaceId)

  // Import pg dynamically
  const { Client } = await import("pg")

  // Use SSL config from connection string, default to requiring SSL for security
  const sslConfig = connectionConfig.ssl !== undefined ? connectionConfig.ssl : { rejectUnauthorized: false }

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
    await client.connect()

    // Query pg_tables for table listing
    // Filter out system schemas (pg_catalog, information_schema)
    const result = await client.query(`
      SELECT schemaname, tablename, tableowner
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename
    `)

    return result.rows.map((row) => ({
      name: row.tablename,
      schema: row.schemaname,
      type: "table",
    }))
  } finally {
    await client.end().catch(() => {
      // Ignore errors during cleanup
    })
  }
}

/**
 * Get table schema (admin-only)
 * Connects to PostgreSQL and queries column information
 */
export async function describeTable(
  dataSourceId: string,
  workspaceId: string,
  tableName: string,
  schemaName: string | undefined,
  userId: string,
  accessToken: string
): Promise<TableSchema> {
  // Check workspace admin role before allowing exploration
  const isAdmin = await isWorkspaceAdmin(workspaceId, userId, accessToken)
  if (!isAdmin) {
    throw new Error("Forbidden: Database exploration requires workspace admin access")
  }

  const connectionConfig = await getConnectionConfig(dataSourceId, workspaceId)

  // Import pg dynamically
  const { Client } = await import("pg")

  // Use SSL config from connection string, default to requiring SSL for security
  const sslConfig = connectionConfig.ssl !== undefined ? connectionConfig.ssl : { rejectUnauthorized: false }

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
    await client.connect()

    // Query pg_attribute for column information
    const schemaFilter = schemaName ? `AND n.nspname = $2` : `AND n.nspname NOT IN ('pg_catalog', 'information_schema')`
    const query = `
      SELECT
        a.attname AS column_name,
        pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
        a.attnotnull AS not_null,
        a.atthasdef AS has_default,
        pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) AS default_value
      FROM pg_catalog.pg_attribute a
      JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
      JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
      LEFT JOIN pg_catalog.pg_attrdef ad ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
      WHERE c.relname = $1
        ${schemaFilter}
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum
    `

    const params = schemaName ? [tableName, schemaName] : [tableName]
    const result = await client.query(query, params)

    return {
      tableName,
      schema: schemaName,
      columns: result.rows.map((row) => ({
        name: row.column_name,
        type: row.data_type,
        nullable: !row.not_null,
        default: row.has_default ? row.default_value : undefined,
      })),
    }
  } finally {
    await client.end().catch(() => {
      // Ignore errors during cleanup
    })
  }
}

/**
 * Sample rows from a table (admin-only)
 * Connects to PostgreSQL and executes SELECT query with LIMIT
 */
export async function sampleRows(
  dataSourceId: string,
  workspaceId: string,
  tableName: string,
  schemaName: string | undefined,
  limit: number,
  userId: string,
  accessToken: string
): Promise<unknown[]> {
  // Check workspace admin role before allowing exploration
  const isAdmin = await isWorkspaceAdmin(workspaceId, userId, accessToken)
  if (!isAdmin) {
    throw new Error("Forbidden: Database exploration requires workspace admin access")
  }

  // Validate limit parameter (max 100 rows per PRD)
  const validatedLimit = Math.min(Math.max(limit, 1), 100)

  const connectionConfig = await getConnectionConfig(dataSourceId, workspaceId)

  // Import pg dynamically
  const { Client } = await import("pg")

  // Use SSL config from connection string, default to requiring SSL for security
  const sslConfig = connectionConfig.ssl !== undefined ? connectionConfig.ssl : { rejectUnauthorized: false }

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
    await client.connect()

    // Build table reference with schema if provided
    const tableRef = schemaName ? `"${schemaName}"."${tableName}"` : `"${tableName}"`

    // Execute SELECT query with LIMIT
    // Use parameterized query for safety
    const result = await client.query(`SELECT * FROM ${tableRef} LIMIT $1`, [validatedLimit])

    return result.rows
  } finally {
    await client.end().catch(() => {
      // Ignore errors during cleanup
    })
  }
}

/**
 * Extract column names from PostgreSQL result with fallback validation
 * When queries are wrapped in subqueries, result.fields may contain duplicate/incorrect names
 * This function validates and falls back to extracting from row keys if needed
 */
function extractColumnNames(result: { fields?: Array<{ name: string }>; rows: unknown[] }): string[] {
  // First, try to extract from result.fields
  const fieldsColumns = result.fields ? result.fields.map((field) => field.name) : []

  // If no fields, return empty array
  if (fieldsColumns.length === 0) {
    return []
  }

  // Validate: check if all column names are unique
  const uniqueColumns = new Set(fieldsColumns)
  const hasDuplicates = uniqueColumns.size !== fieldsColumns.length

  // If we have rows, validate that column names match row keys
  let columnsMatchRowKeys = true
  if (result.rows.length > 0) {
    const firstRow = result.rows[0]
    if (firstRow && typeof firstRow === "object" && firstRow !== null) {
      const rowKeys = Object.keys(firstRow)
      // Check if all field columns exist in row keys and vice versa
      const fieldSet = new Set(fieldsColumns)
      const rowKeySet = new Set(rowKeys)
      columnsMatchRowKeys =
        fieldsColumns.length === rowKeys.length &&
        fieldsColumns.every((col) => rowKeySet.has(col)) &&
        rowKeys.every((key) => fieldSet.has(key))
    }
  }

  // If validation passes (no duplicates and columns match row keys), use fields
  if (!hasDuplicates && columnsMatchRowKeys) {
    return fieldsColumns
  }

  // Validation failed - fall back to extracting from first row's keys
  if (result.rows.length > 0) {
    const firstRow = result.rows[0]
    if (firstRow && typeof firstRow === "object" && firstRow !== null) {
      return Object.keys(firstRow)
    }
  }

  // Fallback: return fields columns even if invalid (better than empty)
  return fieldsColumns
}

/**
 * Execute a SQL query with pagination
 * Returns paginated results with total count
 * @param requireAdmin - If true, requires workspace admin access. If false, only requires workspace access (for graph execution)
 */
export async function executeQuery(
  dataSourceId: string,
  workspaceId: string,
  query: string,
  page: number,
  pageSize: number,
  userId: string,
  accessToken: string,
  preBoundParameters?: unknown[],
  requireAdmin: boolean = true
): Promise<{
  rows: unknown[]
  columns: string[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}> {
  // Check workspace admin role before allowing exploration (only if requireAdmin is true)
  // Graph execution bypasses admin check - authorization is handled at API route level
  if (requireAdmin) {
    const isAdmin = await isWorkspaceAdmin(workspaceId, userId, accessToken)
    if (!isAdmin) {
      throw new Error("Forbidden: Database exploration requires workspace admin access")
    }
  }

  // Defensive SQL validation (prevents SQL injection even if called directly)
  const validation = validateSqlQuery(query)
  if (!validation.valid) {
    throw new Error(`Invalid SQL query: ${validation.error}`)
  }

  // Validate page and pageSize
  const validatedPage = Math.max(1, page)
  const validatedPageSize = Math.min(Math.max(pageSize, 1), 1000) // Max 1000 rows per page

  const connectionConfig = await getConnectionConfig(dataSourceId, workspaceId)

  // Import pg dynamically
  const { Client } = await import("pg")

  // Configure SSL - default to requiring SSL for security
  // This matches the pattern used in testConnectionString
  const sslConfig = { rejectUnauthorized: false }

  // Create PostgreSQL client
  const client = new Client({
    host: connectionConfig.host,
    port: connectionConfig.port,
    database: connectionConfig.database,
    user: connectionConfig.user,
    password: connectionConfig.password,
    ssl: connectionConfig.ssl !== undefined ? connectionConfig.ssl : sslConfig,
    connectionTimeoutMillis: 30000, // 30 second timeout for queries
  })

  try {
    await client.connect()

    // Check if query is a SELECT query (basic check)
    const trimmedQuery = query.trim()
    const trimmedUpper = trimmedQuery.toUpperCase()
    const isSelectQuery = trimmedUpper.startsWith("SELECT")

    // First, get total count by wrapping query in a COUNT subquery
    // This only works for SELECT queries - for other queries, we'll skip count
    let totalCount = 0
    let canCount = false

    if (isSelectQuery) {
      try {
        // Try to get count by wrapping the query
        const countQuery = `SELECT COUNT(*) as total FROM (${trimmedQuery}) as subquery`
        const countResult = await client.query(countQuery)
        totalCount = parseInt(countResult.rows[0]?.total || "0", 10)
        canCount = true
      } catch {
        // If count query fails, we'll just return results without total count
        canCount = false
      }
    }

    // Execute the actual query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any
    const offset = (validatedPage - 1) * validatedPageSize

    if (isSelectQuery) {
      // For SELECT queries, add pagination
      // Check if query already has LIMIT/OFFSET - if so, we need to wrap it
      const hasLimit = /\bLIMIT\s+\d+/i.test(trimmedQuery)
      const hasOffset = /\bOFFSET\s+\d+/i.test(trimmedQuery)

      if (hasLimit || hasOffset) {
        // Query already has LIMIT/OFFSET, wrap it in a subquery
        // If we have pre-bound parameters, we need to account for them
        if (preBoundParameters && preBoundParameters.length > 0) {
          const paramIndex = preBoundParameters.length + 1
          const wrappedQuery = `SELECT * FROM (${trimmedQuery}) as subquery LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
          result = await client.query(wrappedQuery, [...preBoundParameters, validatedPageSize, offset])
        } else {
          const wrappedQuery = `SELECT * FROM (${trimmedQuery}) as subquery LIMIT $1 OFFSET $2`
          result = await client.query(wrappedQuery, [validatedPageSize, offset])
        }
      } else {
        // Add LIMIT and OFFSET directly
        // If we have pre-bound parameters, adjust the parameter indices
        if (preBoundParameters && preBoundParameters.length > 0) {
          const paramIndex = preBoundParameters.length + 1
          const paginatedQuery = `${trimmedQuery} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
          result = await client.query(paginatedQuery, [...preBoundParameters, validatedPageSize, offset])
        } else {
          const paginatedQuery = `${trimmedQuery} LIMIT $1 OFFSET $2`
          result = await client.query(paginatedQuery, [validatedPageSize, offset])
        }
      }
    } else {
      // For non-SELECT queries (INSERT, UPDATE, DELETE, etc.), execute without pagination
      if (preBoundParameters && preBoundParameters.length > 0) {
        result = await client.query(trimmedQuery, preBoundParameters)
      } else {
        result = await client.query(trimmedQuery)
      }
      // For non-SELECT queries, set totalCount to affected rows
      totalCount = result.rowCount || 0
      canCount = true
    }

    // Extract column names from result with fallback validation (only for SELECT queries)
    const columns = isSelectQuery ? extractColumnNames(result) : []

    // If we couldn't get count for SELECT queries, estimate it (not accurate but better than nothing)
    if (!canCount && isSelectQuery) {
      totalCount =
        result.rows.length < validatedPageSize ? result.rows.length + offset : result.rows.length + offset + 1
    }

    const totalPages = totalCount > 0 ? Math.ceil(totalCount / validatedPageSize) : 1

    return {
      rows: result.rows,
      columns,
      totalCount,
      page: validatedPage,
      pageSize: validatedPageSize,
      totalPages,
    }
  } finally {
    await client.end().catch(() => {
      // Ignore errors during cleanup
    })
  }
}

/**
 * Check if user is workspace admin
 * Currently checks if user is the workspace owner (user who linked the workspace)
 * TODO: When Usable API provides workspace role endpoints, update this to check actual roles
 */
export async function isWorkspaceAdmin(workspaceId: string, userId: string, _accessToken: string): Promise<boolean> {
  try {
    // Get tenant link for workspace to find the owner
    const tenantLink = await getTenantLinkByWorkspace(workspaceId)

    // User is admin if they are the workspace owner (linked the workspace)
    return tenantLink?.usableUserId === userId
  } catch (error) {
    logger.error("Error checking workspace admin status", {
      workspaceId,
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    })
    // Fail closed - return false on error
    return false
  }
}
