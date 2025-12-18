"use client"

import { DashboardGridstack } from "@/components/dashboard-gridstack"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { DashboardFragmentData } from "@/lib/services/dashboard.service"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface DashboardLayoutProps {
  dashboard: DashboardFragmentData
  dashboardId: string
  workspaceId: string
}

/**
 * Dashboard layout component
 * Renders dashboard grid layout with graph tiles using saved positions and sizes
 * Uses Gridstack for consistent layout rendering (completely static in view mode)
 */
export function DashboardLayout({ dashboard, dashboardId, workspaceId }: DashboardLayoutProps) {
  const router = useRouter()
  const [deleteTileId, setDeleteTileId] = useState<string | null>(null)
  const [isDeletingTile, setIsDeletingTile] = useState(false)

  // Ensure layout exists with default structure if missing
  const layout = dashboard.layout || {
    grid: {
      columns: 12,
      rows: 8,
    },
    tiles: [],
  }

  const handleDeleteTile = async (graphRef: string) => {
    setIsDeletingTile(true)
    try {
      const updatedTiles = layout.tiles.filter((tile) => tile.graphRef !== graphRef)

      const response = await fetch(`/api/dashboards/${dashboardId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Workspace-Id": workspaceId,
        },
        credentials: "include", // Ensure cookies are sent for authentication
        body: JSON.stringify({
          layout: {
            ...layout,
            tiles: updatedTiles,
          },
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to remove graph from dashboard")
      }

      router.refresh()
      setDeleteTileId(null)
    } catch (error) {
      console.error("Failed to delete tile:", error)
      alert(error instanceof Error ? error.message : "Failed to remove graph from dashboard")
    } finally {
      setIsDeletingTile(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Graphs</h2>
      </div>

      {layout.tiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-muted-foreground/20 rounded-lg">
          <p className="text-muted-foreground mb-2">No graphs added to this dashboard yet</p>
          <p className="text-sm text-muted-foreground">Switch to edit mode to add graphs</p>
        </div>
      ) : (
        <>
          <AlertDialog open={deleteTileId !== null} onOpenChange={(open) => !open && setDeleteTileId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Graph from Dashboard</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove this graph from the dashboard? The graph itself will not be deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeletingTile}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (deleteTileId !== null) {
                      handleDeleteTile(deleteTileId)
                    }
                  }}
                  disabled={isDeletingTile}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeletingTile ? "Removing..." : "Remove"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <DashboardGridstack
            tiles={layout.tiles}
            isEditing={false}
            workspaceId={workspaceId}
            dashboardId={dashboardId}
            onDeleteTile={(id) => setDeleteTileId(id)}
            onEditTile={(id) => router.push(`/dashboards/${dashboardId}/graphs/${id}/edit`)}
          />
        </>
      )}
    </div>
  )
}
