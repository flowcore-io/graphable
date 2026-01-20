"use client"

import { GraphChart } from "@/components/graph-chart"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useGraphEditor } from "@/lib/context/graph-editor-context"
import { AlertCircleIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

interface GraphPreviewProps {
  formData: {
    title?: string
    queryText?: string
    queries?: Array<
      | {
          refId: string
          dialect: "sql"
          text: string
          dataSourceRef: string
          parameters?: Array<unknown>
        }
      | {
          refId: string
          operation: "math" | "reduce" | "resample"
          expression: string
        }
    >
    visualizationType?: "line" | "bar" | "table" | "pie" | "scatter" | "area"
    visualizationOptions?: string
    dataSourceRef?: string
    connectorRef?: string
  }
  workspaceId: string
}

interface ExecutionResult {
  data: unknown[]
  columns: string[]
}

/**
 * Graph preview component that shows a live preview based on form data
 * Executes the query and displays the visualization as the user types
 */
export function GraphPreview({ formData, workspaceId }: GraphPreviewProps) {
  const { timeRange, refreshTrigger, parameters, setExecutePreview, triggerRefresh: _triggerRefresh } = useGraphEditor()
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refreshTriggerRef = useRef(refreshTrigger)

  const executePreview = useCallback(async () => {
    // Support both multiple queries (new) and single query (legacy)
    const queries = formData.queries && Array.isArray(formData.queries) ? formData.queries : []

    // Filter and validate queries
    const validQueries = queries.filter((q: unknown) => {
      if (!q || typeof q !== "object") return false
      // For SQL queries, check if text and dataSourceRef are present and non-empty
      if ("dialect" in q && q.dialect === "sql") {
        const sqlQuery = q as { text?: string; dataSourceRef?: string }
        return (
          sqlQuery.text &&
          typeof sqlQuery.text === "string" &&
          sqlQuery.text.trim().length > 0 &&
          sqlQuery.dataSourceRef &&
          typeof sqlQuery.dataSourceRef === "string" &&
          sqlQuery.dataSourceRef.trim().length > 0
        )
      }
      // For expressions, check if expression is present and non-empty
      if ("operation" in q) {
        const exprQuery = q as { expression?: string }
        return (
          exprQuery.expression && typeof exprQuery.expression === "string" && exprQuery.expression.trim().length > 0
        )
      }
      return false
    })

    const hasQueries = validQueries.length > 0
    const hasSingleQuery =
      formData.queryText &&
      typeof formData.queryText === "string" &&
      formData.queryText.trim().length > 0 &&
      formData.dataSourceRef &&
      typeof formData.dataSourceRef === "string" &&
      formData.dataSourceRef.trim().length > 0

    // Don't execute if no queries are defined
    if ((!hasQueries && !hasSingleQuery) || !workspaceId) {
      setExecutionResult(null)
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Build parameters object from context (using empty values for now)
      const parameterValues: Record<string, unknown> = {}

      // Use parameters from context
      const parameterDefinitions = parameters.map((param) => ({
        name: param.name,
        type: param.type,
        required: param.required,
      }))

      // Check if time range is disabled in visualization options
      let effectiveTimeRange: typeof timeRange | undefined = timeRange
      try {
        const visualizationOptions = formData.visualizationOptions
        if (visualizationOptions) {
          const parsed = JSON.parse(visualizationOptions)
          if (parsed.disableTimeRange === true) {
            effectiveTimeRange = undefined
          }
        }
      } catch {
        // Invalid JSON, use timeRange as-is
      }

      // Prepare request body - support both multiple queries and single query
      const requestBody: Record<string, unknown> = {
        parameterValues,
        timeRange: effectiveTimeRange,
      }

      // Only include dataSourceRef if it exists (for single query or as default)
      if (formData.dataSourceRef) {
        requestBody.dataSourceRef = formData.dataSourceRef
      }

      // Only include connectorRef if it exists
      if (formData.connectorRef) {
        requestBody.connectorRef = formData.connectorRef
      }

      if (hasQueries) {
        // Use the already filtered valid queries
        requestBody.queries = validQueries
      } else if (hasSingleQuery) {
        // Single query (legacy) - dataSourceRef is required
        if (!formData.dataSourceRef) {
          throw new Error("Data source is required for single query")
        }
        requestBody.query = {
          dialect: "sql",
          text: formData.queryText,
          parameters: parameterDefinitions,
        }
        requestBody.dataSourceRef = formData.dataSourceRef
      } else {
        throw new Error("Either a query or queries must be provided")
      }

      // Debug logging
      console.log("Sending preview request:", JSON.stringify(requestBody, null, 2))
      console.log("Valid queries:", validQueries.length, "hasQueries:", hasQueries, "hasSingleQuery:", hasSingleQuery)

      // Execute query/queries via API
      const response = await fetch("/api/graphs/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Workspace-Id": workspaceId,
        },
        credentials: "include",
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("Preview API error:", errorData)
        throw new Error(errorData.error || "Failed to execute query")
      }

      const result = await response.json()
      setExecutionResult(result)
      // Don't trigger refresh here - it causes infinite loop
      // The refresh button already triggers execution via useEffect watching refreshTrigger
    } catch (err) {
      console.error("Failed to execute preview:", err)
      setError(err instanceof Error ? err.message : "Failed to execute query")
      setExecutionResult(null)
      // Don't trigger refresh on errors
    } finally {
      setIsLoading(false)
    }
  }, [
    formData.queryText,
    formData.queries,
    formData.dataSourceRef,
    formData.connectorRef,
    formData.visualizationOptions,
    workspaceId,
    timeRange,
    parameters,
  ])

  // Register executePreview function in context so it can be called from Run button
  useEffect(() => {
    setExecutePreview(executePreview)
    return () => {
      setExecutePreview(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.queryText,
    formData.queries,
    formData.dataSourceRef,
    formData.connectorRef,
    formData.visualizationOptions,
    workspaceId,
    timeRange,
    parameters,
  ])

  // Update ref and trigger refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger !== refreshTriggerRef.current) {
      refreshTriggerRef.current = refreshTrigger
      // Trigger execution when refresh is requested
      void executePreview()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger])

  // Check for valid queries (same logic as in executePreview)
  const queries = formData.queries && Array.isArray(formData.queries) ? formData.queries : []
  const validQueries = queries.filter((q: unknown) => {
    if (!q || typeof q !== "object") return false
    if ("dialect" in q && q.dialect === "sql") {
      const sqlQuery = q as { text?: string; dataSourceRef?: string }
      return (
        sqlQuery.text &&
        typeof sqlQuery.text === "string" &&
        sqlQuery.text.trim().length > 0 &&
        sqlQuery.dataSourceRef &&
        typeof sqlQuery.dataSourceRef === "string" &&
        sqlQuery.dataSourceRef.trim().length > 0
      )
    }
    if ("operation" in q) {
      const exprQuery = q as { expression?: string }
      return exprQuery.expression && typeof exprQuery.expression === "string" && exprQuery.expression.trim().length > 0
    }
    return false
  })
  const hasQueries = validQueries.length > 0
  const hasSingleQuery =
    formData.queryText &&
    typeof formData.queryText === "string" &&
    formData.queryText.trim().length > 0 &&
    formData.dataSourceRef &&
    typeof formData.dataSourceRef === "string" &&
    formData.dataSourceRef.trim().length > 0

  if (!hasQueries && !hasSingleQuery) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Enter a query and data source to see preview
      </div>
    )
  }

  return (
    <div className="h-full w-full flex flex-col">
      {isLoading ? (
        <div className="h-full flex items-center justify-center">
          <div className="space-y-2 w-full">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!isLoading && !error && (!executionResult || executionResult.data.length === 0) ? (
        <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
          No data available. Check your query and try again.
        </div>
      ) : null}

      {!isLoading && !error && executionResult && executionResult.data.length > 0 ? (
        <div className="flex-1 w-full min-h-0">
          {(() => {
            const { data, columns } = executionResult
            const visualizationType = formData.visualizationType || "table"

            // Render table separately as it doesn't use the chart component
            if (visualizationType === "table") {
              return (
                <div className="overflow-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {columns.map((col) => (
                          <TableHead key={col}>{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data as Record<string, unknown>[]).slice(0, 10).map((row, index) => {
                        const rowKey = `${String(row[columns[0]] ?? "")}-${index}`
                        return (
                          <TableRow key={rowKey}>
                            {columns.map((col) => (
                              <TableCell key={col}>{String(row[col] ?? "")}</TableCell>
                            ))}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )
            }

            // Use the reusable GraphChart component for all chart types
            return (
              <GraphChart
                data={data as Record<string, unknown>[]}
                columns={columns}
                visualizationType={visualizationType}
                visualizationOptions={formData.visualizationOptions}
                className="h-full w-full"
              />
            )
          })()}
        </div>
      ) : null}
    </div>
  )
}
