import { authOptions } from "@/lib/auth"
import { requireWorkspace } from "@/lib/middleware/api-workspace-guard"
import * as dashboardService from "@/lib/services/dashboard.service"
import { getServerSession } from "next-auth"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET /api/dashboards/[dashboardId]/render
 * Load dashboard and evaluate all graphs (read-only, no SessionPathway)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ dashboardId: string }> }) {
  return requireWorkspace(async (_request: NextRequest, { workspaceId }) => {
    try {
      const { dashboardId } = await params

      const session = await getServerSession(authOptions)
      if (!session?.user?.accessToken) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 })
      }

      // Validate dashboardId format
      const validationResult = z.string().uuid().safeParse(dashboardId)
      if (!validationResult.success) {
        return NextResponse.json({ error: "Invalid dashboard ID format" }, { status: 400 })
      }

      // Get dashboard data
      const dashboard = await dashboardService.getDashboard(workspaceId, dashboardId, session.user.accessToken)

      if (!dashboard) {
        return NextResponse.json({ error: "Dashboard not found" }, { status: 404 })
      }

      // TODO: Execute all graphs via worker service
      // For now, return dashboard structure without executed data
      return NextResponse.json({
        dashboard,
        rendered: {
          tiles: dashboard.layout.tiles.map((tile) => ({
            graphRef: tile.graphRef,
            position: tile.position,
            data: null, // Will be populated by graph execution service
          })),
        },
      })
    } catch (error) {
      console.error("Error rendering dashboard:", error)
      return NextResponse.json({ error: "Failed to render dashboard" }, { status: 500 })
    }
  })(req)
}
