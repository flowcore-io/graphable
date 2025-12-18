"use client"

import { Button, buttonVariants } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useGraphEditor } from "@/lib/context/graph-editor-context"
import { cn } from "@/lib/utils"
import { addHours, endOfDay, format, isValid, parse, startOfDay, subDays } from "date-fns"
import { CalendarIcon, ClockIcon, RefreshCwIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

const quickRanges = [
  { value: "1h", label: "Last 1 hour" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "180d", label: "Last 180 days" },
  { value: "365d", label: "Last 365 days" },
  { value: "all", label: "All Time" },
] as const

const RECENT_RANGES_KEY = "graphable-recent-time-ranges"
const MAX_RECENT_RANGES = 5

// Parse time string like "now-1h" or "2024-11-15 00:00:00"
function parseTimeString(timeStr: string): Date | null {
  if (timeStr.startsWith("now")) {
    const now = new Date()
    const match = timeStr.match(/now([+-]\d+)([hmd])/)
    if (match) {
      const amount = parseInt(match[1], 10)
      const unit = match[2]
      if (unit === "h") {
        return addHours(now, amount)
      } else if (unit === "m") {
        return addHours(now, amount / 60)
      } else if (unit === "d") {
        return addHours(now, amount * 24)
      }
    }
    return now
  }

  // Try parsing as date string
  const parsed = parse(timeStr, "yyyy-MM-dd HH:mm:ss", new Date())
  if (isValid(parsed)) {
    return parsed
  }

  // Try ISO format
  const isoParsed = new Date(timeStr)
  if (isValid(isoParsed)) {
    return isoParsed
  }

  return null
}

// Format date to time string
function formatTimeString(date: Date): string {
  return format(date, "yyyy-MM-dd HH:mm:ss")
}

// Get recently used ranges from localStorage
function getRecentRanges(): Array<{ from: string; to: string }> {
  if (typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem(RECENT_RANGES_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore errors
  }
  return []
}

// Save recently used range to localStorage
function saveRecentRange(from: string, to: string) {
  if (typeof window === "undefined") return
  try {
    const recent = getRecentRanges()
    const newRange = { from, to }
    // Remove duplicates
    const filtered = recent.filter((r) => !(r.from === from && r.to === to))
    // Add to beginning and limit
    const updated = [newRange, ...filtered].slice(0, MAX_RECENT_RANGES)
    localStorage.setItem(RECENT_RANGES_KEY, JSON.stringify(updated))
  } catch {
    // Ignore errors
  }
}

export function TimeRangeSelector() {
  const { timeRange, setTimeRange, customTimeFrom, customTimeTo, setCustomTimeRange, triggerRefresh } = useGraphEditor()
  const [open, setOpen] = useState(false)
  const [localFrom, setLocalFrom] = useState(customTimeFrom)
  const [localTo, setLocalTo] = useState(customTimeTo)
  const [fromCalendarOpen, setFromCalendarOpen] = useState(false)
  const [toCalendarOpen, setToCalendarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [recentRanges, setRecentRanges] = useState<Array<{ from: string; to: string }>>([])

  // Load recent ranges on mount
  useEffect(() => {
    setRecentRanges(getRecentRanges())
  }, [])

  // Sync local state with context when popover opens
  useEffect(() => {
    if (open) {
      setLocalFrom(customTimeFrom)
      setLocalTo(customTimeTo)
      setSearchQuery("")
    }
  }, [open, customTimeFrom, customTimeTo])

  // Parse dates for calendar
  const fromDate = useMemo(() => parseTimeString(localFrom), [localFrom])
  const toDate = useMemo(() => parseTimeString(localTo), [localTo])

  const currentLabel =
    timeRange === "custom"
      ? `${localFrom} to ${localTo}`
      : quickRanges.find((r) => r.value === timeRange)?.label || "Select time range"

  const handleQuickRangeSelect = (rangeValue: (typeof quickRanges)[number]["value"]) => {
    setTimeRange(rangeValue)
    setOpen(false)
  }

  const handleCustomApply = () => {
    setCustomTimeRange(localFrom, localTo)
    setTimeRange("custom")
    saveRecentRange(localFrom, localTo)
    setRecentRanges(getRecentRanges())
    setOpen(false)
  }

  const handleFromDateSelect = (date: Date | undefined) => {
    if (date) {
      setLocalFrom(formatTimeString(date))
      setFromCalendarOpen(false)
    }
  }

  const handleToDateSelect = (date: Date | undefined) => {
    if (date) {
      setLocalTo(formatTimeString(date))
      setToCalendarOpen(false)
    }
  }

  const handleQuickDateSelect = (type: "today" | "yesterday") => {
    const now = new Date()
    if (type === "today") {
      setLocalFrom(formatTimeString(startOfDay(now)))
      setLocalTo(formatTimeString(endOfDay(now)))
    } else if (type === "yesterday") {
      const yesterday = subDays(now, 1)
      setLocalFrom(formatTimeString(startOfDay(yesterday)))
      setLocalTo(formatTimeString(endOfDay(yesterday)))
    }
  }

  // Filter quick ranges based on search
  const filteredQuickRanges = useMemo(() => {
    if (!searchQuery.trim()) return quickRanges
    const query = searchQuery.toLowerCase()
    return quickRanges.filter((range) => range.label.toLowerCase().includes(query))
  }, [searchQuery])

  return (
    <div className="flex items-center justify-end gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}>
          <ClockIcon className="h-4 w-4" />
          <span>{currentLabel}</span>
        </PopoverTrigger>
        <PopoverContent className="w-[600px] p-0" align="start">
          <div className="flex">
            {/* Left Side - Custom Time Range */}
            <div className="flex-1 border-r p-4">
              <h3 className="text-sm font-semibold mb-3">Absolute time range</h3>
              <div className="space-y-3">
                <div>
                  <label htmlFor="time-range-from" className="text-xs text-muted-foreground mb-1 block">
                    From
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="time-range-from"
                      value={localFrom}
                      onChange={(e) => setLocalFrom(e.target.value)}
                      placeholder="now-1h"
                      className="flex-1"
                    />
                    <Popover open={fromCalendarOpen} onOpenChange={setFromCalendarOpen}>
                      <PopoverTrigger className={cn(buttonVariants({ variant: "outline", size: "icon" }), "h-7 w-7")}>
                        <CalendarIcon className="h-4 w-4" />
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={fromDate || undefined}
                          onSelect={handleFromDateSelect}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div>
                  <label htmlFor="time-range-to" className="text-xs text-muted-foreground mb-1 block">
                    To
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="time-range-to"
                      value={localTo}
                      onChange={(e) => setLocalTo(e.target.value)}
                      placeholder="now"
                      className="flex-1"
                    />
                    <Popover open={toCalendarOpen} onOpenChange={setToCalendarOpen}>
                      <PopoverTrigger className={cn(buttonVariants({ variant: "outline", size: "icon" }), "h-7 w-7")}>
                        <CalendarIcon className="h-4 w-4" />
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={toDate || undefined}
                          onSelect={handleToDateSelect}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={() => handleQuickDateSelect("today")}
                    type="button"
                  >
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={() => handleQuickDateSelect("yesterday")}
                    type="button"
                  >
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    Yesterday
                  </Button>
                  <Button size="sm" className="h-7 flex-1" onClick={handleCustomApply} type="button">
                    Apply time range
                  </Button>
                </div>
                {recentRanges.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Recently used absolute ranges</p>
                    <div className="space-y-1">
                      {recentRanges.map((range, index) => (
                        <button
                          key={`${range.from}-${range.to}-${index}`}
                          type="button"
                          className="text-xs text-left w-full hover:bg-muted p-1 rounded"
                          onClick={() => {
                            setLocalFrom(range.from)
                            setLocalTo(range.to)
                          }}
                        >
                          {range.from} to {range.to}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side - Quick Ranges */}
            <div className="flex-1 p-4">
              <div className="mb-3">
                <Input
                  placeholder="Search quick ranges"
                  className="h-7 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                {filteredQuickRanges.map((range) => (
                  <button
                    key={range.value}
                    type="button"
                    className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted ${
                      timeRange === range.value ? "bg-muted font-medium" : ""
                    }`}
                    onClick={() => handleQuickRangeSelect(range.value)}
                  >
                    {range.label}
                  </button>
                ))}
                {filteredQuickRanges.length === 0 && searchQuery && (
                  <div className="text-xs text-muted-foreground px-2 py-1.5">No ranges found</div>
                )}
                <button
                  type="button"
                  className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted ${
                    timeRange === "custom" ? "bg-muted font-medium" : ""
                  }`}
                  onClick={() => {
                    setTimeRange("custom")
                    setOpen(false)
                  }}
                >
                  Custom
                </button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Button variant="outline" size="sm" onClick={triggerRefresh} className="gap-2">
        <RefreshCwIcon className="h-4 w-4" />
        <span>Refresh</span>
      </Button>
    </div>
  )
}




