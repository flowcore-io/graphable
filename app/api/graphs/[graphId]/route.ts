import { authOptions } from "@/lib/auth"
import { requireWorkspace } from "@/lib/middleware/api-workspace-guard"
import { createSessionPathwayForAPI } from "@/lib/pathways/session-provider"
import * as graphService from "@/lib/services/graph.service"
import { getServerSession } from "next-auth"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Schema for updating a graph
 */
const updateGraphSchema = z.object({
  title: z.string().min(1).optional(),
  dataSourceRef: z.string().min(1).optional(),
  connectorRef: z.string().optional(),
  query: z
    .object({
      dialect: z.literal("sql"),
      text: z.string().min(1),
      parameters: z.array(
        z.object({
          name: z.string(),
          type: z.enum(["string", "number", "boolean", "date", "timestamp", "enum", "string[]", "number[]"]),
          required: z.boolean(),
          default: z.unknown().optional(),
          enumValues: z.array(z.string()).optional(),
          min: z.number().optional(),
          max: z.number().optional(),
          pattern: z.string().optional(),
        })
      ),
    })
    .optional(),
  parameterSchema: z
    .object({
      parameters: z.array(
        z.object({
          name: z.string(),
          type: z.enum(["string", "number", "boolean", "date", "timestamp", "enum", "string[]", "number[]"]),
          required: z.boolean(),
          default: z.unknown().optional(),
          enumValues: z.array(z.string()).optional(),
          min: z.number().optional(),
          max: z.number().optional(),
          pattern: z.string().optional(),
        })
      ),
    })
    .optional(),
  visualization: z
    .object({
      type: z.enum(["line", "bar", "table", "pie", "scatter", "area"]),
      options: z.record(z.unknown()),
    })
    .optional(),
  cachePolicy: z
    .object({
      ttl: z.number().optional(),
    })
    .optional(),
})

/**
 * GET /api/graphs/[graphId]
 * Get a graph by ID
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ graphId: string }> }) {
  return requireWorkspace(async (request: NextRequest, { workspaceId }) => {
    try {
      const { graphId } = await params

      const session = await getServerSession(authOptions)
      if (!session?.user?.accessToken) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 })
      }

      // Validate graphId format
      const validationResult = z.string().uuid().safeParse(graphId)
      if (!validationResult.success) {
        return NextResponse.json({ error: "Invalid graph ID format" }, { status: 400 })
      }

      const graph = await graphService.getGraph(workspaceId, graphId, session.user.accessToken)

      if (!graph) {
        return NextResponse.json({ error: "Graph not found" }, { status: 404 })
      }

      return NextResponse.json({ graph })
    } catch (error) {
      console.error("Error getting graph:", error)
      const { graphId: errorGraphId } = await params
      return NextResponse.json({ error: "Failed to get graph" }, { status: 500 })
    }
  })(req)
}

/**
 * PUT /api/graphs/[graphId]
 * Update a graph
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ graphId: string }> }) {
  return requireWorkspace(async (request: NextRequest, { workspaceId }) => {
    try {
      const { graphId } = await params

      const session = await getServerSession(authOptions)
      if (!session?.user?.accessToken) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 })
      }

      // Validate graphId format
      const validationResult = z.string().uuid().safeParse(graphId)
      if (!validationResult.success) {
        return NextResponse.json({ error: "Invalid graph ID format" }, { status: 400 })
      }

      // Parse and validate request body
      const body = await request.json()
      const updateValidationResult = updateGraphSchema.safeParse(body)

      if (!updateValidationResult.success) {
        return NextResponse.json(
          {
            error: "Invalid graph data",
            details: updateValidationResult.error.issues,
          },
          { status: 400 }
        )
      }

      // Create session pathway for event emission
      const sessionContext = await createSessionPathwayForAPI()
      if (!sessionContext) {
        return NextResponse.json({ error: "Failed to create session context" }, { status: 500 })
      }

      // Update graph (emits event)
      const result = await graphService.updateGraph(
        sessionContext.pathway,
        workspaceId,
        graphId,
        updateValidationResult.data,
        session.user.accessToken
      )

      return NextResponse.json(result)
    } catch (error) {
      console.error("Error updating graph:", error)
      const { graphId: errorGraphId } = await params
      const errorMessage = error instanceof Error ? error.message : "Failed to update graph"
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  })(req)
}

/**
 * DELETE /api/graphs/[graphId]
 * Delete a graph
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ graphId: string }> }) {
  return requireWorkspace(async (request: NextRequest, { workspaceId }) => {
    try {
      const { graphId } = await params

      const session = await getServerSession(authOptions)
      if (!session?.user?.accessToken) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 })
      }

      // Validate graphId format
      const validationResult = z.string().uuid().safeParse(graphId)
      if (!validationResult.success) {
        return NextResponse.json({ error: "Invalid graph ID format" }, { status: 400 })
      }

      // Create session pathway for event emission
      const sessionContext = await createSessionPathwayForAPI()
      if (!sessionContext) {
        return NextResponse.json({ error: "Failed to create session context" }, { status: 500 })
      }

      // Delete graph (emits event)
      const result = await graphService.deleteGraph(
        sessionContext.pathway,
        workspaceId,
        graphId,
        session.user.accessToken
      )

      return NextResponse.json(result)
    } catch (error) {
      console.error("Error deleting graph:", error)
      const { graphId: errorGraphId } = await params
      const errorMessage = error instanceof Error ? error.message : "Failed to delete graph"
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  })(req)
}
