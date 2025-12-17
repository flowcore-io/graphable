"use client"

import { GraphPreview } from "@/components/graph-preview"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useWorkspace } from "@/lib/context/workspace-context"
import type { ParameterDefinition } from "@/lib/services/graph.service"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon, Loader2Icon, PlusIcon, TrashIcon } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

// Graph creation form schema
const createGraphFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  dataSourceRef: z.string().min(1, "Data source reference is required"),
  connectorRef: z.string().optional(),
  queryText: z.string().min(1, "Query text is required"),
  visualizationType: z.enum(["line", "bar", "table", "pie", "scatter", "area"]),
  visualizationOptions: z.string().optional(), // JSON string
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

export default function NewGraphPage() {
  const { workspaceId } = useWorkspace()
  const router = useRouter()
  const params = useParams()
  const dashboardId = params.dashboardId as string
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dataSources, setDataSources] = useState<Array<{ id: string; fragmentId: string; name: string }>>([])
  const [isLoadingDataSources, setIsLoadingDataSources] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<CreateGraphFormData>({
    resolver: zodResolver(createGraphFormSchema),
    defaultValues: {
      title: "",
      dataSourceRef: "",
      connectorRef: "",
      queryText: "",
      visualizationType: "table",
      visualizationOptions: "{}",
      parameters: [],
    },
  })

  const parameters = watch("parameters")
  const formData = watch()
  const dataSourceRef = watch("dataSourceRef")

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
          dataSourceRef: data.dataSourceRef,
          connectorRef: data.connectorRef || undefined,
          query: {
            dialect: "sql",
            text: data.queryText,
            parameters: parameterDefinitions,
          },
          parameterSchema: {
            parameters: parameterDefinitions,
          },
          visualization: {
            type: data.visualizationType,
            options: visualizationOptions,
          },
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

  const addParameter = () => {
    const currentParams = watch("parameters")
    setValue("parameters", [
      ...currentParams,
      {
        name: "",
        type: "string",
        required: false,
        default: "",
        enumValues: "",
        min: "",
        max: "",
        pattern: "",
      },
    ])
  }

  const removeParameter = (index: number) => {
    const currentParams = watch("parameters")
    setValue(
      "parameters",
      currentParams.filter((_, i) => i !== index)
    )
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
            <Button asChild>
              <Link href="/onboarding/link-workspace">Link Workspace</Link>
            </Button>
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
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/dashboards/${dashboardId}`}>
                  <ArrowLeftIcon className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Create New Graph</h1>
                <p className="text-sm text-muted-foreground">Configure your graph and see a live preview</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild disabled={isSubmitting}>
                <Link href={`/dashboards/${dashboardId}`}>Cancel</Link>
              </Button>
              <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
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

      {/* Main Content - Split Layout */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Side - Graph Preview */}
          <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-8rem)]">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent className="h-[calc(100%-4rem)] overflow-auto">
                <GraphPreview formData={formData} workspaceId={workspaceId} />
              </CardContent>
            </Card>
          </div>

          {/* Right Side - Form */}
          <div className="space-y-6">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                          onValueChange={(value) => setValue("dataSourceRef", value)}
                          aria-invalid={!!errors.dataSourceRef}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a data source" />
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

                  <Field>
                    <FieldLabel>Connector Reference</FieldLabel>
                    <FieldContent>
                      <Input
                        {...register("connectorRef")}
                        placeholder="connector-id (optional)"
                        aria-invalid={!!errors.connectorRef}
                      />
                      <FieldError errors={errors.connectorRef ? [errors.connectorRef] : undefined} />
                    </FieldContent>
                  </Field>
                </CardContent>
              </Card>

              {/* Query Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Query</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field>
                    <FieldLabel>
                      SQL Query <span className="text-destructive">*</span>
                    </FieldLabel>
                    <FieldContent>
                      <Textarea
                        {...register("queryText")}
                        placeholder="SELECT * FROM table WHERE id = :id"
                        rows={8}
                        className="font-mono text-sm"
                        aria-invalid={!!errors.queryText}
                      />
                      <FieldDescription>
                        Use :paramName or $1, $2 for parameters. Example: SELECT * FROM users WHERE age &gt; :minAge
                      </FieldDescription>
                      <FieldError errors={errors.queryText ? [errors.queryText] : undefined} />
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
                          <SelectValue placeholder="Select visualization type" />
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

                  <Field>
                    <FieldLabel>Visualization Options (JSON)</FieldLabel>
                    <FieldContent>
                      <Textarea
                        {...register("visualizationOptions")}
                        placeholder='{"colors": ["#8884d8", "#82ca9d"], "showLegend": true}'
                        rows={4}
                      />
                      <FieldDescription>Optional JSON configuration for visualization styling</FieldDescription>
                    </FieldContent>
                  </Field>
                </CardContent>
              </Card>

              {/* Parameters */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Parameters</CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={addParameter}>
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Add Parameter
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {parameters.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No parameters defined. Click "Add Parameter" to add one.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {parameters.map((param, index) => {
                        const paramKey = param.name ? `param-${param.name}-${index}` : `param-${index}`
                        return (
                          <div key={paramKey} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium">Parameter {index + 1}</Label>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => removeParameter(index)}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <Field>
                                <FieldLabel>
                                  Name <span className="text-destructive">*</span>
                                </FieldLabel>
                                <FieldContent>
                                  <Input
                                    {...register(`parameters.${index}.name`)}
                                    placeholder="paramName"
                                    aria-invalid={!!errors.parameters?.[index]?.name}
                                  />
                                  <FieldError
                                    errors={
                                      errors.parameters?.[index]?.name
                                        ? [errors.parameters[index]?.name ?? { message: "Invalid parameter name" }]
                                        : undefined
                                    }
                                  />
                                </FieldContent>
                              </Field>

                              <Field>
                                <FieldLabel>
                                  Type <span className="text-destructive">*</span>
                                </FieldLabel>
                                <FieldContent>
                                  <Select
                                    value={watch(`parameters.${index}.type`)}
                                    onValueChange={(value) =>
                                      setValue(
                                        `parameters.${index}.type`,
                                        value as
                                          | "string"
                                          | "number"
                                          | "boolean"
                                          | "date"
                                          | "timestamp"
                                          | "enum"
                                          | "string[]"
                                          | "number[]"
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="string">String</SelectItem>
                                      <SelectItem value="number">Number</SelectItem>
                                      <SelectItem value="boolean">Boolean</SelectItem>
                                      <SelectItem value="date">Date</SelectItem>
                                      <SelectItem value="timestamp">Timestamp</SelectItem>
                                      <SelectItem value="enum">Enum</SelectItem>
                                      <SelectItem value="string[]">String Array</SelectItem>
                                      <SelectItem value="number[]">Number Array</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FieldContent>
                              </Field>
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                {...register(`parameters.${index}.required`)}
                                className="rounded"
                              />
                              <Label>Required</Label>
                            </div>

                            {watch(`parameters.${index}.type`) === "enum" && (
                              <Field>
                                <FieldLabel>Enum Values (comma-separated)</FieldLabel>
                                <FieldContent>
                                  <Input
                                    {...register(`parameters.${index}.enumValues`)}
                                    placeholder="value1, value2, value3"
                                  />
                                </FieldContent>
                              </Field>
                            )}

                            {(watch(`parameters.${index}.type`) === "number" ||
                              watch(`parameters.${index}.type`) === "string") && (
                              <div className="grid grid-cols-2 gap-3">
                                {watch(`parameters.${index}.type`) === "number" && (
                                  <>
                                    <Field>
                                      <FieldLabel>Min</FieldLabel>
                                      <FieldContent>
                                        <Input {...register(`parameters.${index}.min`)} type="number" placeholder="0" />
                                      </FieldContent>
                                    </Field>
                                    <Field>
                                      <FieldLabel>Max</FieldLabel>
                                      <FieldContent>
                                        <Input
                                          {...register(`parameters.${index}.max`)}
                                          type="number"
                                          placeholder="100"
                                        />
                                      </FieldContent>
                                    </Field>
                                  </>
                                )}
                                {watch(`parameters.${index}.type`) === "string" && (
                                  <Field>
                                    <FieldLabel>Pattern (regex)</FieldLabel>
                                    <FieldContent>
                                      <Input {...register(`parameters.${index}.pattern`)} placeholder="^[A-Z]+$" />
                                    </FieldContent>
                                  </Field>
                                )}
                              </div>
                            )}

                            <Field>
                              <FieldLabel>Default Value</FieldLabel>
                              <FieldContent>
                                <Input
                                  {...register(`parameters.${index}.default`)}
                                  placeholder="default value (optional)"
                                />
                              </FieldContent>
                            </Field>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
