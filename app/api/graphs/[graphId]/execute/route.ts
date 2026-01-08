import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { requireWorkspace } from "@/lib/middleware/api-workspace-guard"
import { createSessionPathwayForAPI } from "@/lib/pathways/session-provider"
import * as graphExecutionService from "@/lib/services/graph-execution.service"
import { logger } from "@/lib/services/logger.service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Schema for graph execution request
 */
const executeGraphSchema = z.object({
  parameters: z.record(z.unknown()).optional().default({}),
})

/**
 * POST /api/graphs/[graphId]/execute
 * Execute a graph query with parameters
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ graphId: string }> }) {
  return requireWorkspace(async (request: NextRequest, { workspaceId, userId }) => {
    try {
      const { graphId } = await params

      const session = await getServerSession(authOptions)
      if (!session?.user?.accessToken) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 })
      }

      // Create session pathway for auditing (required for POST endpoints)
      const sessionContext = await createSessionPathwayForAPI()
      if (!sessionContext) {
        return NextResponse.json({ error: "Failed to create session context" }, { status: 500 })
      }

      // Validate graphId format
      const validationResult = z.string().uuid().safeParse(graphId)
      if (!validationResult.success) {
        return NextResponse.json({ error: "Invalid graph ID format" }, { status: 400 })
      }

      // Parse and validate request body
      const body = await request.json()
      const validationResult2 = executeGraphSchema.safeParse(body)

      if (!validationResult2.success) {
        return NextResponse.json(
          {
            error: "Invalid request data",
            details: validationResult2.error.issues,
          },
          { status: 400 }
        )
      }

      // Execute graph
      const result = await graphExecutionService.executeGraph(
        workspaceId,
        graphId,
        validationResult2.data.parameters || {},
        userId,
        session.user.accessToken,
        sessionContext.pathway
      )

      return NextResponse.json(result)
    } catch (error) {
      logger.errorWithException("Error executing graph", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to execute graph"

      // Return validation errors with 400 status
      if (errorMessage.includes("validation failed")) {
        return NextResponse.json({ error: errorMessage }, { status: 400 })
      }

      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  })(req)
}
