import type { SessionPathwayBuilder } from "@flowcore/pathways"
import { randomUUID } from "crypto"
import { ulid } from "ulid"
import * as folderContract from "../pathways/contracts/folder.0"
import { usableApi } from "./usable-api.service"

const GRAPHABLE_VERSION = "0.2.0"
const GRAPHABLE_APP_TAG = "app:graphable"

/**
 * Folder fragment structure (stored in Usable)
 * Fragment ID is used as the folder ID (no separate UUID)
 */
export interface FolderFragmentData {
  id: string // Sortable UUID (ULID) for the fragment
  name: string
  parentFolderId?: string // Fragment ID of parent folder (if any)
}

/**
 * Folder creation input
 */
export interface CreateFolderInput {
  name: string
  parentFolderId?: string
}

/**
 * Folder update input
 */
export interface UpdateFolderInput {
  name?: string
  parentFolderId?: string
}

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

  // Create fragment content with ULID
  const fragmentContent: FolderFragmentData = {
    id: fragmentUlid,
    name: folderData.name,
    parentFolderId: folderData.parentFolderId, // Fragment ID of parent folder
  }

  // Create fragment in Usable
  const fragment = await usableApi.createFragment(
    workspaceId,
    {
      workspaceId,
      title: folderData.name,
      content: JSON.stringify(fragmentContent, null, 2),
      summary: `Folder: ${folderData.name}`,
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

  const existingData: FolderFragmentData = JSON.parse(fragment.content || "{}")

  // Merge updates, preserving the ID
  const updatedData: FolderFragmentData = {
    ...existingData,
    name: folderData.name !== undefined ? folderData.name : existingData.name,
    parentFolderId: folderData.parentFolderId !== undefined ? folderData.parentFolderId : existingData.parentFolderId,
    id: existingData.id, // Preserve the existing ID
  }

  // Update fragment in Usable
  await usableApi.updateFragment(
    workspaceId,
    folderId, // Fragment ID
    {
      content: JSON.stringify(updatedData, null, 2),
      title: updatedData.name,
      summary: `Folder: ${updatedData.name}`,
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
        name: updatedData.name,
        parentFolderId: updatedData.parentFolderId,
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

  const parsed = JSON.parse((fragment as any).content || "{}") as Partial<FolderFragmentData>

  return {
    ...(parsed as FolderFragmentData),
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
      const content = JSON.parse(fragment.content || "{}") as Partial<FolderFragmentData>
      name = content.name || fragment.title
      parentFolderId = content.parentFolderId || null
    } catch {
      // If parsing fails, use defaults
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
