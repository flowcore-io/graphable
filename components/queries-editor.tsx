"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { CalculatorIcon, EyeIcon, EyeOffIcon, PlusIcon, TrashIcon } from "lucide-react"
import { type FieldValues, type UseFormReturn, useFieldArray } from "react-hook-form"
import { SqlQueryEditor } from "./sql-query-editor"
import { Input } from "./ui/input"

export interface QueryDefinition {
  refId: string
  dialect: "sql"
  text: string
  dataSourceRef: string
  parameters: Array<{
    name: string
    type: string
    required: boolean
    default?: unknown
  }>
}

export interface ExpressionDefinition {
  refId: string
  operation: "math" | "reduce" | "resample"
  expression: string
}

export type QueryOrExpression = QueryDefinition | ExpressionDefinition

interface QueriesEditorProps<T extends FieldValues = FieldValues> {
  form: UseFormReturn<T>
  dataSources: Array<{ id: string; fragmentId: string; name: string }>
  defaultDataSourceRef?: string
}

export function QueriesEditor<T extends FieldValues = FieldValues>({
  form,
  dataSources,
  defaultDataSourceRef,
}: QueriesEditorProps<T>) {
  const {
    fields: queries,
    append,
    remove,
  } = useFieldArray({
    control: form.control,
    name: "queries" as any, // Type assertion needed for dynamic form paths
  })

  const getNextRefId = (): string => {
    const usedRefIds = (queries as unknown as QueryOrExpression[]).map((q) => q.refId)
    const allLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
    for (const letter of allLetters) {
      if (!usedRefIds.includes(letter)) {
        return letter
      }
    }
    return "A" // Fallback
  }

  const addQuery = () => {
    const nextRefId = getNextRefId()
    append({
      refId: nextRefId,
      dialect: "sql",
      text: "",
      dataSourceRef: defaultDataSourceRef || dataSources[0]?.fragmentId || "",
      parameters: [],
      hidden: false,
    } as unknown as any)
  }

  const addExpression = () => {
    const nextRefId = getNextRefId()
    append({
      refId: nextRefId,
      operation: "math",
      expression: "",
      hidden: false,
    } as unknown as any)
  }

  const removeQuery = (index: number) => {
    remove(index)
  }

  return (
    <div className="space-y-4">
      {queries.map((query, index) => {
        const isExpression = "operation" in query

        return (
          <Card key={query.id || index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <CardTitle className="text-base font-medium shrink-0">
                  {isExpression
                    ? `${(query as unknown as ExpressionDefinition).refId} (Expression)`
                    : (query as unknown as QueryDefinition).refId}
                </CardTitle>
                <Input
                  {...form.register(`queries.${index}.name` as any)}
                  placeholder={
                    isExpression
                      ? `Expression ${(query as unknown as ExpressionDefinition).refId}`
                      : `Query ${(query as unknown as QueryDefinition).refId}`
                  }
                  className="h-8 flex-1 min-w-0 max-w-xs"
                  onBlur={(e) => {
                    const value = e.target.value.trim()
                    form.setValue(`queries.${index}.name` as any, (value || undefined) as any)
                  }}
                />
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    {(form.watch(`queries.${index}.hidden` as any) as boolean | undefined) ? (
                      <EyeOffIcon className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <EyeIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Switch
                      checked={(form.watch(`queries.${index}.hidden` as any) as boolean | undefined) || false}
                      onCheckedChange={(checked) => form.setValue(`queries.${index}.hidden` as any, checked as any)}
                      aria-label="Hide from visualization"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isExpression ? (
                  <Select
                    value={(form.watch(`queries.${index}.operation` as any) as string | undefined) || ""}
                    onValueChange={(value) => form.setValue(`queries.${index}.operation` as any, (value || "") as any)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="math">Math</SelectItem>
                      <SelectItem value="reduce" disabled>
                        Reduce
                      </SelectItem>
                      <SelectItem value="resample" disabled>
                        Resample
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeQuery(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isExpression ? (
                <>
                  <Field>
                    <FieldLabel>Expression</FieldLabel>
                    <FieldContent>
                      <Input
                        {...form.register(`queries.${index}.expression` as any)}
                        placeholder="$A + $B"
                        className="font-mono"
                      />
                      <FieldDescription>
                        Math operations on one or more queries. Reference queries by $refId (e.g., $A, $B). Examples: $A
                        + $B, $A * 2, $A - $B
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                </>
              ) : (
                <>
                  <Field>
                    <FieldLabel>Data Source</FieldLabel>
                    <FieldContent>
                      <Select
                        value={(form.watch(`queries.${index}.dataSourceRef` as any) as string | undefined) || ""}
                        onValueChange={(value) =>
                          form.setValue(`queries.${index}.dataSourceRef` as any, (value || "") as any)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {(() => {
                              const selectedDataSourceRef = form.watch(`queries.${index}.dataSourceRef` as any) as
                                | string
                                | undefined
                              return selectedDataSourceRef
                                ? dataSources.find((ds) => ds.fragmentId === selectedDataSourceRef)?.name ||
                                    selectedDataSourceRef
                                : "Select data source"
                            })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {dataSources.map((ds) => (
                            <SelectItem key={ds.fragmentId} value={ds.fragmentId}>
                              {ds.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldContent>
                  </Field>
                  <SqlQueryEditor
                    value={(form.watch(`queries.${index}.text` as any) as string | undefined) || ""}
                    onChange={(value) => form.setValue(`queries.${index}.text` as any, (value || "") as any)}
                  />
                </>
              )}
            </CardContent>
          </Card>
        )
      })}

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={addQuery} className="flex items-center gap-2">
          <PlusIcon className="h-4 w-4" />
          Add query
        </Button>
        <Button type="button" variant="outline" onClick={addExpression} className="flex items-center gap-2">
          <CalculatorIcon className="h-4 w-4" />
          Add expression
        </Button>
      </div>
    </div>
  )
}
