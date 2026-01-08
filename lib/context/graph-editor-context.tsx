"use client"

import { createContext, type ReactNode, useCallback, useContext, useState } from "react"

type TimeRange = "1h" | "7d" | "30d" | "90d" | "180d" | "365d" | "all" | "custom"

interface GraphEditorContextValue {
  // Time range state
  timeRange: TimeRange | undefined
  setTimeRange: (range: TimeRange | undefined) => void
  customTimeFrom: string
  customTimeTo: string
  setCustomTimeRange: (from: string, to: string) => void

  // Refresh trigger
  refreshTrigger: number
  triggerRefresh: () => void

  // Parameters
  parameters: Array<{
    name: string
    type: string
    required: boolean
  }>
  setParameters: (params: Array<{ name: string; type: string; required: boolean }>) => void

  // Execute preview function (set by GraphPreview component)
  executePreview: (() => Promise<void>) | null
  setExecutePreview: (fn: (() => Promise<void>) | null) => void
}

const GraphEditorContext = createContext<GraphEditorContextValue | undefined>(undefined)

export function GraphEditorProvider({ children }: { children: ReactNode }) {
  const [timeRange, setTimeRange] = useState<TimeRange | undefined>("1h")
  const [customTimeFrom, setCustomTimeFrom] = useState("now-1h")
  const [customTimeTo, setCustomTimeTo] = useState("now")
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [parameters, setParameters] = useState<Array<{ name: string; type: string; required: boolean }>>([])
  const [executePreview, setExecutePreview] = useState<(() => Promise<void>) | null>(null)

  const setCustomTimeRange = useCallback((from: string, to: string) => {
    setCustomTimeFrom(from)
    setCustomTimeTo(to)
  }, [])

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1)
  }, [])

  return (
    <GraphEditorContext.Provider
      value={{
        timeRange,
        setTimeRange,
        customTimeFrom,
        customTimeTo,
        setCustomTimeRange,
        refreshTrigger,
        triggerRefresh,
        parameters,
        setParameters,
        executePreview,
        setExecutePreview,
      }}
    >
      {children}
    </GraphEditorContext.Provider>
  )
}

export function useGraphEditor() {
  const context = useContext(GraphEditorContext)
  if (context === undefined) {
    throw new Error("useGraphEditor must be used within a GraphEditorProvider")
  }
  return context
}
