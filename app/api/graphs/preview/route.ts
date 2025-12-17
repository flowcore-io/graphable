import { authOptions } from "@/lib/auth"
import { requireWorkspace } from "@/lib/middleware/api-workspace-guard"
import * as graphExecutionService from "@/lib/services/graph-execution.service"
import { getServerSession } from "next-auth"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Schema for graph preview execution request
 */
const previewGraphSchema = z.object({
  query: z.object({
    dialect: z.literal("sql"),
    text: z.string().min(1),
    parameters: z.array(z.unknown()).optional(),
  }),
  parameters: z.record(z.unknown()).optional().default({}),
  dataSourceRef: z.string().min(1),
  connectorRef: z.string().optional(),
})

/**
 * POST /api/graphs/preview
 * Execute a query preview without creating a graph
 */
export const POST = requireWorkspace(async (req: NextRequest, { workspaceId }) => {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.accessToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // Parse and validate request body
    const body = await req.json()
    const validationResult = previewGraphSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid preview data",
          details: validationResult.error.issues,
        },
        { status: 400 }
      )
    }

    const { query, parameters, dataSourceRef, connectorRef } = validationResult.data

    // Execute query directly using graph execution service
    const result = await graphExecutionService.executeQuery(
      workspaceId,
      {
        query: {
          dialect: query.dialect,
          text: query.text,
          parameters: (query.parameters || []) as Array<{
            name: string
            type: string
            required: boolean
            default?: unknown
          }>,
        },
        dataSourceRef,
        connectorRef,
      },
      parameters || {},
      session.user.accessToken
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error executing preview:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to execute preview"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
})
