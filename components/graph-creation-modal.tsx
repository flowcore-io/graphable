"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { ParameterDefinition } from "@/lib/services/graph.service"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon, PlusIcon, TrashIcon } from "lucide-react"
import { useEffect, useState } from "react"
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

interface GraphCreationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dashboardId: string
  workspaceId: string
  onGraphCreated?: (graphId: string) => void
}

/**
 * Inline graph creation modal/form
 * Creates graphs directly on the dashboard
 */
export function GraphCreationModal({
  open,
  onOpenChange,
  dashboardId: _dashboardId,
  workspaceId,
  onGraphCreated,
}: GraphCreationModalProps) {
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
  const dataSourceRef = watch("dataSourceRef")

  // Fetch available data sources
  useEffect(() => {
    if (!workspaceId || !open) return

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
  }, [workspaceId, open])

  const onSubmit = async (data: CreateGraphFormData) => {
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

      // Notify parent component - it will handle adding to dashboard
      if (onGraphCreated) {
        onGraphCreated(graphId)
      }

      // Close modal
      onOpenChange(false)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full max-h-full h-screen w-screen m-0 rounded-none flex flex-col">
        <DialogHeader className="shrink-0 pb-4 border-b">
          <DialogTitle>Create New Graph</DialogTitle>
          <DialogDescription>Configure your graph and add it to the dashboard</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-1">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="query">Query</TabsTrigger>
                <TabsTrigger value="parameters">Parameters</TabsTrigger>
              </TabsList>

              {/* Basic Tab */}
              <TabsContent value="basic" className="space-y-4">
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
              </TabsContent>

              {/* Query Tab */}
              <TabsContent value="query" className="space-y-4">
                <Field>
                  <FieldLabel>
                    SQL Query <span className="text-destructive">*</span>
                  </FieldLabel>
                  <FieldContent>
                    <Textarea
                      {...register("queryText")}
                      placeholder="SELECT * FROM table WHERE id = :id"
                      rows={10}
                      className="font-mono text-sm"
                      aria-invalid={!!errors.queryText}
                    />
                    <FieldDescription>
                      Use :paramName or $1, $2 for parameters. Example: SELECT * FROM users WHERE age &gt; :minAge
                    </FieldDescription>
                    <FieldError errors={errors.queryText ? [errors.queryText] : undefined} />
                  </FieldContent>
                </Field>
              </TabsContent>

              {/* Parameters Tab */}
              <TabsContent value="parameters" className="space-y-4">
                <div className="flex items-center justify-between">
                  <FieldDescription>Define parameters for your query</FieldDescription>
                  <Button type="button" variant="outline" size="sm" onClick={addParameter}>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Parameter
                  </Button>
                </div>

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
                            <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeParameter(index)}>
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
                            <input type="checkbox" {...register(`parameters.${index}.required`)} className="rounded" />
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
                                      <Input {...register(`parameters.${index}.max`)} type="number" placeholder="100" />
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
              </TabsContent>
            </Tabs>

            {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mt-4">{error}</div>}
          </div>

          <DialogFooter className="shrink-0 pt-4 border-t mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
