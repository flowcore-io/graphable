import { authOptions } from "@/lib/auth"
import { requireWorkspace } from "@/lib/middleware/api-workspace-guard"
import * as databaseExplorationService from "@/lib/services/database-exploration.service"
import { getServerSession } from "next-auth"
import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET /api/data-sources/[dataSourceId]/explore?action=listTables
 * GET /api/data-sources/[dataSourceId]/explore?action=describeTable&tableName=...
 * GET /api/data-sources/[dataSourceId]/explore?action=sampleRows&tableName=...&limit=10
 * Admin-only endpoint for database exploration
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ dataSourceId: string }> }) {
  return requireWorkspace(async (request: NextRequest, { workspaceId }) => {
    try {
      const { dataSourceId } = await params

      const session = await getServerSession(authOptions)
      if (!session?.user?.accessToken) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 })
      }

      // Check if user is workspace admin
      const isAdmin = await databaseExplorationService.isWorkspaceAdmin(
        workspaceId,
        session.user.id,
        session.user.accessToken
      )
      if (!isAdmin) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 })
      }

      // Get action from query parameters
      const url = new URL(request.url)
      const action = url.searchParams.get("action")

      if (action === "listTables") {
        const tables = await databaseExplorationService.listTables(dataSourceId, session.user.accessToken)
        return NextResponse.json({ tables })
      }

      if (action === "describeTable") {
        const tableName = url.searchParams.get("tableName")
        if (!tableName) {
          return NextResponse.json({ error: "tableName parameter is required" }, { status: 400 })
        }

        const schema = await databaseExplorationService.describeTable(dataSourceId, tableName, session.user.accessToken)
        return NextResponse.json({ schema })
      }

      if (action === "sampleRows") {
        const tableName = url.searchParams.get("tableName")
        if (!tableName) {
          return NextResponse.json({ error: "tableName parameter is required" }, { status: 400 })
        }

        const limitParam = url.searchParams.get("limit")
        const limit = limitParam ? parseInt(limitParam, 10) : 10

        // Validate limit (max 100 rows)
        if (limit > 100) {
          return NextResponse.json({ error: "Limit cannot exceed 100 rows" }, { status: 400 })
        }

        const rows = await databaseExplorationService.sampleRows(
          dataSourceId,
          tableName,
          limit,
          session.user.accessToken
        )
        return NextResponse.json({ rows })
      }

      return NextResponse.json(
        { error: "Invalid action. Supported actions: listTables, describeTable, sampleRows" },
        { status: 400 }
      )
    } catch (error) {
      console.error("Error exploring database:", error)
      const { dataSourceId: errorDataSourceId } = await params
      const errorMessage = error instanceof Error ? error.message : "Failed to explore database"
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  })(req)
}

