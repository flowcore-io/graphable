import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireWorkspace } from "@/lib/middleware/api-workspace-guard"
import * as databaseExplorationService from "@/lib/services/database-exploration.service"
import { logger } from "@/lib/services/logger.service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const executeQuerySchema = z.object({
  query: z.string().min(1, "Query is required"),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(1000).optional().default(50),
})

/**
 * POST /api/data-sources/[dataSourceId]/query
 * Execute a SQL query with pagination (requires workspace admin access)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ dataSourceId: string }> }) {
  return requireWorkspace(async (_request: NextRequest, { workspaceId, userId, accessToken }) => {
    try {
      const { dataSourceId } = await params

      // Check workspace admin access (defense-in-depth - also checked in service layer)
      const isAdmin = await databaseExplorationService.isWorkspaceAdmin(workspaceId, userId, accessToken)
      if (!isAdmin) {
        logger.warn("Unauthorized query execution attempt", {
          userId,
          workspaceId,
        })
        return NextResponse.json(
          { error: "Forbidden: Database exploration requires workspace admin access" },
          { status: 403 }
        )
      }

      // Parse and validate request body
      const body = await req.json()
      const validationResult = executeQuerySchema.safeParse(body)

      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: "Invalid query parameters",
            details: validationResult.error.issues,
          },
          { status: 400 }
        )
      }

      const { query, page, pageSize } = validationResult.data

      // Execute query
      const result = await databaseExplorationService.executeQuery(
        dataSourceId,
        workspaceId,
        query,
        page,
        pageSize,
        userId,
        accessToken
      )

      return NextResponse.json(result)
    } catch (error) {
      logger.errorWithException("Error executing query", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to execute query"

      // Handle authorization errors with proper status code
      if (errorMessage.includes("Forbidden")) {
        return NextResponse.json({ error: errorMessage }, { status: 403 })
      }

      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  })(req)
}
