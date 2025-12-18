import { authOptions } from "@/lib/auth"
import { requireWorkspace } from "@/lib/middleware/api-workspace-guard"
import { createSessionPathwayForAPI } from "@/lib/pathways/session-provider"
import * as dashboardService from "@/lib/services/dashboard.service"
import { getServerSession } from "next-auth"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Schema for creating a dashboard
 */
const createDashboardSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  folderId: z.string().uuid("Invalid folder ID format").optional(),
  layout: z.object({
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
  }),
  globalParameters: z.record(z.unknown()).optional(),
  permissions: z
    .object({
      viewers: z.array(z.string()).optional(),
      allowedParameters: z.array(z.string()).optional(),
    })
    .optional(),
})

/**
 * GET /api/dashboards
 * List dashboards for workspace
 */
export const GET = requireWorkspace(async (_req: NextRequest, { workspaceId }) => {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.accessToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const dashboards = await dashboardService.listDashboards(workspaceId, session.user.accessToken)

    return NextResponse.json({ dashboards })
  } catch (error) {
    console.error("Error listing dashboards:", error)
    return NextResponse.json({ error: "Failed to list dashboards" }, { status: 500 })
  }
})

/**
 * POST /api/dashboards
 * Create a new dashboard
 */
export const POST = requireWorkspace(async (req: NextRequest, { workspaceId }) => {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.accessToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // Parse and validate request body
    const body = await req.json()
    const validationResult = createDashboardSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid dashboard data",
          details: validationResult.error.issues,
        },
        { status: 400 }
      )
    }

    // Create session pathway for event emission
    const sessionContext = await createSessionPathwayForAPI()
    if (!sessionContext) {
      return NextResponse.json({ error: "Failed to create session context" }, { status: 500 })
    }

    // Create dashboard (emits event)
    const result = await dashboardService.createDashboard(
      sessionContext.pathway,
      workspaceId,
      validationResult.data,
      session.user.accessToken
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error creating dashboard:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to create dashboard"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
})
