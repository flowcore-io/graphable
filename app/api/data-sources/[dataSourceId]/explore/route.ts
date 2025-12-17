import { requireWorkspace } from "@/lib/middleware/api-workspace-guard"
import * as databaseExplorationService from "@/lib/services/database-exploration.service"
import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET /api/data-sources/[dataSourceId]/explore?action=listTables
 * GET /api/data-sources/[dataSourceId]/explore?action=describeTable&tableName=...
 * GET /api/data-sources/[dataSourceId]/explore?action=sampleRows&tableName=...&limit=10
 * Endpoint for database exploration (requires workspace access)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ dataSourceId: string }> }) {
  return requireWorkspace(async (request: NextRequest, { workspaceId, accessToken }) => {
    try {
      const { dataSourceId } = await params

      // Get action from query parameters
      const url = new URL(request.url)
      const action = url.searchParams.get("action")

      if (action === "listTables") {
        const tables = await databaseExplorationService.listTables(dataSourceId, workspaceId, accessToken)
        return NextResponse.json({ tables })
      }

      if (action === "describeTable") {
        const tableName = url.searchParams.get("tableName")
        if (!tableName) {
          return NextResponse.json({ error: "tableName parameter is required" }, { status: 400 })
        }

        const schemaName = url.searchParams.get("schemaName") || undefined

        const schema = await databaseExplorationService.describeTable(
          dataSourceId,
          workspaceId,
          tableName,
          schemaName,
          accessToken
        )
        return NextResponse.json({ schema })
      }

      if (action === "sampleRows") {
        const tableName = url.searchParams.get("tableName")
        if (!tableName) {
          return NextResponse.json({ error: "tableName parameter is required" }, { status: 400 })
        }

        const schemaName = url.searchParams.get("schemaName") || undefined

        const limitParam = url.searchParams.get("limit")
        const limit = limitParam ? parseInt(limitParam, 10) : 10

        // Validate limit (max 100 rows)
        if (limit > 100) {
          return NextResponse.json({ error: "Limit cannot exceed 100 rows" }, { status: 400 })
        }

        const rows = await databaseExplorationService.sampleRows(
          dataSourceId,
          workspaceId,
          tableName,
          schemaName,
          limit,
          accessToken
        )
        return NextResponse.json({ rows })
      }

      return NextResponse.json(
        { error: "Invalid action. Supported actions: listTables, describeTable, sampleRows" },
        { status: 400 }
      )
    } catch (error) {
      console.error("Error exploring database:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to explore database"
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  })(req)
}
