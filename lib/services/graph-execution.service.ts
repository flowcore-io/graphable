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

  // Mock implementation - will be replaced with actual worker service call
  // Worker service endpoint structure is TBD per plan

  // Validate parameters
  // TODO: Get parameter schema from graph fragment
  // For MVP, we'll skip validation if schema is not available

  // Bind parameters to query
  // TODO: Get query from graph fragment and bind parameters

  // Call worker service connector API endpoint
  // TODO: Implement actual worker service call
  // Example structure (TBD):
  // const response = await fetch(`${WORKER_SERVICE_URL}/connectors/${connectorRef}/execute`, {
  //   method: "POST",
  //   headers: {
  //     "Authorization": `Bearer ${accessToken}`,
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify({
  //     query: boundQuery.query,
  //     parameters: boundQuery.parameterValues,
  //     dataSourceRef: graph.dataSourceRef,
  //   }),
  // })

  // Mock response for MVP
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
  }>
}> {
  // Get dashboard fragment from Usable (dashboardId is the fragment ID)
  const dashboard = await dashboardService.getDashboard(workspaceId, dashboardId, accessToken)
  if (!dashboard) {
    throw new Error(`Dashboard not found: ${dashboardId}`)
  }

  // Execute all graphs in dashboard
  // TODO: Implement actual execution
  // For each tile in dashboard.layout.tiles:
  //   1. Merge globalParameters with tile.parameterOverrides
  //   2. Call executeGraph for tile.graphRef
  //   3. Collect results

  // Mock response for MVP
  return {
    dashboard: {
      id: "00000000000000000000000000", // Mock ID for development
      layout: {
        grid: { columns: 12, rows: 8 },
        tiles: [],
      },
    },
    tiles: [],
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
