import type { SessionPathwayBuilder } from "@flowcore/pathways"
import { randomUUID } from "crypto"
import { ulid } from "ulid"
import * as graphContract from "../pathways/contracts/graph.0"
import { usableApi } from "./usable-api.service"

const GRAPHABLE_VERSION = "0.2.0"
const GRAPHABLE_APP_TAG = "app:graphable"

/**
 * Graph fragment structure (stored in Usable)
 */
export interface GraphFragmentData {
  id: string // Sortable UUID (ULID) for the fragment
  title: string // Graph title/name
  dataSourceRef: string
  connectorRef?: string
  query: {
    dialect: "sql"
    text: string
    parameters: ParameterDefinition[]
  }
  parameterSchema: {
    parameters: ParameterDefinition[]
  }
  visualization: {
    type: "line" | "bar" | "table" | "pie" | "scatter" | "area"
    options: Record<string, unknown>
  }
  cachePolicy?: {
    ttl?: number
  }
}

/**
 * Parameter definition for graphs
 */
export interface ParameterDefinition {
  name: string
  type: "string" | "number" | "boolean" | "date" | "timestamp" | "enum" | "string[]" | "number[]"
  required: boolean
  default?: unknown
  enumValues?: string[]
  min?: number
  max?: number
  pattern?: string
}

/**
 * Graph creation input
 */
export interface CreateGraphInput {
  title: string // Graph title/name
  dataSourceRef: string
  connectorRef?: string
  query: {
    dialect: "sql"
    text: string
    parameters: ParameterDefinition[]
  }
  parameterSchema: {
    parameters: ParameterDefinition[]
  }
  visualization: {
    type: "line" | "bar" | "table" | "pie" | "scatter" | "area"
    options: Record<string, unknown>
  }
  cachePolicy?: {
    ttl?: number
  }
}

/**
 * Graph update input
 */
export interface UpdateGraphInput extends Partial<CreateGraphInput> {}

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

  // Create fragment content with ULID
  const fragmentContent: GraphFragmentData = {
    id: fragmentContentUlid,
    title: graphData.title,
    ...graphData,
  }

  // Generate deterministic key for lookup (format: graph:<ulid>)
  const fragmentKey = `graph:${fragmentContentUlid}`

  // Create fragment in Usable
  const fragment = await usableApi.createFragment(
    workspaceId,
    {
      workspaceId,
      title: graphData.title,
      key: fragmentKey,
      content: JSON.stringify(fragmentContent, null, 2),
      summary: `Graph: ${graphData.title}`,
      tags: [GRAPHABLE_APP_TAG, "type:graph", `version:${GRAPHABLE_VERSION}`, `workspace:${workspaceId}`],
      fragmentTypeId,
      repository: "graphable",
    },
    accessToken
  )

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
        dataSourceRef: graphData.dataSourceRef,
        connectorRef: graphData.connectorRef,
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

  const existingData: GraphFragmentData = JSON.parse(fragment.content || "{}")

  // Full content replacement: merge updates, preserving the ID
  const updatedData: GraphFragmentData = {
    ...existingData,
    ...graphData,
    id: existingData.id, // Preserve the existing ID
    title: graphData.title !== undefined ? graphData.title : existingData.title, // Update title if provided
    query: graphData.query || existingData.query,
    parameterSchema: graphData.parameterSchema || existingData.parameterSchema,
    visualization: graphData.visualization || existingData.visualization,
  }

  // Update fragment in Usable using full content replacement
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
        dataSourceRef: updatedData.dataSourceRef,
        connectorRef: updatedData.connectorRef,
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

  const parsed = JSON.parse(fragment.content || "{}") as Partial<GraphFragmentData>

  return {
    ...(parsed as GraphFragmentData),
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
      const content = JSON.parse(fragment.content || "{}") as Partial<GraphFragmentData>
      title = content.title || fragment.title || "Untitled Graph"
      dataSourceRef = content.dataSourceRef || "unknown"
      visualizationType = content.visualization?.type || "table"
      parameterCount = content.parameterSchema?.parameters?.length || 0
    } catch {
      // If parsing fails, use defaults
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
