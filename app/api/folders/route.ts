import { authOptions } from "@/lib/auth"
import { requireWorkspace } from "@/lib/middleware/api-workspace-guard"
import { createSessionPathwayForAPI } from "@/lib/pathways/session-provider"
import * as folderService from "@/lib/services/folder.service"
import { getServerSession } from "next-auth"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Schema for creating a folder
 */
const createFolderSchema = z.object({
  name: z.string().min(1, "Folder name is required"),
  parentFolderId: z.string().uuid("Invalid parent folder ID format").optional(),
})

/**
 * GET /api/folders
 * List folders for workspace (with tree structure)
 */
export const GET = requireWorkspace(async (_req: NextRequest, { workspaceId }) => {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.accessToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const folders = await folderService.listFolders(workspaceId, session.user.accessToken)
    const folderTree = await folderService.getFolderTree(workspaceId, session.user.accessToken)

    return NextResponse.json({ folders, folderTree })
  } catch (error) {
    console.error("Error listing folders:", error)
    return NextResponse.json({ error: "Failed to list folders" }, { status: 500 })
  }
})

/**
 * POST /api/folders
 * Create a new folder
 */
export const POST = requireWorkspace(async (req: NextRequest, { workspaceId }) => {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.accessToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // Parse and validate request body
    const body = await req.json()
    const validationResult = createFolderSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid folder data",
          details: validationResult.error.issues,
        },
        { status: 400 }
      )
    }

    const { name, parentFolderId } = validationResult.data

    // Layer 3 - Authorization: Validate parentFolderId exists and belongs to workspace (if provided)
    if (parentFolderId) {
      const parentFolder = await folderService.getFolder(workspaceId, parentFolderId, session.user.accessToken)
      if (!parentFolder) {
        return NextResponse.json({ error: "Parent folder not found" }, { status: 404 })
      }
    }

    // Create session pathway for event emission
    const sessionContext = await createSessionPathwayForAPI()
    if (!sessionContext) {
      return NextResponse.json({ error: "Failed to create session context" }, { status: 500 })
    }

    // Create folder (emits event)
    const result = await folderService.createFolder(
      sessionContext.pathway,
      workspaceId,
      { name, parentFolderId },
      session.user.accessToken
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error creating folder:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to create folder"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
})
