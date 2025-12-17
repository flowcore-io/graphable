"use client"

import { GraphTile } from "@/components/graph-tile"
import { Button } from "@/components/ui/button"
import type { DashboardFragmentData } from "@/lib/services/dashboard.service"
import { cn } from "@/lib/utils"
import { PlusIcon, SettingsIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import ResponsiveGridLayout from "react-grid-layout"
import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"

// Import Layout type from the types package
type LayoutItem = {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
  static?: boolean
  isDraggable?: boolean
  isResizable?: boolean
}

interface DashboardEditorProps {
  dashboard: DashboardFragmentData
  dashboardId: string
  workspaceId: string
  onSave?: (layout: DashboardFragmentData["layout"]) => Promise<void>
  isEditing?: boolean
}

/**
 * Interactive dashboard editor component with drag-and-drop grid layout
 * Uses react-grid-layout for professional drag-and-drop experience
 */
export function DashboardEditor({
  dashboard,
  dashboardId,
  workspaceId,
  onSave,
  isEditing = true,
}: DashboardEditorProps) {
  // Ensure layout exists with default structure if missing
  const layout = dashboard.layout || {
    grid: {
      columns: 12,
      rows: 8,
    },
    tiles: [],
  }

  const [currentLayout, setCurrentLayout] = useState<LayoutItem[]>([])
  const [gridConfig, setGridConfig] = useState({
    cols: layout.grid.columns,
    rowHeight: 60, // Fixed row height in pixels
  })
  const [isSaving, setIsSaving] = useState(false)
  const [showGridSettings, setShowGridSettings] = useState(false)
  const router = useRouter()

  // Convert dashboard tiles to react-grid-layout format
  useEffect(() => {
    const gridLayout: LayoutItem[] = layout.tiles.map((tile) => ({
      i: tile.graphRef, // Use graphRef as the unique key
      x: tile.position.x,
      y: tile.position.y,
      w: tile.position.w,
      h: tile.position.h,
      minW: 2, // Minimum width (2 columns)
      minH: 2, // Minimum height (2 rows)
    }))
    setCurrentLayout(gridLayout)
  }, [layout.tiles])

  // Handle layout changes from react-grid-layout
  const handleLayoutChange = useCallback(
    (newLayout: LayoutItem[]) => {
      setCurrentLayout(newLayout)

      // Auto-expand grid columns if needed
      const maxX = newLayout.length > 0 ? Math.max(...newLayout.map((item) => item.x + item.w), 0) : 0
      if (maxX >= gridConfig.cols) {
        const newCols = Math.max(gridConfig.cols, maxX + 2) // Add padding
        if (newCols !== gridConfig.cols && newCols <= 24) {
          setGridConfig((prev) => ({ ...prev, cols: newCols }))
        }
      }

      // Auto-expand grid rows if needed (update layout.grid.rows)
      const maxY = newLayout.length > 0 ? Math.max(...newLayout.map((item) => item.y + item.h), 0) : 0
      const currentRows = layout.grid.rows
      if (maxY >= currentRows) {
        const newRows = Math.max(currentRows, maxY + 2) // Add padding
        // Update layout.grid.rows in the dashboard data structure
        // This will be persisted when saving
        if (newRows !== currentRows && newRows <= 100) {
          // Update local layout state
          layout.grid.rows = newRows
        }
      }
    },
    [gridConfig.cols, layout]
  )

  // Convert react-grid-layout format back to dashboard format
  const convertToDashboardLayout = useCallback(
    (gridLayout: LayoutItem[]): DashboardFragmentData["layout"] => {
      const maxY = Math.max(...gridLayout.map((item) => item.y + item.h), 0)
      const calculatedRows = Math.max(layout.grid.rows, maxY + 2) // Add padding

      return {
        grid: {
          columns: gridConfig.cols,
          rows: calculatedRows,
        },
        tiles: gridLayout.map((item) => ({
          graphRef: item.i, // graphRef is stored in the 'i' field
          position: {
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          },
        })),
      }
    },
    [gridConfig.cols, layout.grid.rows]
  )

  // Save dashboard layout
  const handleSave = useCallback(async () => {
    if (!onSave) return

    setIsSaving(true)
    try {
      const dashboardLayout = convertToDashboardLayout(currentLayout)
      await onSave(dashboardLayout)
    } catch (error) {
      console.error("Failed to save dashboard:", error)
      alert(error instanceof Error ? error.message : "Failed to save dashboard")
    } finally {
      setIsSaving(false)
    }
  }, [currentLayout, convertToDashboardLayout, onSave])

  // Handle add graph button click - navigate to new graph page
  const handleAddGraph = useCallback(() => {
    router.push(`/dashboards/${dashboardId}/graphs/new`)
  }, [dashboardId, router])

  // Grid settings handlers
  const handleGridConfigChange = useCallback((updates: { columns?: number }) => {
    if (updates.columns !== undefined) {
      setGridConfig((prev) => ({ ...prev, cols: Math.max(4, Math.min(24, updates.columns ?? 12)) }))
    }
  }, [])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      {isEditing && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowGridSettings(!showGridSettings)}>
              <SettingsIcon className="h-4 w-4 mr-2" />
              Grid Settings
            </Button>
            {showGridSettings && (
              <div className="flex items-center gap-2 ml-4">
                <label className="text-sm text-muted-foreground">
                  Columns:
                  <input
                    type="number"
                    min="4"
                    max="24"
                    value={gridConfig.cols}
                    onChange={(e) => handleGridConfigChange({ columns: parseInt(e.target.value, 10) })}
                    className="ml-2 w-16 px-2 py-1 border rounded"
                  />
                </label>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleAddGraph}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Graph
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Dashboard"}
            </Button>
          </div>
        </div>
      )}

      {/* Grid Layout */}
      {currentLayout.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-muted-foreground/20 rounded-lg">
          <p className="text-muted-foreground mb-2">No graphs added to this dashboard yet</p>
          <p className="text-sm text-muted-foreground">Click "Add Graph" to create your first graph</p>
        </div>
      ) : (
        <div className="relative">
          <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: currentLayout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{
              lg: gridConfig.cols,
              md: gridConfig.cols,
              sm: gridConfig.cols,
              xs: gridConfig.cols,
              xxs: gridConfig.cols,
            }}
            rowHeight={gridConfig.rowHeight}
            isDraggable={isEditing}
            isResizable={isEditing}
            onLayoutChange={handleLayoutChange as (layout: LayoutItem[]) => void}
            margin={[16, 16]}
            containerPadding={[0, 0]}
          >
            {/* Render graph tiles */}
            {currentLayout.map((item) => {
              const handleDelete = async () => {
                // Remove tile from layout
                const updatedLayout = currentLayout.filter((tile) => tile.i !== item.i)
                setCurrentLayout(updatedLayout)
                if (onSave) {
                  await onSave(convertToDashboardLayout(updatedLayout))
                }
              }
              const handleEdit = () => {
                router.push(`/dashboards/${dashboardId}/graphs/${item.i}/edit`)
              }
              return (
                <div key={item.i} className={cn("bg-card border rounded-lg", !isEditing && "cursor-default")}>
                  <GraphTile
                    graphId={item.i}
                    workspaceId={workspaceId}
                    isEditing={isEditing}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                  />
                </div>
              )
            })}
          </ResponsiveGridLayout>
        </div>
      )}
    </div>
  )
}
