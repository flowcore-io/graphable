import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { createSessionPathwayForAPI } from "@/lib/pathways/session-provider"
import { logger } from "@/lib/services/logger.service"
import { deleteTenantLink, getTenantLink } from "@/lib/services/tenant.service"

/**
 * POST /api/onboarding/unlink-workspace
 * Unlink workspace from current user
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  try {
    // Layer 1 - Authentication (401)
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const usableUserId = session.user.id

    // Layer 2 - Authorization (404)
    // Validate user has an active tenant link
    const tenantLink = await getTenantLink(usableUserId)
    if (!tenantLink) {
      return NextResponse.json({ error: "No tenant link found" }, { status: 404 })
    }

    // Create session pathway for event emission
    const sessionContext = await createSessionPathwayForAPI()
    if (!sessionContext) {
      return NextResponse.json({ error: "Failed to create session context" }, { status: 500 })
    }

    // Emit tenant.unlinked.0 event (event-driven)
    await deleteTenantLink(usableUserId, sessionContext.pathway)

    return NextResponse.json({
      success: true,
      message: "Workspace unlinked successfully",
    })
  } catch (error) {
    logger.errorWithException("Error unlinking workspace", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to unlink workspace"

    if (errorMessage.includes("No tenant link")) {
      return NextResponse.json({ error: errorMessage }, { status: 404 })
    }

    return NextResponse.json({ error: "Failed to unlink workspace" }, { status: 500 })
  }
}
