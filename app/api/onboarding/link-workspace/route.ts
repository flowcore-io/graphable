import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { createSessionPathwayForAPI } from "@/lib/pathways/session-provider"
import { logger } from "@/lib/services/logger.service"
import { createTenantLink, getTenantLinkByWorkspace, validateWorkspaceAccess } from "@/lib/services/tenant.service"
import { bootstrapWorkspace } from "@/lib/services/workspace-bootstrap.service"

/**
 * Schema for validating workspace link request
 */
const linkWorkspaceSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID format"),
})

/**
 * POST /api/onboarding/link-workspace
 * Link a workspace to the current user
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    // Layer 1 - Authentication (401)
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session?.user?.accessToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // Layer 2 - Input Validation (400)
    const body = await request.json()
    const validationResult = linkWorkspaceSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid workspace ID",
          details: validationResult.error.issues,
        },
        { status: 400 }
      )
    }

    const { workspaceId } = validationResult.data
    const usableUserId = session.user.id

    // Layer 3 - Authorization (403/404)
    // Validate workspace ownership via Usable API
    const hasAccess = await validateWorkspaceAccess(workspaceId, usableUserId, session.user.accessToken)

    if (!hasAccess) {
      return NextResponse.json({ error: "Workspace not found or access denied" }, { status: 404 })
    }

    // Duplicate Prevention - Check if workspace is already linked
    const existingLink = await getTenantLinkByWorkspace(workspaceId)
    if (existingLink && existingLink.usableUserId !== usableUserId) {
      return NextResponse.json(
        {
          error: "Workspace is already linked to another user",
        },
        { status: 409 }
      )
    }

    // Create session pathway for event emission
    const sessionContext = await createSessionPathwayForAPI()
    if (!sessionContext) {
      return NextResponse.json({ error: "Failed to create session context" }, { status: 500 })
    }

    // Emit tenant.linked.0 event (event-driven)
    await createTenantLink(usableUserId, workspaceId, sessionContext.pathway)

    // Trigger workspace bootstrap (idempotent)
    // This runs synchronously but bootstrap operations are idempotent
    try {
      await bootstrapWorkspace(workspaceId, session.user.accessToken)
    } catch (bootstrapError) {
      logger.errorWithException("Bootstrap failed (non-blocking)", bootstrapError)
      // Don't fail the link operation if bootstrap fails
      // Bootstrap can be retried later
    }

    return NextResponse.json({
      success: true,
      workspaceId,
      message: "Workspace linked successfully",
    })
  } catch (error) {
    logger.errorWithException("Error linking workspace", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to link workspace"

    // Handle specific error cases
    if (errorMessage.includes("already linked")) {
      return NextResponse.json({ error: errorMessage }, { status: 409 })
    }

    return NextResponse.json({ error: "Failed to link workspace" }, { status: 500 })
  }
}
