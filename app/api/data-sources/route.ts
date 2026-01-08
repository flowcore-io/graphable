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
 * Schema for creating a data source
 */
const createDataSourceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  databaseType: z.enum(["postgresql"]).default("postgresql"),
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
  secretPayload: z.string().min(1, "Secret payload is required"),
  secretName: z.string().min(1, "Secret name is required"),
})

/**
 * GET /api/data-sources
 * List data sources for workspace
 */
export const GET = requireWorkspace(async (_req: NextRequest, { workspaceId, accessToken }) => {
  try {
    const dataSources = await dataSourceService.listDataSources(workspaceId, accessToken)

    return NextResponse.json({ dataSources })
  } catch (error) {
    logger.errorWithException("Error listing data sources", error)
    return NextResponse.json({ error: "Failed to list data sources" }, { status: 500 })
  }
})

/**
 * POST /api/data-sources
 * Create a new data source
 */
export const POST = requireWorkspace(async (req: NextRequest, { workspaceId, accessToken }) => {
  try {
    // Parse and validate request body
    const body = await req.json()
    const validationResult = createDataSourceSchema.safeParse(body)

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

    // Create data source (emits event)
    const result = await dataSourceService.createDataSource(
      sessionContext.pathway,
      workspaceId,
      validationResult.data,
      accessToken
    )

    return NextResponse.json(result)
  } catch (error) {
    logger.errorWithException("Error creating data source", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to create data source"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
})
