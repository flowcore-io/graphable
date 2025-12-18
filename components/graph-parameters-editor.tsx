"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusIcon, TrashIcon } from "lucide-react"
import type { UseFormReturn } from "react-hook-form"

interface GraphParametersEditorProps {
  form: UseFormReturn<{
    title: string
    dataSourceRef: string
    connectorRef?: string
    queryText: string
    visualizationType: "line" | "bar" | "table" | "pie" | "scatter" | "area"
    visualizationOptions?: string
    timeRange?: "7d" | "30d" | "90d" | "180d" | "365d" | "all"
    parameters: Array<{
      name: string
      type: "string" | "number" | "boolean" | "date" | "timestamp" | "enum" | "string[]" | "number[]"
      required: boolean
      default?: string
      enumValues?: string
      min?: string
      max?: string
      pattern?: string
    }>
  }>
}

export function GraphParametersEditor({ form }: GraphParametersEditorProps) {
  const { watch, setValue, register, formState } = form
  const { errors } = formState
  const parameters = watch("parameters")

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
                          placeholder="value1, value2, value3, All"
                        />
                        <FieldDescription>
                          Add "All" as the last value to allow selecting all options (skips filter when selected)
                        </FieldDescription>
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
                      <Input {...register(`parameters.${index}.default`)} placeholder="default value (optional)" />
                    </FieldContent>
                  </Field>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}




