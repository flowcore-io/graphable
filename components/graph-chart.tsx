"use client"

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
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

interface GraphChartProps {
  data: Record<string, unknown>[]
  columns: string[]
  visualizationType: "line" | "bar" | "table" | "pie" | "scatter" | "area"
  visualizationOptions?: string
  className?: string
}

/**
 * Reusable graph chart component that auto-scales to fill its container
 * Used by both GraphPreview and GraphViewer
 */
export function GraphChart({
  data,
  columns,
  visualizationType,
  visualizationOptions,
  className = "h-full w-full",
}: GraphChartProps) {
  // Prepare chart config from visualization options
  const chartConfig: ChartConfig = {}
  let parsedVisualizationOptions: Record<string, unknown> = {}
  try {
    parsedVisualizationOptions = visualizationOptions ? JSON.parse(visualizationOptions) : {}
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
  const showLegend = parsedVisualizationOptions.showLegend !== false // Default to true
  const unit = (parsedVisualizationOptions.unit as string) || ""
  const customUnit = (parsedVisualizationOptions.customUnit as string) || ""
  const displayUnit = unit === "custom" ? customUnit : unit

  // Helper function to format values with unit
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return ""
    const numValue = Number(value)
    if (Number.isNaN(numValue)) return String(value)

    if (!displayUnit) return numValue.toLocaleString()

    // Format based on unit type
    if (displayUnit === "%") {
      return `${numValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
    }
    if (displayUnit === "$" || displayUnit === "€" || displayUnit === "£") {
      return `${displayUnit}${numValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    }
    if (displayUnit === "B" || displayUnit === "KB" || displayUnit === "MB" || displayUnit === "GB") {
      return `${numValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${displayUnit}`
    }
    // For other units (s, ms, custom), append after the number
    return `${numValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${displayUnit}`
  }

  // Custom tooltip component that formats values with units
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean
    payload?: Array<{ dataKey: string; value: unknown; color: string }>
  }) => {
    if (!active || !payload || payload.length === 0) return null
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="grid gap-2">
          {payload.map((item) => (
            <div key={String(item.dataKey)} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm font-medium">{String(item.dataKey)}</span>
              </div>
              <span className="text-sm font-bold">{formatValue(item.value)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Build chart config from columns
  columns.forEach((col, index) => {
    chartConfig[col] = {
      label: col,
      color: colors[index % colors.length],
    }
  })

  // Process and sort data for time-series charts
  let processedData = data
  if (visualizationType === "line" || visualizationType === "area") {
    // Sort by first column (usually date/time)
    processedData = [...data].sort((a, b) => {
      const aVal = a[columns[0]]
      const bVal = b[columns[0]]
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      // Try to parse as date
      const aDate = typeof aVal === "string" ? new Date(aVal).getTime() : Number(aVal)
      const bDate = typeof bVal === "string" ? new Date(bVal).getTime() : Number(bVal)

      if (!Number.isNaN(aDate) && !Number.isNaN(bDate)) {
        return aDate - bDate
      }

      // Fallback to string comparison
      return String(aVal).localeCompare(String(bVal))
    })

    // Ensure numeric values are numbers
    processedData = processedData.map((row) => {
      const processedRow: Record<string, unknown> = { ...row }
      columns.slice(1).forEach((col) => {
        const val = row[col]
        if (val !== null && val !== undefined) {
          const numVal = Number(val)
          if (!Number.isNaN(numVal)) {
            processedRow[col] = numVal
          }
        }
      })
      return processedRow
    })
  }

  // Render based on visualization type
  switch (visualizationType) {
    case "line":
      return (
        <ChartContainer config={chartConfig} className={className}>
          <LineChart data={processedData} margin={{ right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={columns[0]}
              tickFormatter={(value) => {
                // Format date values for display
                if (typeof value === "string" && value.includes("T")) {
                  try {
                    const date = new Date(value)
                    if (!Number.isNaN(date.getTime())) {
                      return date.toLocaleDateString()
                    }
                  } catch {
                    // Fall through to return value as-is
                  }
                }
                return String(value)
              }}
            />
            <YAxis tickFormatter={(value) => formatValue(value)} />
            <ChartTooltip content={<CustomTooltip />} />
            {showLegend && <ChartLegend content={<ChartLegendContent />} />}
            {columns.slice(1).map((col) => {
              const index = columns.indexOf(col) - 1
              return (
                <Line
                  key={col}
                  type="monotone"
                  dataKey={col}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              )
            })}
          </LineChart>
        </ChartContainer>
      )

    case "bar":
      return (
        <ChartContainer config={chartConfig} className={className}>
          <BarChart data={data} margin={{ right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={columns[0]} />
            <YAxis tickFormatter={(value) => formatValue(value)} />
            <ChartTooltip content={<CustomTooltip />} />
            {showLegend && <ChartLegend content={<ChartLegendContent />} />}
            {columns.slice(1).map((col) => {
              const index = columns.indexOf(col) - 1
              return <Bar key={col} dataKey={col} fill={colors[index % colors.length]} />
            })}
          </BarChart>
        </ChartContainer>
      )

    case "pie": {
      // Pie chart uses first column as name, second as value
      const pieData = data.map((row) => ({
        name: String(row[columns[0]] ?? ""),
        value: Number(row[columns[1]] ?? 0),
      }))
      return (
        <ChartContainer config={chartConfig} className={className}>
          <PieChart margin={{ right: 20 }}>
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
        <ChartContainer config={chartConfig} className={className}>
          <ScatterChart data={data} margin={{ right: 20 }}>
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
        <ChartContainer config={chartConfig} className={className}>
          <AreaChart data={processedData} margin={{ right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={columns[0]}
              tickFormatter={(value) => {
                // Format date values for display
                if (typeof value === "string" && value.includes("T")) {
                  try {
                    const date = new Date(value)
                    if (!Number.isNaN(date.getTime())) {
                      return date.toLocaleDateString()
                    }
                  } catch {
                    // Fall through to return value as-is
                  }
                }
                return String(value)
              }}
            />
            <YAxis tickFormatter={(value) => formatValue(value)} />
            <ChartTooltip content={<CustomTooltip />} />
            {showLegend && <ChartLegend content={<ChartLegendContent />} />}
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
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          Unsupported visualization type: {visualizationType}
        </div>
      )
  }
}
