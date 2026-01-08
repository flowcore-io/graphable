import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireWorkspace } from "@/lib/middleware/api-workspace-guard"
import { createSessionPathwayForAPI } from "@/lib/pathways/session-provider"
import * as dataSourceService from "@/lib/services/data-source.service"
import { logger } from "@/lib/services/logger.service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Schema for updating a data source
 */
const updateDataSourceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  connectionParameters: z
    .object({
      schema: z.string().optional(),
      ssl: z
        .object({
          mode: z.enum(["prefer", "require", "disable"]).optional(),
          rejectUnauthorized: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  secretPayload: z.string().min(1).optional(),
  // secretName: optional, required only when creating a new secret if reference is missing
  secretName: z.string().min(1).optional(),
})

/**
 * GET /api/data-sources/[dataSourceId]
 * Get a data source by ID
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ dataSourceId: string }> }) {
  return requireWorkspace(async (_request: NextRequest, { workspaceId, accessToken }) => {
    try {
      const { dataSourceId } = await params

      // Include connection details for edit page (masked for security)
      const dataSource = await dataSourceService.getDataSource(workspaceId, dataSourceId, accessToken, true)

      if (!dataSource) {
        return NextResponse.json({ error: "Data source not found" }, { status: 404 })
      }

      return NextResponse.json({ dataSource })
    } catch (error) {
      logger.errorWithException("Error getting data source", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to get data source"
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  })(req)
}

/**
 * PATCH /api/data-sources/[dataSourceId]
 * Update a data source
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ dataSourceId: string }> }) {
  return requireWorkspace(async (request: NextRequest, { workspaceId, accessToken }) => {
    try {
      const { dataSourceId } = await params

      // Parse and validate request body
      const body = await request.json()
      const validationResult = updateDataSourceSchema.safeParse(body)

      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: "Invalid data source data",
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

      // Update data source (emits event)
      const result = await dataSourceService.updateDataSource(
        sessionContext.pathway,
        workspaceId,
        dataSourceId,
        validationResult.data,
        accessToken
      )

      return NextResponse.json(result)
    } catch (error) {
      logger.errorWithException("Error updating data source", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to update data source"
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  })(req)
}

/**
 * DELETE /api/data-sources/[dataSourceId]
 * Delete a data source
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ dataSourceId: string }> }) {
  return requireWorkspace(async (_request: NextRequest, { workspaceId, accessToken }) => {
    try {
      const { dataSourceId } = await params

      // Create session pathway for event emission
      const sessionContext = await createSessionPathwayForAPI()
      if (!sessionContext) {
        return NextResponse.json({ error: "Failed to create session context" }, { status: 500 })
      }

      // Delete data source (emits event)
      const result = await dataSourceService.deleteDataSource(
        sessionContext.pathway,
        workspaceId,
        dataSourceId,
        accessToken
      )

      return NextResponse.json(result)
    } catch (error) {
      logger.errorWithException("Error deleting data source", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to delete data source"
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  })(req)
}
