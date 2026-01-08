import { authOptions } from "@/lib/auth"
import { requireWorkspace } from "@/lib/middleware/api-workspace-guard"
import { createSessionPathwayForAPI } from "@/lib/pathways/session-provider"
import * as folderService from "@/lib/services/folder.service"
import { getServerSession } from "next-auth"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Schema for updating a folder
 */
const updateFolderSchema = z.object({
  name: z.string().min(1, "Folder name is required").optional(),
  parentFolderId: z.string().uuid("Invalid parent folder ID format").optional(),
})

/**
 * Helper function to check for circular references
 * Returns true if folderId would create a circular reference when set as parentFolderId
 */
async function wouldCreateCircularReference(
  workspaceId: string,
  folderId: string,
  newParentFolderId: string | null | undefined,
  accessToken: string
): Promise<boolean> {
  if (!newParentFolderId) {
    return false // No parent means no circular reference
  }

  if (folderId === newParentFolderId) {
    return true // Folder cannot be its own parent
  }

  // Check if newParentFolderId is a descendant of folderId
  const allFolders = await folderService.listFolders(workspaceId, accessToken)
  const folderMap = new Map<string, { parentFolderId?: string | null }>()
  for (const folder of allFolders) {
    folderMap.set(folder.id, { parentFolderId: folder.parentFolderId })
  }

  // Traverse up the tree from newParentFolderId to see if we reach folderId
  let currentId: string | null | undefined = newParentFolderId
  const visited = new Set<string>()

  while (currentId) {
    if (visited.has(currentId)) {
      break // Prevent infinite loops
    }
    visited.add(currentId)

    if (currentId === folderId) {
      return true // Circular reference detected
    }

    const currentFolder = folderMap.get(currentId)
    currentId = currentFolder?.parentFolderId || null
  }

  return false
}

/**
 * GET /api/folders/[folderId]
 * Get a folder by ID
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ folderId: string }> }) {
  return requireWorkspace(async (_request: NextRequest, { workspaceId }) => {
    try {
      const { folderId } = await params

      const session = await getServerSession(authOptions)
      if (!session?.user?.accessToken) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 })
      }

      // Validate folderId format
      const validationResult = z.string().uuid().safeParse(folderId)
      if (!validationResult.success) {
        return NextResponse.json({ error: "Invalid folder ID format" }, { status: 400 })
      }

      // Get folder fragment (folderId is the fragment ID)
      const folder = await folderService.getFolder(workspaceId, folderId, session.user.accessToken)
      if (!folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 })
      }

      return NextResponse.json({
        folder: {
          id: folderId, // Fragment ID
          name: folder.name, // From fragment content
          parentFolderId: folder.parentFolderId, // From fragment content
          title: folder.title,
          summary: folder.summary,
          fragmentId: folder.fragmentId,
        },
      })
    } catch (error) {
      console.error("Error getting folder:", error)
      return NextResponse.json({ error: "Failed to get folder" }, { status: 500 })
    }
  })(req)
}

/**
 * PATCH /api/folders/[folderId]
 * Update a folder
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ folderId: string }> }) {
  return requireWorkspace(async (request: NextRequest, { workspaceId }) => {
    try {
      const { folderId } = await params

      const session = await getServerSession(authOptions)
      if (!session?.user?.accessToken) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 })
      }

      // Validate folderId format
      const validationResult = z.string().uuid().safeParse(folderId)
      if (!validationResult.success) {
        return NextResponse.json({ error: "Invalid folder ID format" }, { status: 400 })
      }

      // Parse and validate request body
      const body = await request.json()
      const updateValidationResult = updateFolderSchema.safeParse(body)

      if (!updateValidationResult.success) {
        return NextResponse.json(
          {
            error: "Invalid folder data",
            details: updateValidationResult.error.issues,
          },
          { status: 400 }
        )
      }

      // Layer 3 - Authorization: Validate folder exists and belongs to workspace
      const existingFolder = await folderService.getFolder(workspaceId, folderId, session.user.accessToken)
      if (!existingFolder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 })
      }

      // Layer 4 - Validation: Prevent circular references
      if (updateValidationResult.data.parentFolderId !== undefined) {
        const wouldCreateCircular = await wouldCreateCircularReference(
          workspaceId,
          folderId,
          updateValidationResult.data.parentFolderId,
          session.user.accessToken
        )
        if (wouldCreateCircular) {
          return NextResponse.json(
            { error: "Cannot set parent folder: would create circular reference" },
            { status: 400 }
          )
        }

        // Validate parent folder exists (if provided)
        if (updateValidationResult.data.parentFolderId) {
          const parentFolder = await folderService.getFolder(
            workspaceId,
            updateValidationResult.data.parentFolderId,
            session.user.accessToken
          )
          if (!parentFolder) {
            return NextResponse.json({ error: "Parent folder not found" }, { status: 404 })
          }
        }
      }

      // Create session pathway for event emission
      const sessionContext = await createSessionPathwayForAPI()
      if (!sessionContext) {
        return NextResponse.json({ error: "Failed to create session context" }, { status: 500 })
      }

      // Update folder (emits event)
      const result = await folderService.updateFolder(
        sessionContext.pathway,
        workspaceId,
        folderId,
        updateValidationResult.data,
        session.user.accessToken
      )

      return NextResponse.json(result)
    } catch (error) {
      console.error("Error updating folder:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to update folder"
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  })(req)
}

/**
 * DELETE /api/folders/[folderId]
 * Delete a folder
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ folderId: string }> }) {
  return requireWorkspace(async (_request: NextRequest, { workspaceId }) => {
    try {
      const { folderId } = await params

      const session = await getServerSession(authOptions)
      if (!session?.user?.accessToken) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 })
      }

      // Validate folderId format
      const validationResult = z.string().uuid().safeParse(folderId)
      if (!validationResult.success) {
        return NextResponse.json({ error: "Invalid folder ID format" }, { status: 400 })
      }

      // Layer 2 - Authorization: Validate folder exists and belongs to workspace
      const existingFolder = await folderService.getFolder(workspaceId, folderId, session.user.accessToken)
      if (!existingFolder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 })
      }

      // Layer 3 - Validation: Check if folder has dashboards (cascade behavior is handled by handler)
      // Note: We allow deletion even if dashboards exist - handler will cascade (set folderId to null)
      // Dashboards are checked via Usable fragments, not cache

      // Create session pathway for event emission
      const sessionContext = await createSessionPathwayForAPI()
      if (!sessionContext) {
        return NextResponse.json({ error: "Failed to create session context" }, { status: 500 })
      }

      // Delete folder (emits event)
      const result = await folderService.deleteFolder(
        sessionContext.pathway,
        workspaceId,
        folderId,
        session.user.accessToken
      )

      return NextResponse.json(result)
    } catch (error) {
      console.error("Error deleting folder:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to delete folder"
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  })(req)
}
