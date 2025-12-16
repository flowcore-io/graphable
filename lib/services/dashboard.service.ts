import type { SessionPathwayBuilder } from "@flowcore/pathways"
import { randomUUID } from "crypto"
import { ulid } from "ulid"
import * as dashboardContract from "../pathways/contracts/dashboard.0"
import { usableApi } from "./usable-api.service"

const GRAPHABLE_VERSION = "0.2.0"
const GRAPHABLE_APP_TAG = "app:graphable"

/**
 * Dashboard fragment structure (stored in Usable)
 * Fragment ID is used as the dashboard ID (no separate UUID)
 */
export interface DashboardFragmentData {
  id: string // Sortable UUID (ULID) for the fragment
  folderId?: string // Fragment ID of parent folder (if any)
  layout: {
    grid: {
      columns: number
      rows: number
    }
    tiles: Array<{
      graphRef: string // Fragment ID of graph
      position: { x: number; y: number; w: number; h: number }
      parameterOverrides?: Record<string, unknown> // Per-tile parameter overrides
    }>
  }
  globalParameters?: Record<string, unknown> // Dashboard-level parameter values
  permissions?: {
    viewers?: string[] // Usable user IDs
    allowedParameters?: string[] // Parameter names viewers can modify
  }
}

/**
 * Dashboard creation input
 */
export interface CreateDashboardInput {
  title?: string
  folderId?: string
  layout: {
    grid: {
      columns: number
      rows: number
    }
    tiles: Array<{
      graphRef: string
      position: { x: number; y: number; w: number; h: number }
      parameterOverrides?: Record<string, unknown>
    }>
  }
  globalParameters?: Record<string, unknown>
  permissions?: {
    viewers?: string[]
    allowedParameters?: string[]
  }
}

/**
 * Dashboard update input
 */
export interface UpdateDashboardInput extends Partial<CreateDashboardInput> {}

/**
 * Create a dashboard fragment and emit dashboard.created.0 event
 * Mutation function - requires SessionPathway
 */
export async function createDashboard(
  sessionPathway: SessionPathwayBuilder<any>,
  workspaceId: string,
  dashboardData: CreateDashboardInput,
  accessToken: string
): Promise<{ dashboardId: string; status: "processing" }> {
  // Get fragment type ID for "dashboards"
  const fragmentTypeId = await usableApi.getFragmentTypeIdByName(workspaceId, "dashboards", accessToken)
  if (!fragmentTypeId) {
    throw new Error("Fragment type 'dashboards' not found. Please ensure workspace is bootstrapped.")
  }

  // Generate sortable UUID for the fragment content
  const fragmentUlid = ulid()

  // Create fragment content with ULID and folderId
  const fragmentContent: DashboardFragmentData = {
    id: fragmentUlid,
    folderId: dashboardData.folderId, // Store folderId in fragment content
    ...dashboardData,
  }

  // Create fragment in Usable
  const fragment = await usableApi.createFragment(
    workspaceId,
    {
      workspaceId,
      title: dashboardData.title || "Dashboard",
      content: JSON.stringify(fragmentContent, null, 2),
      summary: dashboardData.title
        ? `${dashboardData.title} - ${dashboardData.layout.tiles.length} graph tiles`
        : `Dashboard with ${dashboardData.layout.tiles.length} graph tiles`,
      tags: [GRAPHABLE_APP_TAG, "type:dashboard", `version:${GRAPHABLE_VERSION}`],
      fragmentTypeId,
      repository: "graphable",
    },
    accessToken
  )

  if (!fragment || !fragment.id) {
    throw new Error("Failed to create dashboard fragment: fragment creation returned invalid result")
  }

  // Use fragment ID as dashboard ID (no separate UUID)
  const dashboardId = fragment.id

  // Emit dashboard.created.0 event via Session Pathways
  await (sessionPathway as any).write(
    `${dashboardContract.FlowcoreDashboard.flowType}/${dashboardContract.FlowcoreDashboard.eventType.created}`,
    {
      data: {
        dashboardId, // Fragment ID
        fragmentId: dashboardId, // Same as dashboardId now
        workspaceId,
        folderId: dashboardData.folderId,
        occurredAt: new Date().toISOString(),
        initiatedBy: (sessionPathway as any).getUserResolver
          ? (await (sessionPathway as any).getUserResolver()).entityId
          : "system",
        requestId: randomUUID(),
      },
    }
  )

  return { dashboardId, status: "processing" }
}

/**
 * Update a dashboard fragment and emit dashboard.updated.0 event
 * Mutation function - requires SessionPathway
 */
export async function updateDashboard(
  sessionPathway: SessionPathwayBuilder<any>,
  workspaceId: string,
  dashboardId: string, // Fragment ID
  dashboardData: UpdateDashboardInput,
  accessToken: string
): Promise<{ dashboardId: string; status: "processing" }> {
  // Get fragment from Usable (dashboardId is the fragment ID)
  const fragment = await usableApi.getFragment(workspaceId, dashboardId, accessToken)
  if (!fragment) {
    throw new Error(`Dashboard not found: ${dashboardId}`)
  }

  const existingData: DashboardFragmentData = JSON.parse(fragment.content || "{}")

  // Merge updates, preserving the ID and including folderId
  const updatedData: DashboardFragmentData = {
    ...existingData,
    ...dashboardData,
    id: existingData.id, // Preserve the existing ID
    folderId: dashboardData.folderId !== undefined ? dashboardData.folderId : existingData.folderId, // Update folderId in content
    layout: dashboardData.layout || existingData.layout,
  }

  // Update fragment in Usable
  await usableApi.updateFragment(
    workspaceId,
    dashboardId, // Fragment ID
    {
      title: dashboardData.title !== undefined ? dashboardData.title : fragment.title,
      content: JSON.stringify(updatedData, null, 2),
      summary: dashboardData.title
        ? `${dashboardData.title} - ${updatedData.layout.tiles.length} graph tiles`
        : `Dashboard with ${updatedData.layout.tiles.length} graph tiles`,
    },
    accessToken
  )

  // Emit dashboard.updated.0 event via Session Pathways
  await (sessionPathway as any).write(
    `${dashboardContract.FlowcoreDashboard.flowType}/${dashboardContract.FlowcoreDashboard.eventType.updated}`,
    {
      data: {
        dashboardId, // Fragment ID
        fragmentId: dashboardId, // Same as dashboardId
        workspaceId,
        folderId: updatedData.folderId,
        occurredAt: new Date().toISOString(),
        initiatedBy: (sessionPathway as any).getUserResolver
          ? (await (sessionPathway as any).getUserResolver()).entityId
          : "system",
        requestId: randomUUID(),
      },
    }
  )

  return { dashboardId, status: "processing" }
}

/**
 * Delete a dashboard fragment and emit dashboard.deleted.0 event
 * Mutation function - requires SessionPathway
 */
export async function deleteDashboard(
  sessionPathway: SessionPathwayBuilder<any>,
  workspaceId: string,
  dashboardId: string, // Fragment ID
  accessToken: string
): Promise<{ dashboardId: string; status: "processing" }> {
  // Verify dashboard exists by fetching fragment
  const fragment = await usableApi.getFragment(workspaceId, dashboardId, accessToken)
  if (!fragment) {
    throw new Error(`Dashboard not found: ${dashboardId}`)
  }

  // Delete fragment from Usable
  await usableApi.deleteFragment(workspaceId, dashboardId, accessToken)

  // Emit dashboard.deleted.0 event via Session Pathways
  await (sessionPathway as any).write(
    `${dashboardContract.FlowcoreDashboard.flowType}/${dashboardContract.FlowcoreDashboard.eventType.deleted}`,
    {
      data: {
        dashboardId, // Fragment ID
        fragmentId: dashboardId, // Same as dashboardId
        workspaceId,
        occurredAt: new Date().toISOString(),
        initiatedBy: (sessionPathway as any).getUserResolver
          ? (await (sessionPathway as any).getUserResolver()).entityId
          : "system",
        requestId: randomUUID(),
      },
    }
  )

  return { dashboardId, status: "processing" }
}

/**
 * Dashboard with metadata (for display)
 */
export interface DashboardWithMetadata extends DashboardFragmentData {
  title: string
  summary?: string
  fragmentId: string
}

/**
 * Get dashboard fragment from Usable API and load referenced graphs
 * Read function - no SessionPathway needed
 */
export async function getDashboard(
  workspaceId: string,
  dashboardId: string, // Fragment ID
  accessToken: string
): Promise<DashboardWithMetadata | null> {
  // Get fragment directly from Usable (dashboardId is the fragment ID)
  const fragment = await usableApi.getFragment(workspaceId, dashboardId, accessToken)
  if (!fragment) {
    return null
  }

  const parsed = JSON.parse((fragment as any).content || "{}") as Partial<DashboardFragmentData>

  // Ensure layout exists with default structure if missing
  if (!parsed.layout) {
    parsed.layout = {
      grid: {
        columns: 12,
        rows: 8,
      },
      tiles: [],
    }
  }

  return {
    ...(parsed as DashboardFragmentData),
    title: fragment.title || "Dashboard", // Fallback to "Dashboard" if title is missing
    summary: fragment.summary,
    fragmentId: fragment.id,
  }
}

/**
 * List dashboards for a workspace
 * Read function - no SessionPathway needed
 */
export async function listDashboards(
  workspaceId: string,
  accessToken: string
): Promise<Array<{ id: string; fragmentId: string; title: string; folderId?: string | null }>> {
  // Get fragment type ID for "dashboards" to ensure proper filtering
  const fragmentTypeId = await usableApi.getFragmentTypeIdByName(workspaceId, "dashboards", accessToken)

  // If fragment type doesn't exist, return empty array (workspace not bootstrapped)
  if (!fragmentTypeId) {
    console.warn("Fragment type 'dashboards' not found. Workspace may not be bootstrapped.")
    return []
  }

  // List fragments by fragmentTypeId AND tags (double filtering for safety)
  const fragments = await usableApi.listFragments(
    workspaceId,
    {
      fragmentTypeId, // Required - ensures strict filtering by fragment type
      tags: [GRAPHABLE_APP_TAG, "type:dashboard"],
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

  // Parse folderId from fragment content (no cache needed)
  return validFragments.map((fragment) => {
    let folderId: string | null | undefined
    try {
      const content = JSON.parse(fragment.content || "{}") as Partial<DashboardFragmentData>
      folderId = content.folderId || null
    } catch {
      // If parsing fails, folderId remains undefined
    }

    return {
      id: fragment.id, // Fragment ID is the dashboard ID
      fragmentId: fragment.id,
      title: fragment.title,
      folderId,
    }
  })
}

/**
 * Get dashboards by folder ID
 * Read function - no SessionPathway needed
 */
export async function getDashboardsByFolder(
  workspaceId: string,
  folderId: string | null,
  accessToken: string
): Promise<Array<{ id: string; fragmentId: string; title: string }>> {
  const allDashboards = await listDashboards(workspaceId, accessToken)
  return allDashboards.filter((d) => (folderId === null ? !d.folderId : d.folderId === folderId))
}

/**
 * Get dashboard from database cache (fast lookup)
 * Read function - no SessionPathway needed
 */
// Cache removed - all data comes from Usable fragments
