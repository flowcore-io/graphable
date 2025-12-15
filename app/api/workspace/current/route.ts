import { authOptions } from "@/lib/auth"
import { getWorkspaceForUser } from "@/lib/services/tenant.service"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

/**
 * GET /api/workspace/current
 * Get current user's linked workspace
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const workspaceId = await getWorkspaceForUser(session.user.id)

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace linked" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      workspaceId,
    })
  } catch (error) {
    console.error("Error fetching current workspace:", error)
    return NextResponse.json({ error: "Failed to fetch workspace" }, { status: 500 })
  }
}
