"use client"

import { GraphParametersEditor } from "@/components/graph-parameters-editor"
import { GraphPreview } from "@/components/graph-preview"
import { QueriesEditor } from "@/components/queries-editor"
import { TimeRangeSelector } from "@/components/time-range-selector"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { VisualizationOptionsEditor } from "@/components/visualization-options-editor"
import { GraphEditorProvider, useGraphEditor } from "@/lib/context/graph-editor-context"
import { useWorkspace } from "@/lib/context/workspace-context"
import type { ParameterDefinition } from "@/lib/services/graph.service"
import { cn } from "@/lib/utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon, Loader2Icon, PlayIcon } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

// Query or expression schema for form
const queryOrExpressionFormSchema = z.union([
  z.object({
    refId: z.string().regex(/^[A-Z]$/, "refId must be a single uppercase letter"),
    dialect: z.literal("sql"),
    text: z.string().min(1, "Query text is required"),
    dataSourceRef: z.string().min(1, "Data source reference is required"),
    parameters: z.array(z.any()).optional().default([]),
  }),
  z.object({
    refId: z.string().regex(/^[A-Z]$/, "refId must be a single uppercase letter"),
    operation: z.enum(["math", "reduce", "resample"]),
    expression: z.string().min(1, "Expression is required"),
  }),
])

// Graph creation form schema
const createGraphFormSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    dataSourceRef: z.string().optional(), // Default data source (optional when queries have their own)
    connectorRef: z.string().optional(),
    // Support both single query (legacy) and multiple queries
    queryText: z.string().optional(), // Legacy single query
    queries: z.array(queryOrExpressionFormSchema).min(1, "At least one query is required").optional(),
    visualizationType: z.enum(["line", "bar", "table", "pie", "scatter", "area"]),
    visualizationOptions: z.string().optional(), // JSON string
    timeRange: z.enum(["1h", "7d", "30d", "90d", "180d", "365d", "all", "custom"]).optional(),
    parameters: z.array(
      z.object({
        name: z.string().min(1, "Parameter name is required"),
        type: z.enum(["string", "number", "boolean", "date", "timestamp", "enum", "string[]", "number[]"]),
        required: z.boolean(),
        default: z.string().optional(),
        enumValues: z.string().optional(), // Comma-separated for enum type
        min: z.string().optional(),
        max: z.string().optional(),
        pattern: z.string().optional(),
      })
    ),
  })
  .refine(
    (data) => {
      // If using single query (legacy), dataSourceRef is required
      if (data.queryText && (!data.queries || data.queries.length === 0)) {
        return !!data.dataSourceRef && data.dataSourceRef.trim().length > 0
      }
      // If using multiple queries, dataSourceRef is optional (each query has its own)
      return true
    },
    {
      message: "Data source reference is required for single query",
      path: ["dataSourceRef"],
    }
  )

type CreateGraphFormData = z.infer<typeof createGraphFormSchema>

function NewGraphPageContent() {
  const { workspaceId } = useWorkspace()
  const router = useRouter()
  const params = useParams()
  const dashboardId = params.dashboardId as string
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dataSources, setDataSources] = useState<Array<{ id: string; fragmentId: string; name: string }>>([])
  const [isLoadingDataSources, setIsLoadingDataSources] = useState(false)

  const form = useForm<CreateGraphFormData>({
    resolver: zodResolver(createGraphFormSchema) as any,
    defaultValues: {
      title: "",
      dataSourceRef: "",
      connectorRef: "",
      queryText: "",
      queries: [
        {
          refId: "A",
          dialect: "sql",
          text: "",
          dataSourceRef: "",
          parameters: [],
          hidden: false,
        },
      ] as any,
      visualizationType: "table",
      visualizationOptions: "{}",
      timeRange: undefined,
      parameters: [],
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = form

  const parameters = watch("parameters")
  const formData = watch()
  const dataSourceRef = watch("dataSourceRef")
  const timeRange = watch("timeRange")
  const queries = watch("queries")
  const hasMultipleQueries = queries && Array.isArray(queries) && queries.length > 0

  const {
    timeRange: contextTimeRange,
    setTimeRange: setContextTimeRange,
    setParameters: setContextParameters,
    executePreview,
    triggerRefresh,
  } = useGraphEditor()

  // Sync form state with context (form -> context)
  useEffect(() => {
    if (timeRange) {
      setContextTimeRange(timeRange as "1h" | "7d" | "30d" | "90d" | "180d" | "365d" | "all" | "custom")
    }
  }, [timeRange, setContextTimeRange])

  useEffect(() => {
    setContextParameters(
      parameters.map((p) => ({
        name: p.name,
        type: p.type,
        required: p.required,
      }))
    )
  }, [parameters, setContextParameters])

  // Sync context state with form (context -> form)
  useEffect(() => {
    if (contextTimeRange && contextTimeRange !== timeRange) {
      setValue("timeRange", contextTimeRange)
    }
  }, [contextTimeRange, timeRange, setValue])

  // Fetch available data sources
  useEffect(() => {
    if (!workspaceId) return

    setIsLoadingDataSources(true)
    fetch("/api/data-sources", {
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.dataSources) {
          setDataSources(data.dataSources)
        }
      })
      .catch((err) => {
        console.error("Failed to fetch data sources:", err)
      })
      .finally(() => {
        setIsLoadingDataSources(false)
      })
  }, [workspaceId])

  const onSubmit = async (data: CreateGraphFormData) => {
    console.log("onSubmit called with data:", data)

    if (!workspaceId) {
      setError("No workspace selected")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Parse visualization options
      let visualizationOptions: Record<string, unknown> = {}
      try {
        visualizationOptions = data.visualizationOptions ? JSON.parse(data.visualizationOptions) : {}
      } catch {
        // Invalid JSON, use empty object
        visualizationOptions = {}
      }

      // Parse parameters
      const parameterDefinitions: ParameterDefinition[] = data.parameters.map((param) => {
        const paramDef: ParameterDefinition = {
          name: param.name,
          type: param.type,
          required: param.required,
        }

        // Parse default value based on type
        if (param.default) {
          if (param.type === "number") {
            paramDef.default = parseFloat(param.default)
          } else if (param.type === "boolean") {
            paramDef.default = param.default === "true"
          } else {
            paramDef.default = param.default
          }
        }

        // Parse enum values
        if (param.type === "enum" && param.enumValues) {
          paramDef.enumValues = param.enumValues
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
        }

        // Parse min/max for numbers
        if (param.type === "number") {
          if (param.min) paramDef.min = parseFloat(param.min)
          if (param.max) paramDef.max = parseFloat(param.max)
        }

        // Pattern for strings
        if (param.type === "string" && param.pattern) {
          paramDef.pattern = param.pattern
        }

        return paramDef
      })

      // Prepare queries array (new) or single query (legacy)
      const queries = data.queries && data.queries.length > 0 ? data.queries : undefined
      const singleQuery =
        !queries && data.queryText
          ? {
              dialect: "sql" as const,
              text: data.queryText,
              parameters: parameterDefinitions,
            }
          : undefined

      // For multiple queries, derive default dataSourceRef from first SQL query if not set
      let defaultDataSourceRef = data.dataSourceRef
      if (queries && queries.length > 0 && (!defaultDataSourceRef || defaultDataSourceRef.trim().length === 0)) {
        const firstSqlQuery = queries.find((q) => "dialect" in q && q.dialect === "sql" && "dataSourceRef" in q)
        if (firstSqlQuery && "dataSourceRef" in firstSqlQuery && firstSqlQuery.dataSourceRef) {
          defaultDataSourceRef = firstSqlQuery.dataSourceRef
        }
      }

      // Ensure we have a dataSourceRef (required by API)
      if (!defaultDataSourceRef || defaultDataSourceRef.trim().length === 0) {
        throw new Error("Data source reference is required")
      }

      // Create graph via API
      const response = await fetch("/api/graphs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Workspace-Id": workspaceId,
        },
        credentials: "include",
        body: JSON.stringify({
          title: data.title,
          dataSourceRef: defaultDataSourceRef,
          connectorRef: data.connectorRef || undefined,
          query: singleQuery,
          queries: queries,
          parameterSchema: {
            parameters: parameterDefinitions,
          },
          visualization: {
            type: data.visualizationType,
            options: visualizationOptions,
          },
          timeRange: data.timeRange,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create graph")
      }

      const result = await response.json()
      const graphId = result.graphId

      // Add graph to dashboard at default position
      const dashboardResponse = await fetch(`/api/dashboards/${dashboardId}`, {
        headers: {
          "X-Workspace-Id": workspaceId,
        },
        credentials: "include",
      })

      if (dashboardResponse.ok) {
        const dashboardData = await dashboardResponse.json()
        const currentLayout = dashboardData.dashboard.layout || {
          grid: { columns: 12, rows: 8 },
          tiles: [],
        }

        // Add new tile at bottom
        const maxY =
          currentLayout.tiles.length > 0
            ? Math.max(
                ...currentLayout.tiles.map(
                  (tile: { position: { y: number; h: number } }) => tile.position.y + tile.position.h
                ),
                0
              )
            : 0

        const updatedTiles = [
          ...currentLayout.tiles,
          {
            graphRef: graphId,
            position: {
              x: 0,
              y: maxY,
              w: 4,
              h: 3,
            },
          },
        ]

        // Update dashboard with new tile
        const updateResponse = await fetch(`/api/dashboards/${dashboardId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Workspace-Id": workspaceId,
          },
          credentials: "include",
          body: JSON.stringify({
            layout: {
              ...currentLayout,
              tiles: updatedTiles,
            },
          }),
        })

        if (!updateResponse.ok) {
          console.error("Failed to add graph to dashboard, but graph was created")
        }
      }

      // Redirect back to dashboard
      router.push(`/dashboards/${dashboardId}`)
    } catch (err) {
      console.error("Failed to create graph:", err)
      setError(err instanceof Error ? err.message : "Failed to create graph")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!workspaceId) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <h2 className="text-3xl font-bold mb-4">No Workspace Linked</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              You need to link a Usable workspace to get started with Graphable.
            </p>
            <Link href="/onboarding/link-workspace" className={cn(buttonVariants())}>
              Link Workspace
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/dashboards/${dashboardId}`}
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Create New Graph</h1>
                <p className="text-sm text-muted-foreground">Configure your graph and see a live preview</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboards/${dashboardId}`}
                className={cn(buttonVariants({ variant: "outline" }), isSubmitting && "pointer-events-none opacity-50")}
              >
                Cancel
              </Link>
              <Button
                onClick={async () => {
                  console.log("Create button clicked")
                  console.log("Form errors:", form.formState.errors)
                  console.log("Form values:", form.getValues())

                  const submitHandler = handleSubmit(
                    async (data) => {
                      console.log("Form is valid, submitting:", data)
                      await onSubmit(data)
                    },
                    (errors) => {
                      console.error("Form validation failed:", errors)
                      const firstError = Object.values(errors)[0]
                      if (firstError) {
                        setError(firstError.message || "Please fix form errors")
                      } else {
                        setError("Please fix form errors before submitting")
                      }
                    }
                  )

                  await submitHandler()
                }}
                disabled={isSubmitting}
                type="button"
              >
                {isSubmitting ? (
                  <>
                    <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Time Range & Refresh */}
      {(() => {
        // Check if time range is disabled in visualization options
        let disableTimeRange = false
        try {
          const visualizationOptions = watch("visualizationOptions")
          if (visualizationOptions) {
            const parsed = JSON.parse(visualizationOptions)
            disableTimeRange = parsed.disableTimeRange === true
          }
        } catch {
          // Invalid JSON, show time range selector
        }

        if (disableTimeRange) {
          return null
        }

        return (
          <div className="container mx-auto px-4 py-2">
            <TimeRangeSelector />
          </div>
        )
      })()}

      {/* Main Content - Two Column Layout */}
      <main className="container mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Graph & Query */}
          <div className="lg:col-span-2 space-y-4">
            {/* Graph Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[400px] w-full">
                  <GraphPreview formData={formData} workspaceId={workspaceId} />
                </div>
              </CardContent>
            </Card>

            {/* Queries Editor */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Queries</CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const previewFn = executePreview
                      if (previewFn && typeof previewFn === "function") {
                        try {
                          await previewFn()
                          // Trigger refresh after successful execution to ensure preview updates
                          // This ensures the preview component re-renders with the new data
                          triggerRefresh()
                        } catch (error) {
                          // Error already handled in executePreview, don't trigger refresh
                          console.error("Failed to execute preview:", error)
                        }
                      } else {
                        console.warn("executePreview is not available or not a function", {
                          executePreview,
                          type: typeof executePreview,
                        })
                      }
                    }}
                    disabled={!executePreview}
                  >
                    <PlayIcon className="h-4 w-4 mr-2" />
                    Run queries
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <QueriesEditor form={form} dataSources={dataSources} defaultDataSourceRef={dataSourceRef} />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Settings */}
          <div className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Basic Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field>
                    <FieldLabel>
                      Title <span className="text-destructive">*</span>
                    </FieldLabel>
                    <FieldContent>
                      <Input {...register("title")} placeholder="My Graph" aria-invalid={!!errors.title} />
                      <FieldError errors={errors.title ? [errors.title] : undefined} />
                    </FieldContent>
                  </Field>

                  {/* Only show default data source selector when not using multiple queries */}
                  {!hasMultipleQueries ? (
                    <Field>
                      <FieldLabel>
                        Data Source <span className="text-destructive">*</span>
                      </FieldLabel>
                      <FieldContent>
                        {isLoadingDataSources ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2Icon className="h-4 w-4 animate-spin" />
                            Loading data sources...
                          </div>
                        ) : (
                          <Select
                            value={dataSourceRef || undefined}
                            onValueChange={(value: string | null) => {
                              if (value) {
                                setValue("dataSourceRef", value)
                              }
                            }}
                            aria-invalid={!!errors.dataSourceRef}
                          >
                            <SelectTrigger>
                              <SelectValue>
                                {dataSourceRef
                                  ? dataSources.find((ds) => ds.fragmentId === (dataSourceRef || ""))?.name ||
                                    dataSourceRef
                                  : "Select a data source"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {dataSources.length === 0 ? (
                                <div className="p-2 text-sm text-muted-foreground">No data sources available</div>
                              ) : (
                                dataSources.map((ds) => (
                                  <SelectItem key={ds.fragmentId} value={ds.fragmentId}>
                                    {ds.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        )}
                        <FieldDescription>Select a data source to query</FieldDescription>
                        <FieldError errors={errors.dataSourceRef ? [errors.dataSourceRef] : undefined} />
                      </FieldContent>
                    </Field>
                  ) : null}
                </CardContent>
              </Card>

              {/* Visualization Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Visualization</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field>
                    <FieldLabel>
                      Visualization Type <span className="text-destructive">*</span>
                    </FieldLabel>
                    <FieldContent>
                      <Select
                        value={watch("visualizationType")}
                        onValueChange={(value) =>
                          setValue("visualizationType", value as "line" | "bar" | "table" | "pie" | "scatter" | "area")
                        }
                      >
                        <SelectTrigger>
                          <SelectValue>Select visualization type</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="table">Table</SelectItem>
                          <SelectItem value="line">Line Chart</SelectItem>
                          <SelectItem value="bar">Bar Chart</SelectItem>
                          <SelectItem value="pie">Pie Chart</SelectItem>
                          <SelectItem value="scatter">Scatter Plot</SelectItem>
                          <SelectItem value="area">Area Chart</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldError errors={errors.visualizationType ? [errors.visualizationType] : undefined} />
                    </FieldContent>
                  </Field>

                  {/* Visualization Options */}
                  {/* @ts-expect-error - Form type mismatch due to optional fields, but structure is compatible */}
                  <VisualizationOptionsEditor form={form} />
                </CardContent>
              </Card>

              {/* Parameters */}
              {/* @ts-expect-error - Form type mismatch due to optional fields, but structure is compatible */}
              <GraphParametersEditor form={form} />
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function NewGraphPage() {
  return (
    <GraphEditorProvider>
      <NewGraphPageContent />
    </GraphEditorProvider>
  )
}
