"use client"

import { GraphChart } from "@/components/graph-chart"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { GraphWithMetadata } from "@/lib/services/graph.service"
import { AlertCircleIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

interface GraphViewerProps {
  graph: GraphWithMetadata
  workspaceId?: string
  parameters?: Record<string, unknown>
}

interface ExecutionResult {
  data: unknown[]
  columns: string[]
}

/**
 * Graph viewer component using Recharts
 * Renders graphs based on visualization type
 */
export function GraphViewer({ graph, workspaceId, parameters = {} }: GraphViewerProps) {
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const previousParametersRef = useRef<string>("")

  useEffect(() => {
    async function loadGraphData() {
      if (!workspaceId || !graph.fragmentId) {
        setIsLoading(false)
        return
      }

      // Serialize parameters to compare with previous value
      const parametersKey = JSON.stringify(parameters)

      // Skip if parameters haven't actually changed
      if (parametersKey === previousParametersRef.current && previousParametersRef.current !== "") {
        return
      }

      previousParametersRef.current = parametersKey

      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/graphs/${graph.fragmentId}/execute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Workspace-Id": workspaceId,
          },
          credentials: "include", // Ensure cookies are sent for authentication
          body: JSON.stringify({ parameters }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to execute graph")
        }

        const result = await response.json()
        setExecutionResult(result)
      } catch (err) {
        console.error("Failed to execute graph:", err)
        setError(err instanceof Error ? err.message : "Failed to execute graph")
      } finally {
        setIsLoading(false)
      }
    }

    loadGraphData()
  }, [graph.fragmentId, workspaceId, parameters])

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="space-y-2 w-full">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!executionResult || executionResult.data.length === 0) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">No data available</div>
  }

  const { data, columns } = executionResult

  // Render table separately as it doesn't use the chart component
  if (graph.visualization.type === "table") {
    return (
      <div className="overflow-auto max-h-64">
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
  const visualizationOptions =
    typeof graph.visualization.options === "string"
      ? graph.visualization.options
      : JSON.stringify(graph.visualization.options || {})

  return (
    <GraphChart
      data={data as Record<string, unknown>[]}
      columns={columns}
      visualizationType={graph.visualization.type}
      visualizationOptions={visualizationOptions}
      className="h-full w-full"
    />
  )
}
