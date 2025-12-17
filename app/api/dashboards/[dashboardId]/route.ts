import { requireWorkspace } from "@/lib/middleware/api-workspace-guard"
import { createSessionPathwayForAPI } from "@/lib/pathways/session-provider"
import * as dashboardService from "@/lib/services/dashboard.service"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Schema for updating a dashboard (API route level)
 * Uses the service schema but allows nullable folderId for API compatibility
 */
const updateDashboardSchema = dashboardService.updateDashboardInputSchema.extend({
  folderId: z.string().uuid("Invalid folder ID format").optional().nullable(),
})

/**
 * GET /api/dashboards/[dashboardId]
 * Get a dashboard by ID
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ dashboardId: string }> }) {
  return requireWorkspace(async (request: NextRequest, { workspaceId, userId, accessToken }) => {
    try {
      const { dashboardId } = await params

      // requireWorkspace already validated authentication and provided accessToken

      // Validate dashboardId format
      const validationResult = z.string().uuid().safeParse(dashboardId)
      if (!validationResult.success) {
        return NextResponse.json({ error: "Invalid dashboard ID format" }, { status: 400 })
      }

      const dashboard = await dashboardService.getDashboard(workspaceId, dashboardId, accessToken)

      if (!dashboard) {
        return NextResponse.json({ error: "Dashboard not found" }, { status: 404 })
      }

      // folderId and description are now stored in the fragment content
      return NextResponse.json({
        dashboard: {
          id: dashboardId, // Fragment ID
          title: dashboard.title,
          description: dashboard.description, // From fragment content
          folderId: dashboard.folderId, // From fragment content
          layout: dashboard.layout,
          globalParameters: dashboard.globalParameters,
          permissions: dashboard.permissions,
          fragmentId: dashboard.fragmentId,
        },
      })
    } catch (error) {
      console.error("Error getting dashboard:", error)
      const { dashboardId: errorDashboardId } = await params
      return NextResponse.json({ error: "Failed to get dashboard" }, { status: 500 })
    }
  })(req)
}

/**
 * PUT /api/dashboards/[dashboardId]
 * Update a dashboard
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ dashboardId: string }> }) {
  return requireWorkspace(async (request: NextRequest, { workspaceId, userId, accessToken }) => {
    try {
      const { dashboardId } = await params

      // requireWorkspace already validated authentication and provided accessToken

      // Validate dashboardId format
      const validationResult = z.string().uuid().safeParse(dashboardId)
      if (!validationResult.success) {
        return NextResponse.json({ error: "Invalid dashboard ID format" }, { status: 400 })
      }

      // Parse and validate request body
      const body = await request.json()
      const updateValidationResult = updateDashboardSchema.safeParse(body)

      if (!updateValidationResult.success) {
        return NextResponse.json(
          {
            error: "Invalid dashboard data",
            details: updateValidationResult.error.issues,
          },
          { status: 400 }
        )
      }

      // Create session pathway for event emission
      const sessionContext = await createSessionPathwayForAPI()
      if (!sessionContext) {
        return NextResponse.json({ error: "Failed to create session context" }, { status: 500 })
      }

      // Update dashboard (emits event)
      const result = await dashboardService.updateDashboard(
        sessionContext.pathway,
        workspaceId,
        dashboardId,
        updateValidationResult.data,
        accessToken
      )

      return NextResponse.json(result)
    } catch (error) {
      console.error("Error updating dashboard:", error)
      const { dashboardId: errorDashboardId } = await params
      const errorMessage = error instanceof Error ? error.message : "Failed to update dashboard"
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  })(req)
}

/**
 * DELETE /api/dashboards/[dashboardId]
 * Delete a dashboard
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ dashboardId: string }> }) {
  return requireWorkspace(async (request: NextRequest, { workspaceId, userId, accessToken }) => {
    try {
      const { dashboardId } = await params

      // requireWorkspace already validated authentication and provided accessToken

      // Validate dashboardId format
      const validationResult = z.string().uuid().safeParse(dashboardId)
      if (!validationResult.success) {
        return NextResponse.json({ error: "Invalid dashboard ID format" }, { status: 400 })
      }

      // Create session pathway for event emission
      const sessionContext = await createSessionPathwayForAPI()
      if (!sessionContext) {
        return NextResponse.json({ error: "Failed to create session context" }, { status: 500 })
      }

      // Delete dashboard (emits event)
      const result = await dashboardService.deleteDashboard(
        sessionContext.pathway,
        workspaceId,
        dashboardId,
        accessToken
      )

      return NextResponse.json(result)
    } catch (error) {
      console.error("Error deleting dashboard:", error)
      const { dashboardId: errorDashboardId } = await params
      const errorMessage = error instanceof Error ? error.message : "Failed to delete dashboard"
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  })(req)
}
