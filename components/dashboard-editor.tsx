"use client"

import { DashboardGridstack } from "@/components/dashboard-gridstack"
import { Button } from "@/components/ui/button"
import type { DashboardFragmentData } from "@/lib/services/dashboard.service"
import { PlusIcon, SettingsIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"

interface DashboardEditorProps {
  dashboard: DashboardFragmentData
  dashboardId: string
  workspaceId: string
  onSave?: (layout: DashboardFragmentData["layout"]) => Promise<void>
  isEditing?: boolean
}

/**
 * Interactive dashboard editor component with drag-and-drop grid layout
 * Uses Gridstack for professional drag-and-drop experience
 */
export function DashboardEditor({
  dashboard,
  dashboardId,
  workspaceId,
  onSave,
  isEditing = true,
}: DashboardEditorProps) {
  // Ensure layout exists with default structure if missing
  const [layout, setLayout] = useState<DashboardFragmentData["layout"]>(
    dashboard.layout || {
      grid: {
        columns: 12,
        rows: 8,
      },
      tiles: [],
    }
  )

  const [isSaving, setIsSaving] = useState(false)
  const [showGridSettings, setShowGridSettings] = useState(false)
  const router = useRouter()

  // Handle layout changes from Gridstack
  const handleLayoutChange = useCallback((updatedTiles: DashboardFragmentData["layout"]["tiles"]) => {
    setLayout((prev) => {
      // Calculate max Y position to update grid rows if needed
      const maxY = updatedTiles.reduce((max, tile) => Math.max(max, tile.position.y + tile.position.h), 0)
      const newRows = Math.max(prev.grid.rows, maxY)

      return {
        ...prev,
        grid: {
          ...prev.grid,
          rows: newRows,
        },
        tiles: updatedTiles,
      }
    })
  }, [])

  // Save dashboard layout
  const handleSave = useCallback(async () => {
    if (!onSave) return

    setIsSaving(true)
    try {
      await onSave(layout)
    } catch (error) {
      console.error("Failed to save dashboard:", error)
      alert(error instanceof Error ? error.message : "Failed to save dashboard")
    } finally {
      setIsSaving(false)
    }
  }, [layout, onSave])

  // Handle add graph button click - navigate to new graph page
  const handleAddGraph = useCallback(() => {
    router.push(`/dashboards/${dashboardId}/graphs/new`)
  }, [dashboardId, router])

  // Handle delete tile
  const handleDeleteTile = useCallback(
    (graphRef: string) => {
      const updatedTiles = layout.tiles.filter((tile) => tile.graphRef !== graphRef)
      const updatedLayout = { ...layout, tiles: updatedTiles }
      setLayout(updatedLayout)
      if (onSave) {
        onSave(updatedLayout)
      }
    },
    [layout, onSave]
  )

  // Handle edit tile
  const handleEditTile = useCallback(
    (graphRef: string) => {
      router.push(`/dashboards/${dashboardId}/graphs/${graphRef}/edit`)
    },
    [dashboardId, router]
  )

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
                <span className="text-sm text-muted-foreground">Fixed 12-column grid</span>
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
      {layout.tiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-muted-foreground/20 rounded-lg">
          <p className="text-muted-foreground mb-2">No graphs added to this dashboard yet</p>
          <p className="text-sm text-muted-foreground">Click "Add Graph" to create your first graph</p>
        </div>
      ) : (
        <DashboardGridstack
          tiles={layout.tiles}
          isEditing={isEditing}
          workspaceId={workspaceId}
          dashboardId={dashboardId}
          onLayoutChange={handleLayoutChange}
          onDeleteTile={handleDeleteTile}
          onEditTile={handleEditTile}
        />
      )}
    </div>
  )
}
