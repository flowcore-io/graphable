"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertCircleIcon } from "lucide-react"
import { useEffect, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts"

interface GraphPreviewProps {
  formData: {
    title?: string
    queryText?: string
    visualizationType?: "line" | "bar" | "table" | "pie" | "scatter" | "area"
    visualizationOptions?: string
    dataSourceRef?: string
    parameters?: Array<{
      name: string
      type: string
      required: boolean
      default?: string
    }>
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
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Build parameters object from form data
    const parameters: Record<string, unknown> = {}
    formData.parameters?.forEach((param) => {
      if (param.default) {
        if (param.type === "number") {
          parameters[param.name] = parseFloat(param.default)
        } else if (param.type === "boolean") {
          parameters[param.name] = param.default === "true"
        } else {
          parameters[param.name] = param.default
        }
      }
    })
    async function executePreview() {
      // Don't execute if query is empty or data source is missing
      if (!formData.queryText || !formData.dataSourceRef || !workspaceId) {
        setExecutionResult(null)
        setError(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        // Parse parameters
        const parameterDefinitions = (formData.parameters || []).map((param) => {
          const paramDef: {
            name: string
            type: string
            required: boolean
            default?: unknown
            enumValues?: string[]
            min?: number
            max?: number
            pattern?: string
          } = {
            name: param.name,
            type: param.type,
            required: param.required,
          }

          if (param.default) {
            if (param.type === "number") {
              paramDef.default = parseFloat(param.default)
            } else if (param.type === "boolean") {
              paramDef.default = param.default === "true"
            } else {
              paramDef.default = param.default
            }
          }

          return paramDef
        })

        // Execute query via API
        const response = await fetch("/api/graphs/preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Workspace-Id": workspaceId,
          },
          credentials: "include",
          body: JSON.stringify({
            query: {
              dialect: "sql",
              text: formData.queryText,
              parameters: parameterDefinitions,
            },
            parameters,
            dataSourceRef: formData.dataSourceRef,
            connectorRef: formData.connectorRef,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to execute query")
        }

        const result = await response.json()
        setExecutionResult(result)
      } catch (err) {
        console.error("Failed to execute preview:", err)
        setError(err instanceof Error ? err.message : "Failed to execute query")
        setExecutionResult(null)
      } finally {
        setIsLoading(false)
      }
    }

    // Debounce execution to avoid too many API calls
    const timeoutId = setTimeout(() => {
      executePreview()
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [formData.queryText, formData.dataSourceRef, formData.connectorRef, formData.parameters, workspaceId])

  if (!formData.queryText || !formData.dataSourceRef) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Enter a query and data source to see preview
      </div>
    )
  }

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
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No data available. Check your query and try again.
      </div>
    )
  }

  const { data, columns } = executionResult
  const visualizationType = formData.visualizationType || "table"

  // Prepare chart config from visualization options
  const chartConfig: ChartConfig = {}
  let parsedVisualizationOptions: Record<string, unknown> = {}
  try {
    parsedVisualizationOptions = formData.visualizationOptions ? JSON.parse(formData.visualizationOptions) : {}
  } catch {
    parsedVisualizationOptions = {}
  }

  const colors = (parsedVisualizationOptions.colors as string[]) || [
    "#8884d8",
    "#82ca9d",
    "#ffc658",
    "#ff7300",
    "#00ff00",
  ]

  // Build chart config from columns
  columns.forEach((col, index) => {
    chartConfig[col] = {
      label: col,
      color: colors[index % colors.length],
    }
  })

  // Render based on visualization type
  switch (visualizationType) {
    case "table":
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

    case "line":
      return (
        <ChartContainer config={chartConfig} className="h-64">
          <LineChart data={data as Record<string, unknown>[]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={columns[0]} />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {columns.slice(1).map((col) => {
              const index = columns.indexOf(col) - 1
              return (
                <Line key={col} type="monotone" dataKey={col} stroke={colors[index % colors.length]} strokeWidth={2} />
              )
            })}
          </LineChart>
        </ChartContainer>
      )

    case "bar":
      return (
        <ChartContainer config={chartConfig} className="h-64">
          <BarChart data={data as Record<string, unknown>[]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={columns[0]} />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {columns.slice(1).map((col) => {
              const index = columns.indexOf(col) - 1
              return <Bar key={col} dataKey={col} fill={colors[index % colors.length]} />
            })}
          </BarChart>
        </ChartContainer>
      )

    case "pie": {
      // Pie chart uses first column as name, second as value
      const pieData = (data as Record<string, unknown>[]).map((row) => ({
        name: String(row[columns[0]] ?? ""),
        value: Number(row[columns[1]] ?? 0),
      }))
      return (
        <ChartContainer config={chartConfig} className="h-64">
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
              {pieData.map((item) => {
                const index = pieData.indexOf(item)
                return <Cell key={`cell-${item.name}-${index}`} fill={colors[index % colors.length]} />
              })}
            </Pie>
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
          </PieChart>
        </ChartContainer>
      )
    }

    case "scatter":
      return (
        <ChartContainer config={chartConfig} className="h-64">
          <ScatterChart data={data as Record<string, unknown>[]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={columns[0]} />
            <YAxis dataKey={columns[1]} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Scatter dataKey={columns[1]} fill={colors[0]} />
          </ScatterChart>
        </ChartContainer>
      )

    case "area":
      return (
        <ChartContainer config={chartConfig} className="h-64">
          <AreaChart data={data as Record<string, unknown>[]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={columns[0]} />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {columns.slice(1).map((col) => {
              const index = columns.indexOf(col) - 1
              return (
                <Area
                  key={col}
                  type="monotone"
                  dataKey={col}
                  stroke={colors[index % colors.length]}
                  fill={colors[index % colors.length]}
                  fillOpacity={0.6}
                />
              )
            })}
          </AreaChart>
        </ChartContainer>
      )

    default:
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          Unsupported visualization type: {visualizationType}
        </div>
      )
  }
}
