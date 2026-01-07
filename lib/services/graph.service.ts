import { randomUUID } from "node:crypto"
import type { SessionPathwayBuilder } from "@flowcore/pathways"
import { ulid } from "ulid"
import { z } from "zod"
import * as graphContract from "../pathways/contracts/graph.0"
import { validateSqlQuery } from "./sql-validation.service"
import { usableApi } from "./usable-api.service"

const GRAPHABLE_VERSION = "0.2.0"
const GRAPHABLE_APP_TAG = "app:graphable"

/**
 * Zod schema for parameter definition
 */
const parameterDefinitionSchema = z.object({
  name: z.string().min(1, "Parameter name is required"),
  type: z.enum(["string", "number", "boolean", "date", "timestamp", "enum", "string[]", "number[]"]),
  required: z.boolean(),
  default: z.unknown().optional(),
  enumValues: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  pattern: z.string().optional(),
})

/**
 * Parameter definition for graphs
 */
export type ParameterDefinition = z.infer<typeof parameterDefinitionSchema>

/**
 * Query definition schema (SQL query)
 */
const queryDefinitionSchema = z
  .object({
    refId: z.string().regex(/^[A-Z]$/, "refId must be a single uppercase letter (A-Z)"),
    dialect: z.literal("sql"),
    text: z.string().min(1, "Query text is required"),
    dataSourceRef: z.string().min(1, "Data source reference is required"),
    parameters: z.array(parameterDefinitionSchema),
    name: z.string().optional(), // Custom display name for the query
    hidden: z.boolean().optional().default(false), // Hide from visualization but still execute
  })
  .refine(
    (data) => {
      // Validate SQL query for security (prevents SQL injection)
      const validation = validateSqlQuery(data.text)
      return validation.valid
    },
    (data) => {
      // Return custom error message from validation
      const validation = validateSqlQuery(data.text)
      return {
        message: validation.error || "Invalid SQL query",
        path: ["text"],
      }
    }
  )

/**
 * Expression definition schema (math operations on queries)
 */
const expressionDefinitionSchema = z
  .object({
    refId: z.string().regex(/^[A-Z]$/, "refId must be a single uppercase letter (A-Z)"),
    operation: z.enum(["math", "reduce", "resample"]),
    expression: z.string().min(1, "Expression is required"), // e.g., "$A + $B", "$A * 2"
    name: z.string().optional(), // Custom display name for the expression
    hidden: z.boolean().optional().default(false), // Hide from visualization but still execute
  })
  .refine(
    (data) => {
      if (data.operation !== "math") {
        return true // Only validate math expressions
      }
      const expr = data.expression.trim()
      // Must contain at least one query reference ($A, $B, etc.)
      if (!/\$[A-Z]/.test(expr)) {
        return false
      }
      // Must not contain dangerous patterns that could lead to code injection
      // Block: function calls, object access, eval, new Function, etc.
      const dangerousPatterns = [
        /alert\s*\(/i,
        /eval\s*\(/i,
        /function\s*\(/i,
        /new\s+Function/i,
        /\.\s*[a-zA-Z_$]\s*\(/i, // Method calls like .toString()
        /\[.*\]/i, // Array access
        /window|document|global|process/i, // Global objects
        /require\s*\(/i,
        /import\s+/i,
        /export\s+/i,
      ]
      for (const pattern of dangerousPatterns) {
        if (pattern.test(expr)) {
          return false
        }
      }
      // Allow only: numbers, operators, parentheses, whitespace, and $A-$Z references
      // This regex ensures the expression only contains safe mathematical characters
      const safePattern = /^[\s\d+\-*/().$A-Z]+$/
      return safePattern.test(expr)
    },
    {
      message:
        "Expression must be a valid mathematical expression using query references ($A, $B, etc.) and operators (+, -, *, /). Function calls and other code are not allowed.",
    }
  )

/**
 * Query or expression union type
 */
const queryOrExpressionSchema = z.union([queryDefinitionSchema, expressionDefinitionSchema])

/**
 * Zod schema for graph fragment content (stored in Usable fragment.content)
 *
 * ARCHITECTURAL NOTE:
 * - All configuration data MUST be in the JSON content (fragment.content)
 * - fragment.title, fragment.summary, and fragment frontmatter are for Usable convenience and AI search
 * - These metadata fields should be synced from the JSON content for consistency
 * - The JSON content is the source of truth for all configuration
 */
export const graphFragmentDataSchema = z.object({
  id: z.string().min(1, "ID is required"), // Sortable UUID (ULID) for the fragment
  title: z.string().min(1, "Title is required"), // Graph title/name - stored in JSON content (source of truth)
  dataSourceRef: z.string().min(1, "Data source reference is required"), // Default data source
  connectorRef: z.string().optional(),
  // Support both single query (legacy) and multiple queries
  query: z
    .object({
      dialect: z.literal("sql"),
      text: z.string().min(1, "Query text is required"),
      parameters: z.array(parameterDefinitionSchema),
    })
    .refine(
      (data) => {
        // Validate SQL query for security (prevents SQL injection)
        const validation = validateSqlQuery(data.text)
        return validation.valid
      },
      (data) => {
        // Return custom error message from validation
        const validation = validateSqlQuery(data.text)
        return {
          message: validation.error || "Invalid SQL query",
          path: ["text"],
        }
      }
    )
    .optional(),
  // New: multiple queries and expressions
  queries: z.array(queryOrExpressionSchema).min(1, "At least one query is required").optional(),
  parameterSchema: z.object({
    parameters: z.array(parameterDefinitionSchema),
  }),
  visualization: z.object({
    type: z.enum(["line", "bar", "table", "pie", "scatter", "area"]),
    options: z.record(z.unknown()),
  }),
  timeRange: z
    .enum(["1h", "7d", "30d", "90d", "180d", "365d", "all", "custom"])
    .optional()
    .describe("Built-in time range filter for the graph"),
  cachePolicy: z
    .object({
      ttl: z.number().int().positive().optional(),
    })
    .optional(),
})

/**
 * Graph fragment structure (stored in Usable)
 */
export type GraphFragmentData = z.infer<typeof graphFragmentDataSchema>

/**
 * Zod schema for creating a graph
 *
 * NOTE: Removed .refine() to avoid Zod v4 schema serialization issues in Next.js/Turbopack.
 * Validation for dataSourceRef is now done in the service layer (createGraph function).
 */
export const createGraphInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  dataSourceRef: z.string().optional(), // Optional when queries have their own dataSourceRef
  connectorRef: z.string().optional(),
  // Support both single query (legacy) and multiple queries
  query: z
    .object({
      dialect: z.literal("sql"),
      text: z.string().min(1, "Query text is required"),
      parameters: z.array(parameterDefinitionSchema),
    })
    .optional(),
  // New: multiple queries and expressions
  queries: z.array(queryOrExpressionSchema).min(1, "At least one query is required").optional(),
  parameterSchema: z.object({
    parameters: z.array(parameterDefinitionSchema),
  }),
  visualization: z.object({
    type: z.enum(["line", "bar", "table", "pie", "scatter", "area"]),
    options: z.record(z.unknown()),
  }),
  timeRange: z
    .enum(["1h", "7d", "30d", "90d", "180d", "365d", "all", "custom"])
    .optional()
    .describe("Built-in time range filter for the graph"),
  cachePolicy: z
    .object({
      ttl: z.number().int().positive().optional(),
    })
    .optional(),
})

/**
 * Graph creation input type (inferred from schema)
 */
export type CreateGraphInput = z.infer<typeof createGraphInputSchema>

/**
 * Zod schema for updating a graph
 */
export const updateGraphInputSchema = createGraphInputSchema.partial()

/**
 * Graph update input type (inferred from schema)
 */
export type UpdateGraphInput = z.infer<typeof updateGraphInputSchema>

/**
 * Create a graph fragment and emit graph.created.0 event
 * Mutation function - requires SessionPathway
 */
export async function createGraph(
  sessionPathway: SessionPathwayBuilder<any>,
  workspaceId: string,
  graphData: CreateGraphInput,
  accessToken: string
): Promise<{ graphId: string; status: "processing" }> {
  // Get fragment type ID for "graphs"
  const fragmentTypeId = await usableApi.getFragmentTypeIdByName(workspaceId, "graphs", accessToken)
  if (!fragmentTypeId) {
    throw new Error("Fragment type 'graphs' not found. Please ensure workspace is bootstrapped.")
  }

  // Generate sortable UUID for the fragment content
  const fragmentContentUlid = ulid()

  // Input data is already validated in the API route, so we can use it directly
  // Type assertion is safe because validation happened in the route handler
  const validatedData = graphData as CreateGraphInput

  // Validate and derive dataSourceRef (moved from .refine() to avoid serialization issues)
  // If using single query (legacy), dataSourceRef is required
  let finalDataSourceRef: string
  if (validatedData.query && (!validatedData.queries || validatedData.queries.length === 0)) {
    if (!validatedData.dataSourceRef || validatedData.dataSourceRef.trim().length === 0) {
      throw new Error("Data source reference is required when using single query")
    }
    finalDataSourceRef = validatedData.dataSourceRef
  } else if (validatedData.queries && validatedData.queries.length > 0) {
    // If using multiple queries, derive dataSourceRef from first SQL query if not provided at top level
    if (validatedData.dataSourceRef && validatedData.dataSourceRef.trim().length > 0) {
      finalDataSourceRef = validatedData.dataSourceRef
    } else {
      // Find first SQL query with dataSourceRef
      const firstSqlQuery = validatedData.queries.find(
        (q) => "dialect" in q && q.dialect === "sql" && q.dataSourceRef && q.dataSourceRef.trim().length > 0
      )
      if (!firstSqlQuery || !("dataSourceRef" in firstSqlQuery) || !firstSqlQuery.dataSourceRef) {
        throw new Error("Data source reference is required (either at top level or in each query)")
      }
      finalDataSourceRef = firstSqlQuery.dataSourceRef
    }
  } else {
    // Fallback (should not happen due to schema validation)
    throw new Error("Either 'query' or 'queries' must be provided")
  }

  // Create fragment content with ULID
  // Title is stored in JSON content (source of truth)
  const fragmentContent: GraphFragmentData = {
    id: fragmentContentUlid,
    title: validatedData.title, // Title is in JSON content (source of truth)
    dataSourceRef: finalDataSourceRef, // Now guaranteed to be a string
    connectorRef: validatedData.connectorRef,
    query: validatedData.query,
    queries: validatedData.queries,
    parameterSchema: validatedData.parameterSchema,
    visualization: validatedData.visualization,
    cachePolicy: validatedData.cachePolicy,
  }

  // Validate the content structure
  let validatedContent: GraphFragmentData
  try {
    validatedContent = graphFragmentDataSchema.parse(fragmentContent)
  } catch (error) {
    console.error("Graph fragment content validation failed:", {
      error,
      fragmentContent,
      fragmentContentKeys: Object.keys(fragmentContent),
    })
    throw error
  }

  // Generate deterministic key for lookup (format: graph-<ulid>)
  // Note: Usable API requires keys to contain only alphanumeric characters, dashes, and underscores
  const fragmentKey = `graph-${fragmentContentUlid}`

  // Create fragment in Usable
  // Sync title to fragment.title for Usable search convenience (content.title is source of truth)
  const fragmentInput = {
    workspaceId,
    title: validatedContent.title, // Sync from content for search
    key: fragmentKey,
    content: JSON.stringify(validatedContent, null, 2),
    summary: `Graph: ${validatedContent.title}`,
    tags: [GRAPHABLE_APP_TAG, "type:graph", `version:${GRAPHABLE_VERSION}`, `workspace:${workspaceId}`],
    fragmentTypeId,
    repository: "graphable",
  }

  console.log("Creating graph fragment:", {
    workspaceId,
    fragmentTypeId,
    title: fragmentInput.title,
    contentLength: fragmentInput.content.length,
    hasQuery: !!validatedContent.query,
    hasQueries: !!validatedContent.queries,
    queriesCount: validatedContent.queries?.length || 0,
    fragmentInput: {
      ...fragmentInput,
      content: `${fragmentInput.content.substring(0, 500)}...`, // Truncate for logging
    },
  })

  const fragment = await usableApi.createFragment(workspaceId, fragmentInput, accessToken)

  // Use fragment ID as graph ID (no separate UUID)
  const graphId = fragment.id

  // Emit graph.created.0 event via Session Pathways
  await (sessionPathway as any).write(
    `${graphContract.FlowcoreGraph.flowType}/${graphContract.FlowcoreGraph.eventType.created}`,
    {
      data: {
        graphId, // Fragment ID
        fragmentId: graphId, // Same as graphId
        workspaceId,
        dataSourceRef: finalDataSourceRef, // Use validated/derived dataSourceRef
        connectorRef: validatedData.connectorRef,
        occurredAt: new Date().toISOString(),
        initiatedBy: (sessionPathway as any).getUserResolver
          ? (await (sessionPathway as any).getUserResolver()).entityId
          : "system",
        requestId: randomUUID(),
      },
    }
  )

  return { graphId, status: "processing" }
}

/**
 * Update a graph fragment and emit graph.updated.0 event
 * Mutation function - requires SessionPathway
 */
export async function updateGraph(
  sessionPathway: SessionPathwayBuilder<any>,
  workspaceId: string,
  graphId: string, // Fragment ID
  graphData: UpdateGraphInput,
  accessToken: string
): Promise<{ graphId: string; status: "processing" }> {
  // Get fragment from Usable (graphId is the fragment ID)
  const fragment = await usableApi.getFragment(workspaceId, graphId, accessToken)
  if (!fragment) {
    throw new Error(`Graph not found: ${graphId}`)
  }

  // Validate and parse existing fragment content
  let existingData: GraphFragmentData
  try {
    const parsed = JSON.parse(fragment.content || "{}")
    existingData = graphFragmentDataSchema.parse(parsed)
  } catch (error) {
    console.error("Failed to parse existing graph fragment content:", error)
    throw new Error(`Invalid graph fragment content: ${error instanceof Error ? error.message : "Unknown error"}`)
  }

  // Input data is already validated in the API route, so we can use it directly
  // Type assertion is safe because validation happened in the route handler
  const validatedUpdate = graphData as UpdateGraphInput

  // Full content replacement: merge updates, preserving the ID
  // Title is stored in JSON content (source of truth)
  const updatedData: GraphFragmentData = {
    id: existingData.id, // Preserve the existing ID
    title: validatedUpdate.title !== undefined ? validatedUpdate.title : existingData.title, // Title from content
    dataSourceRef:
      validatedUpdate.dataSourceRef !== undefined ? validatedUpdate.dataSourceRef : existingData.dataSourceRef,
    connectorRef: validatedUpdate.connectorRef !== undefined ? validatedUpdate.connectorRef : existingData.connectorRef,
    query: validatedUpdate.query !== undefined ? validatedUpdate.query : existingData.query,
    queries: validatedUpdate.queries !== undefined ? validatedUpdate.queries : existingData.queries,
    parameterSchema: validatedUpdate.parameterSchema || existingData.parameterSchema,
    visualization: validatedUpdate.visualization || existingData.visualization,
    cachePolicy: validatedUpdate.cachePolicy !== undefined ? validatedUpdate.cachePolicy : existingData.cachePolicy,
  }

  // Validate the merged data
  const validatedUpdatedData = graphFragmentDataSchema.parse(updatedData)

  // Update fragment in Usable using full content replacement
  // Sync title to fragment.title for Usable search convenience (content.title is source of truth)
  await usableApi.updateFragment(
    workspaceId,
    graphId, // Fragment ID
    {
      title: updatedData.title, // Update fragment title
      content: JSON.stringify(updatedData, null, 2), // Full content replacement
      summary: `Graph: ${updatedData.title}`,
    },
    accessToken
  )

  // Emit graph.updated.0 event via Session Pathways
  await (sessionPathway as any).write(
    `${graphContract.FlowcoreGraph.flowType}/${graphContract.FlowcoreGraph.eventType.updated}`,
    {
      data: {
        graphId, // Fragment ID
        fragmentId: graphId, // Same as graphId
        workspaceId,
        dataSourceRef: validatedUpdatedData.dataSourceRef,
        connectorRef: validatedUpdatedData.connectorRef,
        occurredAt: new Date().toISOString(),
        initiatedBy: (sessionPathway as any).getUserResolver
          ? (await (sessionPathway as any).getUserResolver()).entityId
          : "system",
        requestId: randomUUID(),
      },
    }
  )

  return { graphId, status: "processing" }
}

/**
 * Delete a graph fragment and emit graph.deleted.0 event
 * Mutation function - requires SessionPathway
 */
export async function deleteGraph(
  sessionPathway: SessionPathwayBuilder<any>,
  workspaceId: string,
  graphId: string, // Fragment ID
  accessToken: string
): Promise<{ graphId: string; status: "processing" }> {
  // Verify graph exists by fetching fragment
  const fragment = await usableApi.getFragment(workspaceId, graphId, accessToken)
  if (!fragment) {
    throw new Error(`Graph not found: ${graphId}`)
  }

  // Delete fragment from Usable
  await usableApi.deleteFragment(workspaceId, graphId, accessToken)

  // Emit graph.deleted.0 event via Session Pathways
  await (sessionPathway as any).write(
    `${graphContract.FlowcoreGraph.flowType}/${graphContract.FlowcoreGraph.eventType.deleted}`,
    {
      data: {
        graphId, // Fragment ID
        fragmentId: graphId, // Same as graphId
        workspaceId,
        occurredAt: new Date().toISOString(),
        initiatedBy: (sessionPathway as any).getUserResolver
          ? (await (sessionPathway as any).getUserResolver()).entityId
          : "system",
        requestId: randomUUID(),
      },
    }
  )

  return { graphId, status: "processing" }
}

/**
 * Graph with metadata (for display)
 */
export interface GraphWithMetadata extends GraphFragmentData {
  fragmentId: string
}

/**
 * Get graph fragment from Usable API
 * Read function - no SessionPathway needed
 */
export async function getGraph(
  workspaceId: string,
  graphId: string, // Fragment ID
  accessToken: string
): Promise<GraphWithMetadata | null> {
  // Get fragment directly from Usable (graphId is the fragment ID)
  const fragment = await usableApi.getFragment(workspaceId, graphId, accessToken)
  if (!fragment) {
    return null
  }

  // Validate and parse fragment content
  let parsed: GraphFragmentData
  try {
    const jsonParsed = JSON.parse(fragment.content || "{}")
    parsed = graphFragmentDataSchema.parse(jsonParsed)
  } catch (error) {
    console.error("Failed to parse graph fragment content:", error)
    throw new Error(`Invalid graph fragment content: ${error instanceof Error ? error.message : "Unknown error"}`)
  }

  return {
    ...parsed,
    title: parsed.title || fragment.title || "Untitled Graph", // Fallback to fragment title or default
    fragmentId: fragment.id,
  }
}

/**
 * Graph list item with metadata
 */
export interface GraphListItem {
  id: string // Fragment ID
  fragmentId: string
  title: string
  dataSourceRef: string
  visualizationType: "line" | "bar" | "table" | "pie" | "scatter" | "area"
  parameterCount: number
}

/**
 * List graphs for a workspace
 * Read function - no SessionPathway needed
 * Query Usable fragments directly (no cache)
 */
export async function listGraphs(workspaceId: string, accessToken: string): Promise<GraphListItem[]> {
  // Get fragment type ID for "graphs" to ensure proper filtering
  const fragmentTypeId = await usableApi.getFragmentTypeIdByName(workspaceId, "graphs", accessToken)

  // If fragment type doesn't exist, return empty array (workspace not bootstrapped)
  if (!fragmentTypeId) {
    console.warn("Fragment type 'graphs' not found. Workspace may not be bootstrapped.")
    return []
  }

  // List fragments by fragmentTypeId AND tags (double filtering for safety)
  const fragments = await usableApi.listFragments(
    workspaceId,
    {
      fragmentTypeId, // Required - ensures strict filtering by fragment type
      tags: [GRAPHABLE_APP_TAG, "type:graph"],
      limit: 100,
    },
    accessToken
  )

  // Defensive validation: Filter out any fragments that don't match the expected fragment type
  // This ensures we never accidentally return fragments of the wrong type
  const validFragments = fragments.filter((fragment) => fragment.fragmentTypeId === fragmentTypeId)

  if (validFragments.length !== fragments.length) {
    console.warn(
      `Filtered out ${fragments.length - validFragments.length} fragments with incorrect fragment type. Expected: ${fragmentTypeId}`
    )
  }

  // Parse metadata from fragment content (no cache needed)
  return validFragments.map((fragment) => {
    let title = fragment.title || "Untitled Graph" // Fallback to fragment title or default
    let dataSourceRef = "unknown"
    let visualizationType: "line" | "bar" | "table" | "pie" | "scatter" | "area" = "table"
    let parameterCount = 0

    try {
      const jsonParsed = JSON.parse(fragment.content || "{}")
      const content = graphFragmentDataSchema.parse(jsonParsed)
      title = content.title || fragment.title || "Untitled Graph"
      dataSourceRef = content.dataSourceRef || "unknown"
      visualizationType = content.visualization.type || "table"
      parameterCount = content.parameterSchema.parameters.length || 0
    } catch (error) {
      // If parsing/validation fails, use defaults and log warning
      console.warn(`Failed to parse graph fragment ${fragment.id}:`, error)
    }

    return {
      id: fragment.id, // Fragment ID is the graph ID
      fragmentId: fragment.id,
      title,
      dataSourceRef,
      visualizationType,
      parameterCount,
    }
  })
}

// Cache removed - all data comes from Usable fragments
