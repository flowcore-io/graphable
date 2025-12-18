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
 * Schema for query or expression in preview
 */
const queryOrExpressionSchema = z.union([
  z.object({
    refId: z.string().regex(/^[A-Z]$/),
    dialect: z.literal("sql"),
    text: z.string().min(1),
    dataSourceRef: z.string().min(1),
    parameters: z.array(z.unknown()).optional(),
    name: z.string().optional(),
    hidden: z.boolean().optional(),
  }),
  z.object({
    refId: z.string().regex(/^[A-Z]$/),
    operation: z.enum(["math", "reduce", "resample"]),
    expression: z.string().min(1),
    name: z.string().optional(),
    hidden: z.boolean().optional(),
  }),
])

/**
 * Schema for graph preview execution request
 */
const previewGraphSchema = z
  .object({
    // Support both single query (legacy) and multiple queries
    query: z
      .object({
        dialect: z.literal("sql"),
        text: z.string().min(1),
        parameters: z.array(z.unknown()).optional(),
      })
      .optional(),
    queries: z.array(queryOrExpressionSchema).min(1).optional(),
    parameterValues: z.record(z.unknown()).optional().default({}),
    parameters: z.record(z.unknown()).optional().default({}), // Alias for parameterValues
    dataSourceRef: z.string().optional(), // Default data source (optional when queries have their own)
    connectorRef: z.string().optional(),
    timeRange: z.enum(["1h", "7d", "30d", "90d", "180d", "365d", "all", "custom"]).optional(),
  })
  .refine(
    (data) => {
      // Either query or queries must be provided
      return !!(data.query || (data.queries && data.queries.length > 0))
    },
    {
      message: "Either 'query' or 'queries' must be provided",
    }
  )
  .refine(
    (data) => {
      // If single query, dataSourceRef is required
      if (data.query && !data.dataSourceRef) {
        return false
      }
      return true
    },
    {
      message: "dataSourceRef is required when using single query",
      path: ["dataSourceRef"],
    }
  )

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
      console.error("Preview validation failed:", JSON.stringify(validationResult.error.issues, null, 2))
      console.error("Request body:", JSON.stringify(body, null, 2))
      return NextResponse.json(
        {
          error: "Invalid preview data",
          details: validationResult.error.issues,
        },
        { status: 400 }
      )
    }

    const {
      query,
      queries,
      parameterValues,
      parameters: params,
      dataSourceRef,
      connectorRef,
      timeRange,
    } = validationResult.data

    // Use parameterValues if provided, otherwise fall back to parameters
    const effectiveParameters = parameterValues || params || {}

    // Execute query/queries using graph execution service
    let result: { data: unknown[]; columns: string[] }
    if (queries && queries.length > 0) {
      // For multiple queries, dataSourceRef is optional (each query has its own)
      // Find the first SQL query with a dataSourceRef, or use the top-level one
      const sqlQueryWithDataSource = queries.find(
        (q): q is { refId: string; dialect: "sql"; text: string; dataSourceRef: string; parameters?: unknown[] } =>
          "dialect" in q && q.dialect === "sql" && "dataSourceRef" in q && !!q.dataSourceRef
      )
      const defaultDataSourceRef = dataSourceRef || sqlQueryWithDataSource?.dataSourceRef || ""

      if (!defaultDataSourceRef) {
        return NextResponse.json(
          { error: "dataSourceRef is required when queries don't specify their own dataSourceRef" },
          { status: 400 }
        )
      }
      // Multiple queries - use executeMultipleQueriesPreview
      result = await graphExecutionService.executeMultipleQueriesPreview(
        workspaceId,
        {
          queries: queries as Array<
            | {
                refId: string
                dialect: "sql"
                text: string
                dataSourceRef: string
                parameters?: Array<{
                  name: string
                  type: string
                  required: boolean
                  default?: unknown
                }>
              }
            | {
                refId: string
                operation: "math" | "reduce" | "resample"
                expression: string
              }
          >,
          dataSourceRef: defaultDataSourceRef, // Default data source
          connectorRef,
        },
        effectiveParameters,
        session.user.accessToken,
        timeRange
      )
    } else if (query) {
      // Single query (legacy) - dataSourceRef is required
      if (!dataSourceRef) {
        return NextResponse.json({ error: "dataSourceRef is required for single query" }, { status: 400 })
      }
      result = await graphExecutionService.executeQuery(
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
        effectiveParameters,
        session.user.accessToken,
        timeRange
      )
    } else {
      return NextResponse.json({ error: "Either 'query' or 'queries' must be provided" }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error executing preview:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to execute preview"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
})




