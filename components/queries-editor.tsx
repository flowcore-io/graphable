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
    name: "queries",
  })

  const getNextRefId = (): string => {
    const usedRefIds = queries.map((q: QueryOrExpression) => q.refId)
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
    } as QueryDefinition)
  }

  const addExpression = () => {
    const nextRefId = getNextRefId()
    append({
      refId: nextRefId,
      operation: "math",
      expression: "",
      hidden: false,
    } as ExpressionDefinition)
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
                  {isExpression ? `${query.refId} (Expression)` : query.refId}
                </CardTitle>
                <Input
                  {...form.register(`queries.${index}.name`)}
                  placeholder={isExpression ? `Expression ${query.refId}` : `Query ${query.refId}`}
                  className="h-8 flex-1 min-w-0 max-w-xs"
                  onBlur={(e) => {
                    const value = e.target.value.trim()
                    form.setValue(`queries.${index}.name`, value || undefined)
                  }}
                />
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    {form.watch(`queries.${index}.hidden`) ? (
                      <EyeOffIcon className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <EyeIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Switch
                      checked={form.watch(`queries.${index}.hidden`) || false}
                      onCheckedChange={(checked) => form.setValue(`queries.${index}.hidden`, checked)}
                      aria-label="Hide from visualization"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isExpression ? (
                  <Select
                    value={form.watch(`queries.${index}.operation`)}
                    onValueChange={(value) => form.setValue(`queries.${index}.operation`, value)}
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
                        {...form.register(`queries.${index}.expression`)}
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
                        value={form.watch(`queries.${index}.dataSourceRef`)}
                        onValueChange={(value) => form.setValue(`queries.${index}.dataSourceRef`, value)}
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {(() => {
                              const selectedDataSourceRef = form.watch(`queries.${index}.dataSourceRef`)
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
                    value={form.watch(`queries.${index}.text`) || ""}
                    onChange={(value) => form.setValue(`queries.${index}.text`, value)}
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




