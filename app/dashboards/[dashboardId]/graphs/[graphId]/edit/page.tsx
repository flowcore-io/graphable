"use client"

import { GraphParametersEditor } from "@/components/graph-parameters-editor"
import { GraphPreview } from "@/components/graph-preview"
import { SqlQueryEditor } from "@/components/sql-query-editor"
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
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

// Graph creation form schema (same for edit)
const createGraphFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  dataSourceRef: z.string().min(1, "Data source reference is required"),
  connectorRef: z.string().optional(),
  queryText: z.string().min(1, "Query text is required"),
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

type CreateGraphFormData = z.infer<typeof createGraphFormSchema>

function EditGraphPageContent() {
  const { workspaceId } = useWorkspace()
  const router = useRouter()
  const params = useParams()
  const dashboardId = params.dashboardId as string
  const graphId = params.graphId as string
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dataSources, setDataSources] = useState<Array<{ id: string; fragmentId: string; name: string }>>([])
  const [isLoadingDataSources, setIsLoadingDataSources] = useState(false)
  // Store original graph data to preserve fields not in the form (queries, cachePolicy)
  const [originalGraph, setOriginalGraph] = useState<{
    queries?: unknown[]
    cachePolicy?: { ttl?: number }
  } | null>(null)
  // Track if we've already executed the initial preview
  const hasExecutedInitialPreview = useRef(false)

  const form = useForm<CreateGraphFormData>({
    resolver: zodResolver(createGraphFormSchema),
    defaultValues: {
      title: "",
      dataSourceRef: "",
      connectorRef: "",
      queryText: "",
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
    reset,
  } = form

  const parameters = watch("parameters")
  const formData = watch()
  const dataSourceRef = watch("dataSourceRef")
  const queryText = watch("queryText")
  const timeRange = watch("timeRange")

  const {
    timeRange: contextTimeRange,
    setTimeRange: setContextTimeRange,
    setParameters: setContextParameters,
    executePreview,
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

  // Reset initial preview flag when graphId changes
  useEffect(() => {
    hasExecutedInitialPreview.current = false
  }, [graphId])

  // Load existing graph data
  useEffect(() => {
    async function loadGraph() {
      if (!workspaceId || !graphId) return

      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/graphs/${graphId}`, {
          headers: {
            "X-Workspace-Id": workspaceId,
          },
          credentials: "include",
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to load graph")
        }

        const data = await response.json()
        const graph = data.graph

        // Store original graph data to preserve fields not in the form
        setOriginalGraph({
          queries: graph.queries,
          cachePolicy: graph.cachePolicy,
        })

        // Handle both legacy single query and new multiple queries format
        // If graph has queries array, extract the first SQL query's text for editing
        let queryText = graph.query?.text || ""
        if (!queryText && graph.queries && Array.isArray(graph.queries) && graph.queries.length > 0) {
          // Find first SQL query
          const firstSqlQuery = graph.queries.find(
            (q: unknown) => typeof q === "object" && q !== null && "dialect" in q && q.dialect === "sql"
          )
          if (firstSqlQuery && typeof firstSqlQuery === "object" && "text" in firstSqlQuery) {
            queryText = String(firstSqlQuery.text)
          }
        }

        // Populate form with existing graph data
        reset({
          title: graph.title || "",
          dataSourceRef: graph.dataSourceRef || "",
          connectorRef: graph.connectorRef || "",
          queryText,
          visualizationType: graph.visualization?.type || "table",
          visualizationOptions: graph.visualization?.options
            ? JSON.stringify(graph.visualization.options, null, 2)
            : "{}",
          timeRange: graph.timeRange || undefined,
          parameters: (graph.parameterSchema?.parameters || []).map((param: ParameterDefinition) => ({
            name: param.name,
            type: param.type,
            required: param.required,
            default: param.default ? String(param.default) : "",
            enumValues: param.enumValues ? param.enumValues.join(", ") : "",
            min: param.min ? String(param.min) : "",
            max: param.max ? String(param.max) : "",
            pattern: param.pattern || "",
          })),
        })
      } catch (err) {
        console.error("Failed to load graph:", err)
        setError(err instanceof Error ? err.message : "Failed to load graph")
      } finally {
        setIsLoading(false)
      }
    }

    loadGraph()
  }, [workspaceId, graphId, reset])

  // Auto-execute preview when graph is loaded and form is ready (only once)
  useEffect(() => {
    // Only execute if:
    // 1. Graph has finished loading (not in loading state)
    // 2. executePreview function is available
    // 3. Required fields are present (queryText and dataSourceRef)
    // 4. We haven't executed the initial preview yet
    if (
      !isLoading &&
      !hasExecutedInitialPreview.current &&
      executePreview &&
      queryText &&
      queryText.trim().length > 0 &&
      dataSourceRef &&
      dataSourceRef.trim().length > 0
    ) {
      // Small delay to ensure form state is fully synced
      const timer = setTimeout(() => {
        hasExecutedInitialPreview.current = true
        void executePreview()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isLoading, executePreview, queryText, dataSourceRef])

  const onSubmit = async (data: CreateGraphFormData) => {
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

      // Prepare update payload
      const updatePayload: Record<string, unknown> = {
        title: data.title,
        dataSourceRef: data.dataSourceRef,
        connectorRef: data.connectorRef || undefined,
        parameterSchema: {
          parameters: parameterDefinitions,
        },
        visualization: {
          type: data.visualizationType,
          options: visualizationOptions,
        },
        timeRange: data.timeRange,
      }

      // Only send query if the original graph didn't have queries array
      // (to preserve queries array if it exists)
      if (!originalGraph?.queries || originalGraph.queries.length === 0) {
        updatePayload.query = {
          dialect: "sql",
          text: data.queryText,
          parameters: parameterDefinitions,
        }
      }
      // Note: If original graph had queries, we preserve it by not sending query
      // The form only supports editing single queries, so queries array is preserved as-is

      // Preserve cachePolicy if it existed in the original graph
      if (originalGraph?.cachePolicy) {
        updatePayload.cachePolicy = originalGraph.cachePolicy
      }

      // Update graph via API
      const response = await fetch(`/api/graphs/${graphId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Workspace-Id": workspaceId,
        },
        credentials: "include",
        body: JSON.stringify(updatePayload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update graph")
      }

      // Redirect back to dashboard
      router.push(`/dashboards/${dashboardId}`)
    } catch (err) {
      console.error("Failed to update graph:", err)
      setError(err instanceof Error ? err.message : "Failed to update graph")
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <p className="text-sm text-muted-foreground">Loading graph...</p>
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
                <h1 className="text-2xl font-bold">Edit Graph</h1>
                <p className="text-sm text-muted-foreground">Update your graph configuration and see a live preview</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboards/${dashboardId}`}
                className={cn(buttonVariants({ variant: "outline" }), isSubmitting && "pointer-events-none opacity-50")}
              >
                Cancel
              </Link>
              <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update"
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

            {/* Query Editor */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Query</CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (executePreview) {
                        void executePreview()
                      }
                    }}
                    disabled={!queryText || !dataSourceRef || !executePreview}
                  >
                    <PlayIcon className="h-4 w-4 mr-2" />
                    Run
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <SqlQueryEditor
                  value={queryText}
                  onChange={(value) => setValue("queryText", value)}
                  error={errors.queryText}
                />
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
                          value={dataSourceRef}
                          onValueChange={(value) => setValue("dataSourceRef", value || "")}
                          aria-invalid={!!errors.dataSourceRef}
                        >
                          <SelectTrigger>
                            <SelectValue>
                              {dataSourceRef
                                ? dataSources.find((ds) => ds.fragmentId === dataSourceRef)?.name || dataSourceRef
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

export default function EditGraphPage() {
  return (
    <GraphEditorProvider>
      <EditGraphPageContent />
    </GraphEditorProvider>
  )
}
