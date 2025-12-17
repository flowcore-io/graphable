import type { DashboardFragmentData } from "./dashboard.service"
import * as dashboardService from "./dashboard.service"
import type { GraphFragmentData } from "./graph.service"
import * as graphService from "./graph.service"
import { validateParameters } from "./parameter-validation.service"

/**
 * Execute a graph query via worker service
 * Returns result data for visualization
 */
export async function executeGraph(
  workspaceId: string,
  graphId: string, // Fragment ID
  parameters: Record<string, unknown>,
  accessToken: string
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

  // Bind parameters to query safely
  const { bindParametersToQuery } = await import("./parameter-validation.service")
  const boundQuery = bindParametersToQuery(
    graph.query.text,
    graph.query.parameters || graph.parameterSchema.parameters,
    parametersWithDefaults
  )

  // TODO: Call worker service connector API endpoint
  // Worker service endpoint structure is TBD per plan (FR6)
  // Example structure (TBD):
  // const WORKER_SERVICE_URL = process.env.WORKER_SERVICE_URL || "http://localhost:3001"
  // const response = await fetch(`${WORKER_SERVICE_URL}/connectors/${graph.connectorRef || graph.dataSourceRef}/execute`, {
  //   method: "POST",
  //   headers: {
  //     "Authorization": `Bearer ${accessToken}`,
  //     "Content-Type": "application/json",
  //     "X-Workspace-Id": workspaceId,
  //   },
  //   body: JSON.stringify({
  //     query: boundQuery.query,
  //     parameters: boundQuery.parameterValues,
  //     dataSourceRef: graph.dataSourceRef,
  //     connectorRef: graph.connectorRef,
  //   }),
  // })
  //
  // if (!response.ok) {
  //   const errorData = await response.json()
  //   throw new Error(errorData.error || "Failed to execute query")
  // }
  //
  // const result = await response.json()
  // return {
  //   data: result.data || [],
  //   columns: result.columns || [],
  // }

  // Mock response for MVP until worker service is ready
  return {
    data: [],
    columns: [],
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
  accessToken: string
): Promise<{ data: unknown[]; columns: string[] }> {
  // Apply default values for missing optional parameters
  const parametersWithDefaults: Record<string, unknown> = { ...parameters }
  for (const paramDef of graphData.query.parameters) {
    if (parametersWithDefaults[paramDef.name] === undefined && paramDef.default !== undefined) {
      parametersWithDefaults[paramDef.name] = paramDef.default
    }
  }

  // Bind parameters to query safely
  const { bindParametersToQuery } = await import("./parameter-validation.service")
  const boundQuery = bindParametersToQuery(graphData.query.text, graphData.query.parameters, parametersWithDefaults)

  // TODO: Call worker service connector API endpoint
  // Worker service endpoint structure is TBD per plan (FR6)
  // For now, return mock response
  // Mock response for MVP until worker service is ready
  return {
    data: [],
    columns: [],
  }
}

/**
 * Execute all graphs in a dashboard
 * Returns rendered dashboard data
 */
export async function executeDashboard(
  workspaceId: string,
  dashboardId: string, // Fragment ID
  globalParameters: Record<string, unknown>,
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
        const result = await executeGraph(workspaceId, tile.graphRef, mergedParameters, accessToken)

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
