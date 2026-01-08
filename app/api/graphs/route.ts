import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { requireWorkspace } from "@/lib/middleware/api-workspace-guard"
import { createSessionPathwayForAPI } from "@/lib/pathways/session-provider"
import * as graphService from "@/lib/services/graph.service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Schema for creating a graph - defined inline to avoid module import issues
 * This is a copy of createGraphInputSchema from graph.service.ts
 */
const createGraphInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  dataSourceRef: z.string().optional(),
  connectorRef: z.string().optional(),
  query: z
    .object({
      dialect: z.literal("sql"),
      text: z.string().min(1, "Query text is required"),
      parameters: z.array(
        z.object({
          name: z.string().min(1, "Parameter name is required"),
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
  queries: z
    .array(
      z.union([
        z.object({
          refId: z.string().regex(/^[A-Z]$/, "refId must be a single uppercase letter (A-Z)"),
          dialect: z.literal("sql"),
          text: z.string().min(1, "Query text is required"),
          dataSourceRef: z.string().min(1, "Data source reference is required"),
          parameters: z.array(
            z.object({
              name: z.string().min(1, "Parameter name is required"),
              type: z.enum(["string", "number", "boolean", "date", "timestamp", "enum", "string[]", "number[]"]),
              required: z.boolean(),
              default: z.unknown().optional(),
              enumValues: z.array(z.string()).optional(),
              min: z.number().optional(),
              max: z.number().optional(),
              pattern: z.string().optional(),
            })
          ),
          name: z.string().optional(),
          hidden: z.boolean().optional().default(false),
        }),
        z.object({
          refId: z.string().regex(/^[A-Z]$/, "refId must be a single uppercase letter (A-Z)"),
          operation: z.enum(["math", "reduce", "resample"]),
          expression: z.string().min(1, "Expression is required"),
          name: z.string().optional(),
          hidden: z.boolean().optional().default(false),
        }),
      ])
    )
    .min(1, "At least one query is required")
    .optional(),
  parameterSchema: z.object({
    parameters: z.array(
      z.object({
        name: z.string().min(1, "Parameter name is required"),
        type: z.enum(["string", "number", "boolean", "date", "timestamp", "enum", "string[]", "number[]"]),
        required: z.boolean(),
        default: z.unknown().optional(),
        enumValues: z.array(z.string()).optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        pattern: z.string().optional(),
      })
    ),
  }),
  visualization: z.object({
    type: z.enum(["line", "bar", "table", "pie", "scatter", "area"]),
    options: z.record(z.unknown()),
  }),
  timeRange: z.enum(["1h", "7d", "30d", "90d", "180d", "365d", "all", "custom"]).optional(),
  cachePolicy: z
    .object({
      ttl: z.number().int().positive().optional(),
    })
    .optional(),
})

/**
 * GET /api/graphs
 * List graphs for workspace
 */
export const GET = requireWorkspace(async (_req: NextRequest, { workspaceId }) => {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.accessToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const graphs = await graphService.listGraphs(workspaceId, session.user.accessToken)

    return NextResponse.json({ graphs })
  } catch (error) {
    console.error("Error listing graphs:", error)
    return NextResponse.json({ error: "Failed to list graphs" }, { status: 500 })
  }
})

/**
 * POST /api/graphs
 * Create a new graph
 */
export const POST = requireWorkspace(async (req: NextRequest, { workspaceId }) => {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.accessToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // Parse and validate request body
    const body = await req.json()

    // Validate request body using schema
    const validationResult = createGraphInputSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid graph data",
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

    // Create graph (emits event)
    const result = await graphService.createGraph(
      sessionContext.pathway,
      workspaceId,
      validationResult.data,
      session.user.accessToken
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error creating graph:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to create graph"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
})
