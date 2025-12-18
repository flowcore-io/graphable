"use client"

import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { PlusIcon, TrashIcon } from "lucide-react"
import { useCallback, useEffect } from "react"
import type { UseFormReturn } from "react-hook-form"

interface VisualizationOptionsEditorProps {
  form: UseFormReturn<{
    visualizationOptions?: string
    visualizationType?: "line" | "bar" | "table" | "pie" | "scatter" | "area"
    [key: string]: unknown
  }>
}

interface VisualizationOptions {
  colors?: string[]
  showLegend?: boolean
  disableTimeRange?: boolean
  unit?: string
  customUnit?: string
}

/**
 * Form-based editor for visualization options
 * Converts between form fields and JSON for storage
 */
export function VisualizationOptionsEditor({ form }: VisualizationOptionsEditorProps) {
  const { watch, setValue } = form
  const visualizationType = watch("visualizationType")
  const visualizationOptionsJson = watch("visualizationOptions") || "{}"

  // Parse JSON to form state
  let parsedOptions: VisualizationOptions = {}
  try {
    parsedOptions = JSON.parse(visualizationOptionsJson) as VisualizationOptions
  } catch {
    parsedOptions = {}
  }

  const colors = parsedOptions.colors || []
  const showLegend = parsedOptions.showLegend ?? true
  const disableTimeRange = parsedOptions.disableTimeRange ?? false
  const unit = parsedOptions.unit || ""

  // Update JSON when form values change
  const updateJson = useCallback(
    (newOptions: VisualizationOptions) => {
      try {
        const jsonString = JSON.stringify(newOptions, null, 2)
        setValue("visualizationOptions", jsonString, { shouldValidate: true })
      } catch (error) {
        console.error("Failed to serialize visualization options:", error)
      }
    },
    [setValue]
  )

  // Initialize with default colors if empty
  useEffect(() => {
    if (colors.length === 0 && visualizationType && visualizationType !== "table") {
      const defaultColors = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#00ff00"]
      updateJson({ colors: defaultColors, showLegend })
    }
  }, [visualizationType, colors.length, showLegend, updateJson])

  const handleColorChange = (index: number, value: string) => {
    const newColors = [...colors]
    newColors[index] = value
    updateJson({ ...parsedOptions, colors: newColors })
  }

  const handleAddColor = () => {
    const newColors = [...colors, "#8884d8"]
    updateJson({ ...parsedOptions, colors: newColors })
  }

  const handleRemoveColor = (index: number) => {
    const newColors = colors.filter((_, i) => i !== index)
    updateJson({ ...parsedOptions, colors: newColors.length > 0 ? newColors : undefined })
  }

  const handleShowLegendChange = (checked: boolean) => {
    updateJson({ ...parsedOptions, showLegend: checked })
  }

  const handleDisableTimeRangeChange = (checked: boolean) => {
    updateJson({ ...parsedOptions, disableTimeRange: checked })
  }

  const handleUnitChange = (value: string) => {
    const newOptions: VisualizationOptions = { ...parsedOptions, unit: value || undefined }
    // Remove customUnit if unit is not "custom"
    if (value !== "custom") {
      delete newOptions.customUnit
    }
    updateJson(newOptions)
  }

  // Don't show options for table type
  if (visualizationType === "table") {
    return null
  }

  return (
    <div className="space-y-4">
      <Field>
        <FieldLabel>Unit</FieldLabel>
        <FieldContent>
          <Select value={unit || ""} onValueChange={handleUnitChange}>
            <SelectTrigger>
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              <SelectItem value="%">Percent (%)</SelectItem>
              <SelectItem value="$">Currency ($)</SelectItem>
              <SelectItem value="€">Currency (€)</SelectItem>
              <SelectItem value="£">Currency (£)</SelectItem>
              <SelectItem value="s">Time (seconds)</SelectItem>
              <SelectItem value="ms">Time (milliseconds)</SelectItem>
              <SelectItem value="B">Bytes</SelectItem>
              <SelectItem value="KB">Kilobytes</SelectItem>
              <SelectItem value="MB">Megabytes</SelectItem>
              <SelectItem value="GB">Gigabytes</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {unit === "custom" && (
            <Input
              placeholder="Enter custom unit"
              value={parsedOptions.customUnit || ""}
              onChange={(e) => updateJson({ ...parsedOptions, customUnit: e.target.value || undefined })}
              className="mt-2"
            />
          )}
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel>Show Legend</FieldLabel>
        <FieldContent>
          <div className="flex items-center gap-2">
            <Switch checked={showLegend} onCheckedChange={handleShowLegendChange} />
            <span className="text-sm text-muted-foreground">Display chart legend</span>
          </div>
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel>Disable Time Range</FieldLabel>
        <FieldContent>
          <div className="flex items-center gap-2">
            <Switch checked={disableTimeRange} onCheckedChange={handleDisableTimeRangeChange} />
            <span className="text-sm text-muted-foreground">
              Disable time range filtering for this graph (use all data)
            </span>
          </div>
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel>Colors</FieldLabel>
        <FieldDescription>
          Customize colors for data series. Colors cycle if there are more series than colors.
        </FieldDescription>
        <FieldContent>
          <div className="space-y-2">
            {colors.map((color, index) => (
              <div key={`color-${index}-${color}`} className="flex items-center gap-2">
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => handleColorChange(index, e.target.value)}
                  className="w-16 h-10 cursor-pointer"
                />
                <Input
                  type="text"
                  value={color}
                  onChange={(e) => handleColorChange(index, e.target.value)}
                  placeholder="#8884d8"
                  className="flex-1"
                />
                {colors.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveColor(index)}
                    aria-label="Remove color"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={handleAddColor} className="w-full">
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Color
            </Button>
          </div>
        </FieldContent>
      </Field>
    </div>
  )
}




