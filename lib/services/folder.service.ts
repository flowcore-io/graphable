import type { SessionPathwayBuilder } from "@flowcore/pathways"
import { randomUUID } from "crypto"
import { ulid } from "ulid"
import { z } from "zod"
import * as folderContract from "../pathways/contracts/folder.0"
import { usableApi } from "./usable-api.service"

const GRAPHABLE_VERSION = "0.2.0"
const GRAPHABLE_APP_TAG = "app:graphable"

/**
 * Zod schema for folder fragment content (stored in Usable fragment.content)
 *
 * ARCHITECTURAL NOTE:
 * - All configuration data MUST be in the JSON content (fragment.content)
 * - fragment.title, fragment.summary, and fragment frontmatter are for Usable convenience and AI search
 * - These metadata fields should be synced from the JSON content for consistency
 * - The JSON content is the source of truth for all configuration
 */
export const folderFragmentDataSchema = z.object({
  id: z.string().min(1, "ID is required"), // Sortable UUID (ULID) for the fragment
  name: z.string().min(1, "Name is required"), // Name is stored in JSON content (source of truth)
  parentFolderId: z.string().uuid("Parent folder ID must be a valid UUID").optional(), // Fragment ID of parent folder (if any)
})

/**
 * Folder fragment structure (stored in Usable)
 * Fragment ID is used as the folder ID (no separate UUID)
 */
export type FolderFragmentData = z.infer<typeof folderFragmentDataSchema>

/**
 * Zod schema for creating a folder
 */
export const createFolderInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  parentFolderId: z.string().uuid("Parent folder ID must be a valid UUID").optional(),
})

/**
 * Folder creation input
 */
export type CreateFolderInput = z.infer<typeof createFolderInputSchema>

/**
 * Zod schema for updating a folder
 */
export const updateFolderInputSchema = z.object({
  name: z.string().min(1).optional(),
  parentFolderId: z.string().uuid("Parent folder ID must be a valid UUID").optional(),
})

/**
 * Folder update input
 */
export type UpdateFolderInput = z.infer<typeof updateFolderInputSchema>

/**
 * Folder with metadata (for display)
 */
export interface FolderWithMetadata extends FolderFragmentData {
  title: string
  summary?: string
  fragmentId: string
}

/**
 * Folder list item (from Usable fragments)
 */
export interface FolderListItem {
  id: string // Fragment ID (used as folder ID)
  fragmentId: string // Same as id (for compatibility)
  name: string
  parentFolderId?: string | null // Fragment ID of parent folder
  title: string
}

/**
 * Folder tree node (hierarchical structure)
 */
export interface FolderTreeNode extends FolderListItem {
  children?: FolderTreeNode[]
}

/**
 * Create a folder fragment and emit folder.created.0 event
 * Mutation function - requires SessionPathway
 */
export async function createFolder(
  sessionPathway: SessionPathwayBuilder<any>,
  workspaceId: string,
  folderData: CreateFolderInput,
  accessToken: string
): Promise<{ folderId: string; status: "processing" }> {
  // Get fragment type ID for "dashboard-folders"
  const fragmentTypeId = await usableApi.getFragmentTypeIdByName(workspaceId, "dashboard-folders", accessToken)
  if (!fragmentTypeId) {
    throw new Error("Fragment type 'dashboard-folders' not found. Please ensure workspace is bootstrapped.")
  }

  // Generate sortable UUID for the fragment content
  const fragmentUlid = ulid()

  // Validate input data
  const validatedData = createFolderInputSchema.parse(folderData)

  // Create fragment content with ULID
  // Name is stored in JSON content (source of truth)
  const fragmentContent: FolderFragmentData = {
    id: fragmentUlid,
    name: validatedData.name, // Name is in JSON content (source of truth)
    parentFolderId: validatedData.parentFolderId, // Fragment ID of parent folder
  }

  // Validate the content structure
  const validatedContent = folderFragmentDataSchema.parse(fragmentContent)

  // Create fragment in Usable
  // Sync name to fragment.title for Usable search convenience (content.name is source of truth)
  const fragment = await usableApi.createFragment(
    workspaceId,
    {
      workspaceId,
      title: validatedContent.name, // Sync from content for search
      content: JSON.stringify(validatedContent, null, 2),
      summary: `Folder: ${validatedContent.name}`,
      tags: [GRAPHABLE_APP_TAG, "type:folder", `version:${GRAPHABLE_VERSION}`],
      fragmentTypeId,
      repository: "graphable",
    },
    accessToken
  )

  if (!fragment || !fragment.id) {
    throw new Error("Failed to create folder fragment: fragment creation returned invalid result")
  }

  // Use fragment ID as folder ID (no separate UUID)
  const folderId = fragment.id

  // Emit folder.created.0 event via Session Pathways
  await (sessionPathway as any).write(
    `${folderContract.FlowcoreFolder.flowType}/${folderContract.FlowcoreFolder.eventType.created}`,
    {
      data: {
        folderId, // Fragment ID
        fragmentId: folderId, // Same as folderId
        workspaceId,
        name: folderData.name,
        parentFolderId: folderData.parentFolderId,
        occurredAt: new Date().toISOString(),
        initiatedBy: (sessionPathway as any).getUserResolver
          ? (await (sessionPathway as any).getUserResolver()).entityId
          : "system",
        requestId: randomUUID(),
      },
    }
  )

  return { folderId, status: "processing" }
}

/**
 * Update a folder fragment and emit folder.updated.0 event
 * Mutation function - requires SessionPathway
 */
export async function updateFolder(
  sessionPathway: SessionPathwayBuilder<any>,
  workspaceId: string,
  folderId: string, // Fragment ID
  folderData: UpdateFolderInput,
  accessToken: string
): Promise<{ folderId: string; status: "processing" }> {
  // Get fragment from Usable (folderId is the fragment ID)
  const fragment = await usableApi.getFragment(workspaceId, folderId, accessToken)
  if (!fragment) {
    throw new Error(`Folder not found: ${folderId}`)
  }

  // Validate and parse existing fragment content
  let existingData: FolderFragmentData
  try {
    const parsed = JSON.parse(fragment.content || "{}")
    existingData = folderFragmentDataSchema.parse(parsed)
  } catch (error) {
    console.error("Failed to parse existing folder fragment content:", error)
    throw new Error(`Invalid folder fragment content: ${error instanceof Error ? error.message : "Unknown error"}`)
  }

  // Validate update input
  const validatedUpdate = updateFolderInputSchema.parse(folderData)

  // Merge updates, preserving the ID
  // Name is stored in JSON content (source of truth)
  const updatedData: FolderFragmentData = {
    id: existingData.id, // Preserve the existing ID
    name: validatedUpdate.name !== undefined ? validatedUpdate.name : existingData.name, // Name from content
    parentFolderId:
      validatedUpdate.parentFolderId !== undefined ? validatedUpdate.parentFolderId : existingData.parentFolderId,
  }

  // Validate the merged data
  const validatedUpdatedData = folderFragmentDataSchema.parse(updatedData)

  // Update fragment in Usable
  // Sync name to fragment.title for Usable search convenience (content.name is source of truth)
  await usableApi.updateFragment(
    workspaceId,
    folderId, // Fragment ID
    {
      content: JSON.stringify(validatedUpdatedData, null, 2),
      title: validatedUpdatedData.name, // Sync from content for search
      summary: `Folder: ${validatedUpdatedData.name}`,
    },
    accessToken
  )

  // Emit folder.updated.0 event via Session Pathways
  await (sessionPathway as any).write(
    `${folderContract.FlowcoreFolder.flowType}/${folderContract.FlowcoreFolder.eventType.updated}`,
    {
      data: {
        folderId, // Fragment ID
        fragmentId: folderId, // Same as folderId
        workspaceId,
        name: validatedUpdatedData.name,
        parentFolderId: validatedUpdatedData.parentFolderId,
        occurredAt: new Date().toISOString(),
        initiatedBy: (sessionPathway as any).getUserResolver
          ? (await (sessionPathway as any).getUserResolver()).entityId
          : "system",
        requestId: randomUUID(),
      },
    }
  )

  return { folderId, status: "processing" }
}

/**
 * Delete a folder fragment and emit folder.deleted.0 event
 * Mutation function - requires SessionPathway
 */
export async function deleteFolder(
  sessionPathway: SessionPathwayBuilder<any>,
  workspaceId: string,
  folderId: string, // Fragment ID
  accessToken: string
): Promise<{ folderId: string; status: "processing" }> {
  // Verify folder exists by fetching fragment
  const fragment = await usableApi.getFragment(workspaceId, folderId, accessToken)
  if (!fragment) {
    throw new Error(`Folder not found: ${folderId}`)
  }

  // Delete fragment from Usable
  await usableApi.deleteFragment(workspaceId, folderId, accessToken)

  // Emit folder.deleted.0 event via Session Pathways
  await (sessionPathway as any).write(
    `${folderContract.FlowcoreFolder.flowType}/${folderContract.FlowcoreFolder.eventType.deleted}`,
    {
      data: {
        folderId, // Fragment ID
        fragmentId: folderId, // Same as folderId
        workspaceId,
        occurredAt: new Date().toISOString(),
        initiatedBy: (sessionPathway as any).getUserResolver
          ? (await (sessionPathway as any).getUserResolver()).entityId
          : "system",
        requestId: randomUUID(),
      },
    }
  )

  return { folderId, status: "processing" }
}

/**
 * Get folder fragment from Usable API
 * Read function - no SessionPathway needed
 */
export async function getFolder(
  workspaceId: string,
  folderId: string, // Fragment ID
  accessToken: string
): Promise<FolderWithMetadata | null> {
  // Get fragment directly from Usable (folderId is the fragment ID)
  const fragment = await usableApi.getFragment(workspaceId, folderId, accessToken)
  if (!fragment) {
    return null
  }

  // Validate and parse fragment content
  let parsed: FolderFragmentData
  try {
    const jsonParsed = JSON.parse(fragment.content || "{}")
    parsed = folderFragmentDataSchema.parse(jsonParsed)
  } catch (error) {
    console.error("Failed to parse folder fragment content:", error)
    throw new Error(`Invalid folder fragment content: ${error instanceof Error ? error.message : "Unknown error"}`)
  }

  return {
    ...parsed,
    title: fragment.title,
    summary: fragment.summary,
    fragmentId: fragment.id,
  }
}

/**
 * List folders for a workspace
 * Read function - no SessionPathway needed
 * Query Usable fragments directly (no cache)
 */
export async function listFolders(workspaceId: string, accessToken: string): Promise<FolderListItem[]> {
  // Get fragment type ID for "dashboard-folders" to ensure proper filtering
  const fragmentTypeId = await usableApi.getFragmentTypeIdByName(workspaceId, "dashboard-folders", accessToken)

  // If fragment type doesn't exist, return empty array (workspace not bootstrapped)
  if (!fragmentTypeId) {
    console.warn("Fragment type 'dashboard-folders' not found. Workspace may not be bootstrapped.")
    return []
  }

  // List fragments by fragmentTypeId AND tags (double filtering for safety)
  const fragments = await usableApi.listFragments(
    workspaceId,
    {
      fragmentTypeId, // Required - ensures strict filtering by fragment type
      tags: [GRAPHABLE_APP_TAG, "type:folder"],
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

  // Parse name and parentFolderId from fragment content (no cache needed)
  return validFragments.map((fragment) => {
    let name = fragment.title // Fallback to title
    let parentFolderId: string | null | undefined
    try {
      const jsonParsed = JSON.parse(fragment.content || "{}")
      const content = folderFragmentDataSchema.parse(jsonParsed)
      name = content.name || fragment.title
      parentFolderId = content.parentFolderId || null
    } catch (error) {
      // If parsing/validation fails, use defaults and log warning
      console.warn(`Failed to parse folder fragment ${fragment.id}:`, error)
    }

    return {
      id: fragment.id, // Fragment ID is the folder ID
      fragmentId: fragment.id,
      name,
      parentFolderId,
      title: fragment.title,
    }
  })
}

/**
 * Build hierarchical folder tree structure from flat list
 * Read function - no SessionPathway needed
 */
export async function getFolderTree(workspaceId: string, accessToken: string): Promise<FolderTreeNode[]> {
  const folders = await listFolders(workspaceId, accessToken)

  // Create a map of folder ID to folder node
  const folderMap = new Map<string, FolderTreeNode>()
  const rootFolders: FolderTreeNode[] = []

  // First pass: create all folder nodes
  for (const folder of folders) {
    folderMap.set(folder.id, {
      ...folder,
      children: [],
    })
  }

  // Second pass: build tree structure
  for (const folder of folders) {
    const node = folderMap.get(folder.id)
    if (!node) continue

    if (folder.parentFolderId && folderMap.has(folder.parentFolderId)) {
      // Add to parent's children
      const parent = folderMap.get(folder.parentFolderId)
      if (parent) {
        if (!parent.children) {
          parent.children = []
        }
        parent.children.push(node)
      }
    } else {
      // Root level folder
      rootFolders.push(node)
    }
  }

  return rootFolders
}

// Cache removed - all data comes from Usable fragments
