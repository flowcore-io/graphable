import type { SessionPathwayBuilder } from "@flowcore/pathways"
import { randomUUID } from "crypto"
import { ulid } from "ulid"
import { z } from "zod"
import * as dashboardContract from "../pathways/contracts/dashboard.0"
import { usableApi } from "./usable-api.service"

const GRAPHABLE_VERSION = "0.2.0"
const GRAPHABLE_APP_TAG = "app:graphable"

/**
 * Zod schema for dashboard tile position
 */
const tilePositionSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
})

/**
 * Zod schema for dashboard tile
 */
const dashboardTileSchema = z.object({
  graphRef: z.string().uuid("Graph reference must be a valid UUID"),
  position: tilePositionSchema,
  parameterOverrides: z.record(z.unknown()).optional(),
})

/**
 * Zod schema for dashboard layout
 */
const dashboardLayoutSchema = z.object({
  grid: z.object({
    columns: z.number().int().min(1).max(24),
    rows: z.number().int().min(1).max(100),
  }),
  tiles: z.array(dashboardTileSchema),
})

/**
 * Zod schema for dashboard fragment content (stored in Usable fragment.content)
 *
 * ARCHITECTURAL NOTE:
 * - All configuration data MUST be in the JSON content (fragment.content)
 * - fragment.title, fragment.summary, and fragment frontmatter are for Usable convenience and AI search
 * - These metadata fields should be synced from the JSON content for consistency
 * - The JSON content is the source of truth for all configuration
 */
export const dashboardFragmentDataSchema = z.object({
  id: z.string().min(1, "ID is required"),
  title: z.string().min(1, "Title is required"), // Title is stored in JSON content (source of truth)
  description: z.string().optional(), // Description is stored in JSON content (source of truth)
  folderId: z.string().uuid("Folder ID must be a valid UUID").nullish(), // nullish allows null, undefined, or string UUID
  layout: dashboardLayoutSchema,
  globalParameters: z.record(z.unknown()).optional(),
  permissions: z
    .object({
      viewers: z.array(z.string()).optional(),
      allowedParameters: z.array(z.string()).optional(),
    })
    .optional(),
})

/**
 * Dashboard fragment structure (stored in Usable)
 * Fragment ID is used as the dashboard ID (no separate UUID)
 *
 * ARCHITECTURAL NOTE:
 * - All configuration data is in the JSON content (fragment.content)
 * - fragment.title is synced from content.title for Usable search convenience
 * - The JSON content is the source of truth
 */
export type DashboardFragmentData = z.infer<typeof dashboardFragmentDataSchema>

/**
 * Zod schema for creating a dashboard
 * Title is required and stored in JSON content (source of truth)
 */
export const createDashboardInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  folderId: z.string().uuid("Folder ID must be a valid UUID").nullish(), // nullish allows null, undefined, or string
  layout: dashboardLayoutSchema,
  globalParameters: z.record(z.unknown()).optional(),
  permissions: z
    .object({
      viewers: z.array(z.string()).optional(),
      allowedParameters: z.array(z.string()).optional(),
    })
    .optional(),
})

/**
 * Dashboard creation input
 * Title is stored in JSON content (source of truth), synced to fragment.title for search
 */
export type CreateDashboardInput = z.infer<typeof createDashboardInputSchema>

/**
 * Zod schema for updating a dashboard
 */
export const updateDashboardInputSchema = createDashboardInputSchema.partial()

/**
 * Dashboard update input
 * Title is stored in JSON content (source of truth), synced to fragment.title for search
 */
export type UpdateDashboardInput = z.infer<typeof updateDashboardInputSchema>

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

  // Validate input data
  const validatedData = createDashboardInputSchema.parse(dashboardData)

  // Create fragment content with ULID, title, description, and folderId
  // Title and description are stored in JSON content (source of truth)
  const fragmentContent: DashboardFragmentData = {
    id: fragmentUlid,
    title: validatedData.title, // Title is in JSON content (source of truth)
    description: validatedData.description, // Description is in JSON content (source of truth)
    folderId: validatedData.folderId,
    layout: validatedData.layout,
    globalParameters: validatedData.globalParameters,
    permissions: validatedData.permissions,
  }

  // Validate the content structure
  const validatedContent = dashboardFragmentDataSchema.parse(fragmentContent)

  // Create fragment in Usable
  // Sync title to fragment.title for Usable search convenience (content.title is source of truth)
  const fragment = await usableApi.createFragment(
    workspaceId,
    {
      workspaceId,
      title: validatedContent.title, // Sync from content for search
      content: JSON.stringify(validatedContent, null, 2),
      summary: `${validatedContent.title} - ${validatedContent.layout.tiles.length} graph tiles`,
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
        folderId: validatedData.folderId,
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

  // Validate and parse existing fragment content
  let existingData: DashboardFragmentData
  try {
    const parsed = JSON.parse(fragment.content || "{}")
    existingData = dashboardFragmentDataSchema.parse(parsed)
  } catch (error) {
    console.error("Failed to parse existing dashboard fragment content:", error)
    throw new Error(`Invalid dashboard fragment content: ${error instanceof Error ? error.message : "Unknown error"}`)
  }

  // Validate update input
  const validatedUpdate = updateDashboardInputSchema.parse(dashboardData)

  // Ensure layout exists with default structure if missing
  const existingLayout = existingData.layout || {
    grid: {
      columns: 12,
      rows: 8,
    },
    tiles: [],
  }

  // Merge updates, preserving the ID
  // Title and description are stored in JSON content (source of truth)
  const updatedData: DashboardFragmentData = {
    id: existingData.id, // Preserve the existing ID
    title: validatedUpdate.title !== undefined ? validatedUpdate.title : existingData.title, // Title from content
    description: validatedUpdate.description !== undefined ? validatedUpdate.description : existingData.description, // Description from content
    folderId: validatedUpdate.folderId !== undefined ? validatedUpdate.folderId : existingData.folderId,
    layout: validatedUpdate.layout || existingLayout,
    globalParameters:
      validatedUpdate.globalParameters !== undefined ? validatedUpdate.globalParameters : existingData.globalParameters,
    permissions: validatedUpdate.permissions !== undefined ? validatedUpdate.permissions : existingData.permissions,
  }

  // Validate the merged data
  const validatedUpdatedData = dashboardFragmentDataSchema.parse(updatedData)

  // Update fragment in Usable
  // Sync title to fragment.title for Usable search convenience (content.title is source of truth)
  await usableApi.updateFragment(
    workspaceId,
    dashboardId, // Fragment ID
    {
      title: validatedUpdatedData.title, // Sync from content for search
      content: JSON.stringify(validatedUpdatedData, null, 2),
      summary: validatedUpdatedData.description
        ? validatedUpdatedData.description
        : `${validatedUpdatedData.title} - ${validatedUpdatedData.layout.tiles.length} graph tiles`,
    },
    accessToken
  )

  // Log for debugging - verify title was updated
  if (validatedUpdate.title !== undefined) {
    console.log(`✅ Dashboard title updated: "${existingData.title}" → "${validatedUpdatedData.title}"`)
  }

  // Emit dashboard.updated.0 event via Session Pathways
  if (!sessionPathway) {
    throw new Error("Session pathway is required for updating dashboard")
  }

  const eventType = `${dashboardContract.FlowcoreDashboard.flowType}/${dashboardContract.FlowcoreDashboard.eventType.updated}`

  // Build event data, only including folderId if it's defined (not null or undefined)
  const eventData: {
    dashboardId: string
    fragmentId: string
    workspaceId: string
    folderId?: string
    occurredAt: string
    initiatedBy: string
    requestId: string
  } = {
    dashboardId, // Fragment ID
    fragmentId: dashboardId, // Same as dashboardId
    workspaceId,
    occurredAt: new Date().toISOString(),
    initiatedBy: (sessionPathway as any).getUserResolver
      ? (await (sessionPathway as any).getUserResolver()).entityId
      : "system",
    requestId: randomUUID(),
  }

  // Only include folderId if it's a valid string (not null or undefined)
  if (validatedUpdatedData.folderId) {
    eventData.folderId = validatedUpdatedData.folderId
  }

  await (sessionPathway as any).write(eventType, { data: eventData })

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

  // Parse and validate fragment content
  // Title comes from JSON content (source of truth), not fragment.title
  // Strict validation - no fallbacks
  if (!fragment.content || fragment.content.trim() === "") {
    throw new Error(
      `Dashboard fragment ${dashboardId} has empty content. This should not happen - dashboard may not have been created correctly.`
    )
  }

  const parsed = JSON.parse(fragment.content)
  const parsedData = dashboardFragmentDataSchema.parse(parsed)

  // Title comes from JSON content (source of truth)
  // fragment.title is just for search convenience and may be out of sync
  return {
    ...parsedData,
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
