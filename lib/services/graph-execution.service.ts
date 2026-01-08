import type { SessionPathwayBuilder } from "@flowcore/pathways"
import { Parser } from "expr-eval"
import type { DashboardFragmentData } from "./dashboard.service"
import * as dashboardService from "./dashboard.service"
import * as databaseExplorationService from "./database-exploration.service"
import type { GraphFragmentData } from "./graph.service"
import * as graphService from "./graph.service"
import { logger } from "./logger.service"
import { validateParameters } from "./parameter-validation.service"
import { validateSqlQuery } from "./sql-validation.service"

/**
 * Type alias for SessionPathwayBuilder used in graph execution functions
 * Used for auditing graph execution and preview operations
 */
type GraphExecutionSessionPathway = SessionPathwayBuilder<Record<string, { input: unknown; output: unknown }>>

/**
 * Execute a graph query via worker service
 * Returns result data for visualization
 * Supports both single query (legacy) and multiple queries with expressions
 */
export async function executeGraph(
  workspaceId: string,
  graphId: string, // Fragment ID
  parameters: Record<string, unknown>,
  userId: string,
  accessToken: string,
  sessionPathway?: GraphExecutionSessionPathway
): Promise<{ data: unknown[]; columns: string[] }> {
  // Get graph fragment from Usable (graphId is the fragment ID)
  const graph = await graphService.getGraph(workspaceId, graphId, accessToken)
  if (!graph) {
    throw new Error(`Graph not found: ${graphId}`)
  }

  // Validate parameters against schema
  const validationResult = validateParameters(graph.parameterSchema, parameters)
  if (!validationResult.valid) {
    throw new Error(
      `Parameter validation failed: ${validationResult.errors?.map((e) => `${e.parameter}: ${e.error}`).join(", ")}`
    )
  }

  // Apply default values for missing optional parameters
  const parametersWithDefaults: Record<string, unknown> = { ...parameters }
  for (const paramDef of graph.parameterSchema.parameters) {
    if (parametersWithDefaults[paramDef.name] === undefined && paramDef.default !== undefined) {
      parametersWithDefaults[paramDef.name] = paramDef.default
    }
  }

  // Check if time range is disabled in visualization options
  const disableTimeRange =
    graph.visualization?.options && typeof graph.visualization.options === "object"
      ? (graph.visualization.options as Record<string, unknown>).disableTimeRange === true
      : false

  // Support multiple queries (new) or single query (legacy)
  if (graph.queries && graph.queries.length > 0) {
    return await executeMultipleQueries(
      graph,
      workspaceId,
      parametersWithDefaults,
      userId,
      accessToken,
      disableTimeRange,
      sessionPathway
    )
  } else if (graph.query) {
    // Legacy single query support
    return await executeSingleQuery(
      graph,
      workspaceId,
      parametersWithDefaults,
      userId,
      accessToken,
      disableTimeRange,
      sessionPathway
    )
  } else {
    throw new Error("Graph must have either 'query' or 'queries' defined")
  }
}

/**
 * Execute a single query (legacy support)
 */
async function executeSingleQuery(
  graph: GraphFragmentData,
  workspaceId: string,
  parametersWithDefaults: Record<string, unknown>,
  userId: string,
  accessToken: string,
  disableTimeRange: boolean,
  _sessionPathway?: GraphExecutionSessionPathway
): Promise<{ data: unknown[]; columns: string[] }> {
  // Inject time range filter if configured in graph and not disabled
  if (!graph.query) {
    throw new Error("Graph query is required for single query execution")
  }
  let queryText = graph.query.text

  // Runtime SQL validation (defensive check even though schema validates)
  const validation = validateSqlQuery(queryText)
  if (!validation.valid) {
    throw new Error(`Invalid SQL query: ${validation.error}`)
  }

  if (graph.timeRange && !disableTimeRange) {
    queryText = injectTimeRangeFilter(queryText, graph.timeRange)

    // Re-validate after time range injection (defensive check)
    const postInjectionValidation = validateSqlQuery(queryText)
    if (!postInjectionValidation.valid) {
      throw new Error(`Invalid SQL query after time range injection: ${postInjectionValidation.error}`)
    }
  }

  // Bind parameters to query safely
  const { bindParametersToQuery } = await import("./parameter-validation.service")
  const boundQuery = bindParametersToQuery(
    queryText,
    graph.query.parameters || graph.parameterSchema.parameters,
    parametersWithDefaults
  )

  // Execute query directly using database exploration service
  // Note: Graph execution bypasses admin check - authorization is handled at API route level
  const result = await databaseExplorationService.executeQuery(
    graph.dataSourceRef,
    workspaceId,
    boundQuery.query,
    1, // page
    1000, // pageSize (max for execution)
    userId,
    accessToken,
    boundQuery.parameterValues, // Pass pre-bound parameter values
    false // requireAdmin = false for graph execution
  )

  return {
    data: result.rows,
    columns: result.columns,
  }
}

/**
 * Combine multiple query results into a single dataset for visualization
 * Aligns data by the first column (usually date) and prefixes numeric columns with refId
 * Filters out hidden queries from visualization but keeps them for expression evaluation
 */
function combineQueryResults(
  queryResults: Record<string, { data: unknown[]; columns: string[] }>,
  queryDefinitions: Array<{ refId: string; name?: string; hidden?: boolean }>
): { data: unknown[]; columns: string[] } {
  // If no results, return empty
  if (Object.keys(queryResults).length === 0) {
    return { data: [], columns: [] }
  }

  // Filter out hidden queries from visualization (but keep them in queryResults for expressions)
  const visibleQueryDefs = queryDefinitions.filter((def) => !def.hidden)
  const visibleRefIds = new Set(visibleQueryDefs.map((def) => def.refId))
  const visibleResultKeys = Object.keys(queryResults).filter((refId) => visibleRefIds.has(refId))

  // If no visible results, return empty
  if (visibleResultKeys.length === 0) {
    return { data: [], columns: [] }
  }

  // Get date column from first visible result
  const dateColumn = queryResults[visibleResultKeys[0]]?.columns[0]
  if (!dateColumn) {
    // Fallback: just return first visible result
    return queryResults[visibleResultKeys[0]] || { data: [], columns: [] }
  }

  // Helper function to get display name for a column
  // Custom query name should only be used when there's a single value column (for time series)
  // For SELECT * queries with multiple columns, preserve original column names
  const getColumnDisplayName = (
    refId: string,
    columnName: string,
    queryDef?: { name?: string },
    totalColumns?: number
  ): string => {
    const queryName = queryDef?.name

    // For SELECT * queries with many columns, preserve original column names
    if (totalColumns && totalColumns > 2) {
      return columnName
    }

    // Only use custom name if:
    // 1. Query has a custom name
    // 2. There are exactly 2 columns (date + value) - typical time series pattern
    if (queryName && totalColumns === 2) {
      // Use custom name for the value column (second column)
      return queryName
    }

    // Fallback to refId_columnName for single queries without custom name
    return `${refId}_${columnName}`
  }

  // If only one visible result, return it with prefixed columns
  if (visibleResultKeys.length === 1) {
    const refId = visibleResultKeys[0]
    const result = queryResults[refId]
    const queryDef = visibleQueryDefs.find((def) => def.refId === refId)
    if (!result) {
      return { data: [], columns: [] }
    }
    // For SELECT * queries with many columns, preserve original column names
    // Only apply custom name for time series (2 columns: date + value)
    const totalColumns = result.columns.length
    const prefixedColumns = result.columns.map((col, index) => {
      if (index === 0) return col // Keep first column as-is (usually date)
      return getColumnDisplayName(refId, col, queryDef, totalColumns)
    })
    const prefixedData = result.data.map((row) => {
      if (typeof row !== "object" || row === null) return row
      const rowObj = row as Record<string, unknown>
      const prefixedRow: Record<string, unknown> = {}
      result.columns.forEach((col, index) => {
        const newColName = index === 0 ? col : getColumnDisplayName(refId, col, queryDef, totalColumns)
        prefixedRow[newColName] = rowObj[col]
      })
      return prefixedRow
    })
    return { data: prefixedData, columns: prefixedColumns }
  }

  // Multiple results - merge by aligning on first column (date)
  // Collect all unique dates from visible queries only
  const dateSet = new Set<string | number>()
  for (const refId of visibleResultKeys) {
    const result = queryResults[refId]
    if (!result) continue
    for (const row of result.data) {
      if (typeof row === "object" && row !== null) {
        const rowObj = row as Record<string, unknown>
        const dateValue = rowObj[dateColumn]
        if (dateValue !== null && dateValue !== undefined) {
          dateSet.add(String(dateValue))
        }
      }
    }
  }

  // Sort dates
  const sortedDates = Array.from(dateSet).sort((a, b) => {
    const aDate = new Date(String(a)).getTime()
    const bDate = new Date(String(b)).getTime()
    if (!Number.isNaN(aDate) && !Number.isNaN(bDate)) {
      return aDate - bDate
    }
    return String(a).localeCompare(String(b))
  })

  // Build combined columns: date column + all numeric columns from visible queries only
  const combinedColumns = [dateColumn]
  for (const queryDef of visibleQueryDefs) {
    const refId = queryDef.refId
    const result = queryResults[refId]
    if (!result) continue
    // Add all columns except the first (date) with custom name or refId prefix
    // For SELECT * queries with many columns, preserve original column names
    const totalColumns = result.columns.length
    for (let i = 1; i < result.columns.length; i++) {
      const col = result.columns[i]
      combinedColumns.push(getColumnDisplayName(refId, col, queryDef, totalColumns))
    }
  }

  // Build combined data by merging rows
  const combinedData: unknown[] = []
  for (const date of sortedDates) {
    const combinedRow: Record<string, unknown> = { [dateColumn]: date }

    // For each visible query, find the row matching this date
    for (const queryDef of visibleQueryDefs) {
      const refId = queryDef.refId
      const result = queryResults[refId]
      if (!result) continue

      // Find row with matching date
      const matchingRow = result.data.find((row) => {
        if (typeof row === "object" && row !== null) {
          const rowObj = row as Record<string, unknown>
          return String(rowObj[dateColumn]) === String(date)
        }
        return false
      })

      if (matchingRow && typeof matchingRow === "object" && matchingRow !== null) {
        const rowObj = matchingRow as Record<string, unknown>
        // Copy all columns except the first (date) with custom name or refId prefix
        // For SELECT * queries with many columns, preserve original column names
        const totalColumns = result.columns.length
        for (let i = 1; i < result.columns.length; i++) {
          const col = result.columns[i]
          const displayName = getColumnDisplayName(refId, col, queryDef, totalColumns)
          combinedRow[displayName] = rowObj[col]
        }
      } else {
        // No matching row - fill with null
        const totalColumns = result.columns.length
        for (let i = 1; i < result.columns.length; i++) {
          const col = result.columns[i]
          const displayName = getColumnDisplayName(refId, col, queryDef, totalColumns)
          combinedRow[displayName] = null
        }
      }
    }

    combinedData.push(combinedRow)
  }

  return { data: combinedData, columns: combinedColumns }
}

/**
 * Execute multiple queries and expressions
 */
async function executeMultipleQueries(
  graph: GraphFragmentData,
  workspaceId: string,
  parametersWithDefaults: Record<string, unknown>,
  userId: string,
  accessToken: string,
  disableTimeRange: boolean,
  _sessionPathway?: GraphExecutionSessionPathway
): Promise<{ data: unknown[]; columns: string[] }> {
  if (!graph.queries || graph.queries.length === 0) {
    throw new Error("Graph queries are required for multiple query execution")
  }
  // Separate queries and expressions
  const sqlQueries = graph.queries.filter((q) => "dialect" in q && q.dialect === "sql")
  const expressions = graph.queries.filter((q) => "operation" in q)

  // Execute all SQL queries first and store results by refId
  const queryResults: Record<string, { data: unknown[]; columns: string[] }> = {}

  for (const queryDef of sqlQueries) {
    if ("dialect" in queryDef && queryDef.dialect === "sql") {
      let queryText = queryDef.text

      // Runtime SQL validation (defensive check even though schema validates)
      const validation = validateSqlQuery(queryText)
      if (!validation.valid) {
        throw new Error(`Invalid SQL query for query ${queryDef.refId}: ${validation.error}`)
      }

      // Inject time range filter if configured and not disabled
      if (graph.timeRange && !disableTimeRange) {
        queryText = injectTimeRangeFilter(queryText, graph.timeRange)

        // Re-validate after time range injection (defensive check)
        const postInjectionValidation = validateSqlQuery(queryText)
        if (!postInjectionValidation.valid) {
          throw new Error(
            `Invalid SQL query after time range injection for query ${queryDef.refId}: ${postInjectionValidation.error}`
          )
        }
      }

      // Bind parameters to query
      const { bindParametersToQuery } = await import("./parameter-validation.service")
      const boundQuery = bindParametersToQuery(queryText, queryDef.parameters, parametersWithDefaults)

      // Execute query
      // Note: Graph execution bypasses admin check - authorization is handled at API route level
      const result = await databaseExplorationService.executeQuery(
        queryDef.dataSourceRef || graph.dataSourceRef,
        workspaceId,
        boundQuery.query,
        1,
        1000,
        userId,
        accessToken,
        boundQuery.parameterValues,
        false // requireAdmin = false for graph execution
      )

      queryResults[queryDef.refId] = {
        data: result.rows,
        columns: result.columns,
      }
    }
  }

  // Evaluate expressions
  for (const exprDef of expressions) {
    if ("operation" in exprDef) {
      if (exprDef.operation === "math") {
        const result = evaluateMathExpression(exprDef.expression, queryResults)
        queryResults[exprDef.refId] = result
      } else {
        // TODO: Implement reduce and resample operations
        throw new Error(`Expression operation '${exprDef.operation}' not yet implemented`)
      }
    }
  }

  // Combine all results for visualization
  return combineQueryResults(queryResults, graph.queries)
}

/**
 * Evaluate a math expression on query results
 * Supports expressions like "$A + $B", "$A * 2", "$A - $B", etc.
 * Aligns data by the first column (usually date) across all referenced queries
 */
function evaluateMathExpression(
  expression: string,
  queryResults: Record<string, { data: unknown[]; columns: string[] }>
): { data: unknown[]; columns: string[] } {
  // Extract referenced query IDs (e.g., $A, $B)
  const refIdMatches = expression.match(/\$([A-Z])/g)
  if (!refIdMatches || refIdMatches.length === 0) {
    throw new Error(`Expression must reference at least one query: ${expression}`)
  }

  // Get unique refIds
  const refIds = [...new Set(refIdMatches.map((m) => m.substring(1)))]

  // Verify all referenced queries exist
  for (const refId of refIds) {
    if (!queryResults[refId]) {
      throw new Error(`Query ${refId} not found for expression: ${expression}`)
    }
  }

  // Get the first query result to determine date column and structure
  const firstRefId = refIds[0]
  if (!firstRefId) {
    throw new Error("No reference IDs found in expression")
  }
  const firstResult = queryResults[firstRefId]
  if (!firstResult) {
    throw new Error(`Query result not found for ${firstRefId}`)
  }

  // The date column is always the first column
  const dateColumn = firstResult.columns[0]
  if (!dateColumn) {
    throw new Error("First query must have at least one column (date)")
  }

  // Build a map of date -> values for each referenced query
  // This allows us to align data by date even if queries have different dates or row counts
  const dateValueMaps: Record<string, Record<string, number>> = {}

  for (const refId of refIds) {
    const result = queryResults[refId]
    if (!result) {
      throw new Error(`Query result not found for ${refId}`)
    }

    // Find the numeric column (first numeric column after date)
    // PostgreSQL may return numeric values as strings, so we need to check and parse
    let numericColumn: string | null = null

    if (result.data.length === 0) {
      throw new Error(`Query ${refId} returned no data for expression evaluation`)
    }

    // Check all columns after the date column
    for (let i = 1; i < result.columns.length; i++) {
      const col = result.columns[i]
      // Check multiple rows to find a column with numeric data
      for (const row of result.data) {
        if (typeof row === "object" && row !== null) {
          const rowObj = row as Record<string, unknown>
          const value = rowObj[col]

          // Check if it's already a number
          if (typeof value === "number") {
            numericColumn = col
            break
          }

          // Check if it's a string that can be parsed as a number
          if (typeof value === "string" && value.trim() !== "") {
            const parsed = Number(value)
            if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
              numericColumn = col
              break
            }
          }
        }
      }
      if (numericColumn) break
    }

    if (!numericColumn) {
      throw new Error(
        `No numeric column found in query ${refId} for expression evaluation. Available columns: ${result.columns.join(", ")}`
      )
    }

    // Build map: date -> numeric value
    dateValueMaps[refId] = {}
    for (const row of result.data) {
      if (typeof row === "object" && row !== null) {
        const rowObj = row as Record<string, unknown>
        const dateValue = rowObj[dateColumn]
        let numericValue = rowObj[numericColumn]

        // Parse numeric value if it's a string
        if (typeof numericValue === "string") {
          const parsed = Number(numericValue)
          if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
            numericValue = parsed
          } else {
            continue // Skip rows with invalid numeric values
          }
        }

        if (dateValue !== null && dateValue !== undefined && typeof numericValue === "number") {
          dateValueMaps[refId][String(dateValue)] = numericValue
        }
      }
    }
  }

  // Collect all unique dates from all referenced queries
  const dateSet = new Set<string>()
  for (const refId of refIds) {
    const dateValueMap = dateValueMaps[refId]
    if (dateValueMap) {
      for (const date of Object.keys(dateValueMap)) {
        dateSet.add(date)
      }
    }
  }

  // Sort dates
  const sortedDates = Array.from(dateSet).sort((a, b) => {
    const aDate = new Date(a).getTime()
    const bDate = new Date(b).getTime()
    if (!Number.isNaN(aDate) && !Number.isNaN(bDate)) {
      return aDate - bDate
    }
    return String(a).localeCompare(String(b))
  })

  // Evaluate expression for each date
  const evaluatedData: unknown[] = []

  for (const date of sortedDates) {
    // Replace $A, $B, etc. with actual values for this date
    let evalExpr = expression
    let allValuesPresent = true

    for (const refId of refIds) {
      const dateValueMap = dateValueMaps[refId]
      const value = dateValueMap?.[date]
      if (value === undefined) {
        // Missing value for this date - skip this row or use null
        allValuesPresent = false
        break
      }
      evalExpr = evalExpr.replace(new RegExp(`\\$${refId}`, "g"), String(value))
    }

    // Only evaluate if all referenced queries have values for this date
    if (allValuesPresent) {
      try {
        // Use expr-eval for safe mathematical expression evaluation (prevents code injection)
        // Create parser instance and evaluate expression safely
        const parser = new Parser()
        const expr = parser.parse(evalExpr)
        const result = expr.evaluate({})
        evaluatedData.push({
          [dateColumn]: date,
          value: result,
        })
      } catch (error) {
        // Log error but continue with other dates
        logger.error("Failed to evaluate expression for date", {
          date,
          error: error instanceof Error ? error.message : "Unknown error",
          errorType: error instanceof Error ? error.constructor.name : typeof error,
        })
      }
    }
  }

  return {
    data: evaluatedData,
    columns: [dateColumn, "value"],
  }
}

/**
 * Inject time range filter into SQL query
 * Attempts to find date/timestamp columns and adds WHERE clause
 */
function injectTimeRangeFilter(
  queryText: string,
  timeRange: "1h" | "7d" | "30d" | "90d" | "180d" | "365d" | "all" | "custom"
): string {
  if (timeRange === "all" || timeRange === "custom") {
    return queryText
  }

  // Common date/timestamp column names to look for
  const dateColumnPatterns = [
    /\bcreated_at\b/i,
    /\bupdated_at\b/i,
    /\bdate\b/i,
    /\btimestamp\b/i,
    /\bcreated\b/i,
    /\bupdated\b/i,
    /\btime\b/i,
    /\bdatetime\b/i,
  ]

  // Try to find a date column in the SELECT clause
  let dateColumn: string | null = null
  const selectMatch = queryText.match(/SELECT\s+(.+?)\s+FROM/i)
  if (selectMatch) {
    const selectColumns = selectMatch[1]
    for (const pattern of dateColumnPatterns) {
      const match = selectColumns.match(pattern)
      if (match) {
        // Extract the column name (handle table aliases)
        const columnMatch = selectColumns.match(new RegExp(`(?:\\w+\\.)?(${match[0]})`, "i"))
        if (columnMatch) {
          dateColumn = columnMatch[1]
          break
        }
      }
    }
  }

  // If no column found in SELECT, try common column names
  if (!dateColumn) {
    // Check if query references common date columns
    for (const pattern of dateColumnPatterns) {
      if (queryText.match(pattern)) {
        const match = queryText.match(new RegExp(`(?:\\w+\\.)?(${pattern.source.replace(/\\b/g, "")})`, "i"))
        if (match) {
          dateColumn = match[1]
          break
        }
      }
    }
  }

  // If no date column found, skip time range filtering (graceful fallback)
  // This follows the pattern in database-exploration.service.ts where queries
  // gracefully fall back when assumptions can't be made about schema
  if (!dateColumn) {
    return queryText
  }

  // Calculate the date threshold
  let dateThreshold: string
  if (timeRange === "1h") {
    dateThreshold = `NOW() - INTERVAL '1 hour'`
  } else {
    const days = parseInt(timeRange.replace("d", ""), 10)
    dateThreshold = `NOW() - INTERVAL '${days} days'`
  }

  // Check if query already has a WHERE clause
  const hasWhere = /\bWHERE\b/i.test(queryText)

  // Build the time range filter
  const timeFilter = `${dateColumn} >= ${dateThreshold}`

  if (hasWhere) {
    // Add to existing WHERE clause
    return queryText.replace(/\bWHERE\b/i, `WHERE ${timeFilter} AND`)
  } else {
    // Add new WHERE clause before ORDER BY, GROUP BY, LIMIT, etc.
    const orderByMatch = queryText.match(/\b(ORDER BY|GROUP BY|LIMIT|OFFSET)\b/i)
    if (orderByMatch) {
      const index = orderByMatch.index ?? queryText.length
      return `${queryText.slice(0, index).trim()} WHERE ${timeFilter} ${queryText.slice(index)}`
    } else {
      return `${queryText.trim()} WHERE ${timeFilter}`
    }
  }
}

/**
 * Execute a query directly without a saved graph (for preview)
 * Returns result data for visualization
 */
export async function executeQuery(
  workspaceId: string,
  graphData: {
    query: {
      dialect: "sql"
      text: string
      parameters: Array<{
        name: string
        type: string
        required: boolean
        default?: unknown
      }>
    }
    dataSourceRef: string
    connectorRef?: string
  },
  parameters: Record<string, unknown>,
  userId: string,
  accessToken: string,
  timeRange?: "1h" | "7d" | "30d" | "90d" | "180d" | "365d" | "all" | "custom",
  _sessionPathway?: GraphExecutionSessionPathway
): Promise<{ data: unknown[]; columns: string[] }> {
  // Apply default values for missing optional parameters
  const parametersWithDefaults: Record<string, unknown> = { ...parameters }
  for (const paramDef of graphData.query.parameters) {
    if (parametersWithDefaults[paramDef.name] === undefined && paramDef.default !== undefined) {
      parametersWithDefaults[paramDef.name] = paramDef.default
    }
  }

  // Runtime SQL validation (defensive check)
  const validation = validateSqlQuery(graphData.query.text)
  if (!validation.valid) {
    throw new Error(`Invalid SQL query: ${validation.error}`)
  }

  // Inject time range filter if provided
  let queryText = graphData.query.text
  if (timeRange) {
    queryText = injectTimeRangeFilter(queryText, timeRange)

    // Re-validate after time range injection (defensive check)
    const postInjectionValidation = validateSqlQuery(queryText)
    if (!postInjectionValidation.valid) {
      throw new Error(`Invalid SQL query after time range injection: ${postInjectionValidation.error}`)
    }
  }

  // Bind parameters to query safely
  const { bindParametersToQuery } = await import("./parameter-validation.service")
  const boundQuery = bindParametersToQuery(
    queryText,
    graphData.query.parameters as Array<{
      name: string
      type: "string" | "number" | "boolean" | "date" | "timestamp" | "enum" | "string[]" | "number[]"
      required: boolean
      default?: unknown
    }>,
    parametersWithDefaults
  )

  // Execute query directly using database exploration service
  // This uses the data source's connection to execute the query
  // Note: Graph execution bypasses admin check - authorization is handled at API route level
  const result = await databaseExplorationService.executeQuery(
    graphData.dataSourceRef,
    workspaceId,
    boundQuery.query,
    1, // page
    1000, // pageSize (max for preview)
    userId,
    accessToken,
    boundQuery.parameterValues, // Pass pre-bound parameter values
    false // requireAdmin = false for graph execution
  )

  return {
    data: result.rows,
    columns: result.columns,
  }
}

/**
 * Execute multiple queries for preview (without a saved graph)
 * Returns result data for visualization
 */
export async function executeMultipleQueriesPreview(
  workspaceId: string,
  userId: string,
  graphData: {
    queries: Array<
      | {
          refId: string
          dialect: "sql"
          text: string
          dataSourceRef: string
          parameters?: Array<{
            name: string
            type: string
            required: boolean
            default?: unknown
          }>
        }
      | {
          refId: string
          operation: "math" | "reduce" | "resample"
          expression: string
        }
    >
    dataSourceRef: string // Default data source
    connectorRef?: string
  },
  parameters: Record<string, unknown>,
  accessToken: string,
  timeRange?: "1h" | "7d" | "30d" | "90d" | "180d" | "365d" | "all" | "custom",
  _sessionPathway?: GraphExecutionSessionPathway
): Promise<{ data: unknown[]; columns: string[] }> {
  // Separate queries and expressions
  const sqlQueries = graphData.queries.filter((q) => "dialect" in q && q.dialect === "sql")
  const expressions = graphData.queries.filter((q) => "operation" in q)

  // Execute all SQL queries first and store results by refId
  const queryResults: Record<string, { data: unknown[]; columns: string[] }> = {}

  for (const queryDef of sqlQueries) {
    if ("dialect" in queryDef && queryDef.dialect === "sql") {
      // Apply default values for missing optional parameters
      const queryParametersWithDefaults: Record<string, unknown> = { ...parameters }
      for (const paramDef of queryDef.parameters || []) {
        if (queryParametersWithDefaults[paramDef.name] === undefined && paramDef.default !== undefined) {
          queryParametersWithDefaults[paramDef.name] = paramDef.default
        }
      }

      let queryText = queryDef.text

      // Runtime SQL validation (defensive check)
      const validation = validateSqlQuery(queryText)
      if (!validation.valid) {
        throw new Error(`Invalid SQL query for query ${queryDef.refId}: ${validation.error}`)
      }

      // Inject time range filter if provided
      if (timeRange) {
        queryText = injectTimeRangeFilter(queryText, timeRange)

        // Re-validate after time range injection (defensive check)
        const postInjectionValidation = validateSqlQuery(queryText)
        if (!postInjectionValidation.valid) {
          throw new Error(
            `Invalid SQL query after time range injection for query ${queryDef.refId}: ${postInjectionValidation.error}`
          )
        }
      }

      // Bind parameters to query
      const { bindParametersToQuery } = await import("./parameter-validation.service")
      const boundQuery = bindParametersToQuery(
        queryText,
        (queryDef.parameters || []) as Array<{
          name: string
          type: "string" | "number" | "boolean" | "date" | "timestamp" | "enum" | "string[]" | "number[]"
          required: boolean
          default?: unknown
        }>,
        queryParametersWithDefaults
      )

      // Execute query
      // Note: Graph execution bypasses admin check - authorization is handled at API route level
      const result = await databaseExplorationService.executeQuery(
        queryDef.dataSourceRef || graphData.dataSourceRef,
        workspaceId,
        boundQuery.query,
        1,
        1000,
        userId,
        accessToken,
        boundQuery.parameterValues,
        false // requireAdmin = false for graph execution
      )

      queryResults[queryDef.refId] = {
        data: result.rows,
        columns: result.columns,
      }
    }
  }

  // Evaluate expressions
  for (const exprDef of expressions) {
    if ("operation" in exprDef) {
      if (exprDef.operation === "math") {
        const result = evaluateMathExpression(exprDef.expression, queryResults)
        queryResults[exprDef.refId] = result
      } else {
        // TODO: Implement reduce and resample operations
        throw new Error(`Expression operation '${exprDef.operation}' not yet implemented`)
      }
    }
  }

  // Combine all results for visualization
  return combineQueryResults(queryResults, graphData.queries)
}

/**
 * Execute all graphs in a dashboard
 * Returns rendered dashboard data
 */
export async function executeDashboard(
  workspaceId: string,
  dashboardId: string, // Fragment ID
  globalParameters: Record<string, unknown>,
  userId: string,
  accessToken: string
): Promise<{
  dashboard: DashboardFragmentData
  tiles: Array<{
    graphRef: string
    position: { x: number; y: number; w: number; h: number }
    data: unknown[] | null
    columns: string[]
    error?: string
  }>
}> {
  // Get dashboard fragment from Usable (dashboardId is the fragment ID)
  const dashboard = await dashboardService.getDashboard(workspaceId, dashboardId, accessToken)
  if (!dashboard) {
    throw new Error(`Dashboard not found: ${dashboardId}`)
  }

  // Execute all graphs in dashboard
  const tileResults = await Promise.allSettled(
    dashboard.layout.tiles.map(async (tile) => {
      // Merge globalParameters with tile.parameterOverrides
      const mergedParameters = {
        ...globalParameters,
        ...tile.parameterOverrides,
      }

      try {
        // Call executeGraph for tile.graphRef
        const result = await executeGraph(workspaceId, tile.graphRef, mergedParameters, userId, accessToken)

        return {
          graphRef: tile.graphRef,
          position: tile.position,
          data: result.data,
          columns: result.columns,
        }
      } catch (error) {
        // Return error for this tile, but continue with others
        return {
          graphRef: tile.graphRef,
          position: tile.position,
          data: null,
          columns: [],
          error: error instanceof Error ? error.message : "Failed to execute graph",
        }
      }
    })
  )

  // Process results (handle both fulfilled and rejected promises)
  const tiles = tileResults.map((result) => {
    if (result.status === "fulfilled") {
      return result.value
    } else {
      // This shouldn't happen since we catch errors in executeGraph, but handle it anyway
      return {
        graphRef: "",
        position: { x: 0, y: 0, w: 1, h: 1 },
        data: null,
        columns: [],
        error: result.reason instanceof Error ? result.reason.message : "Unknown error",
      }
    }
  })

  return {
    dashboard,
    tiles,
  }
}

/**
 * Validate parameters against graph schema
 */
export function validateGraphParameters(
  graph: GraphFragmentData,
  providedParameters: Record<string, unknown>
): { valid: boolean; errors?: Array<{ parameter: string; error: string }> } {
  return validateParameters(graph.parameterSchema, providedParameters)
}
