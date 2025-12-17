import { requireWorkspace } from "@/lib/middleware/api-workspace-guard"
import * as dataSourceService from "@/lib/services/data-source.service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * POST /api/data-sources/[dataSourceId]/test
 * Test data source connection
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ dataSourceId: string }> }) {
  return requireWorkspace(async (_request: NextRequest, { workspaceId, accessToken }) => {
    try {
      const { dataSourceId } = await params

      // Test connection
      const result = await dataSourceService.testDataSourceConnection(workspaceId, dataSourceId)

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || "Connection test failed",
          },
          { status: 400 }
        )
      }

      return NextResponse.json({ success: true, message: "Connection test successful" })
    } catch (error) {
      console.error("Error testing data source connection:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to test connection"
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  })(req)
}
