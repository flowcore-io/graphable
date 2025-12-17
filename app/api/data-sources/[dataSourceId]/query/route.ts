import { requireWorkspace } from "@/lib/middleware/api-workspace-guard"
import * as databaseExplorationService from "@/lib/services/database-exploration.service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const executeQuerySchema = z.object({
  query: z.string().min(1, "Query is required"),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(1000).optional().default(50),
})

/**
 * POST /api/data-sources/[dataSourceId]/query
 * Execute a SQL query with pagination
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ dataSourceId: string }> }) {
  return requireWorkspace(async (_request: NextRequest, { workspaceId, accessToken }) => {
    try {
      const { dataSourceId } = await params

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
        accessToken
      )

      return NextResponse.json(result)
    } catch (error) {
      console.error("Error executing query:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to execute query"
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  })(req)
}
