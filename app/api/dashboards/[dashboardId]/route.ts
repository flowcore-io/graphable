import { authOptions } from "@/lib/auth"
import { requireWorkspace } from "@/lib/middleware/api-workspace-guard"
import { createSessionPathwayForAPI } from "@/lib/pathways/session-provider"
import * as dashboardService from "@/lib/services/dashboard.service"
import { getServerSession } from "next-auth"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Schema for updating a dashboard
 */
const updateDashboardSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  folderId: z.string().uuid("Invalid folder ID format").optional().nullable(),
  layout: z
    .object({
      grid: z.object({
        columns: z.number().int().positive(),
        rows: z.number().int().positive(),
      }),
      tiles: z.array(
        z.object({
          graphRef: z.string().uuid("Invalid graph reference"),
          position: z.object({
            x: z.number().int().nonnegative(),
            y: z.number().int().nonnegative(),
            w: z.number().int().positive(),
            h: z.number().int().positive(),
          }),
          parameterOverrides: z.record(z.unknown()).optional(),
        })
      ),
    })
    .optional(),
  globalParameters: z.record(z.unknown()).optional(),
  permissions: z
    .object({
      viewers: z.array(z.string()).optional(),
      allowedParameters: z.array(z.string()).optional(),
    })
    .optional(),
})

/**
 * GET /api/dashboards/[dashboardId]
 * Get a dashboard by ID
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ dashboardId: string }> }) {
  return requireWorkspace(async (request: NextRequest, { workspaceId }) => {
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

      const dashboard = await dashboardService.getDashboard(workspaceId, dashboardId, session.user.accessToken)

      if (!dashboard) {
        return NextResponse.json({ error: "Dashboard not found" }, { status: 404 })
      }

      // folderId is now stored in the fragment content
      return NextResponse.json({
        dashboard: {
          id: dashboardId, // Fragment ID
          title: dashboard.title,
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
  return requireWorkspace(async (request: NextRequest, { workspaceId }) => {
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
        session.user.accessToken
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
  return requireWorkspace(async (request: NextRequest, { workspaceId }) => {
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
        session.user.accessToken
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
