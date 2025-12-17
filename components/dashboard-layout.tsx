"use client"

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
import { Card, CardContent } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { DashboardFragmentData } from "@/lib/services/dashboard.service"
import { MoreVerticalIcon, TrashIcon } from "lucide-react"
import { useState } from "react"

interface DashboardLayoutProps {
  dashboard: DashboardFragmentData
  dashboardId: string
  workspaceId: string
}

/**
 * Dashboard layout component
 * Renders dashboard grid layout with graph tiles and supports CRUD operations
 */
export function DashboardLayout({ dashboard, dashboardId, workspaceId }: DashboardLayoutProps) {
  const [deleteTileIndex, setDeleteTileIndex] = useState<number | null>(null)
  const [isDeletingTile, setIsDeletingTile] = useState(false)

  // Ensure layout exists with default structure if missing
  const layout = dashboard.layout || {
    grid: {
      columns: 12,
      rows: 8,
    },
    tiles: [],
  }

  const handleDeleteTile = async (tileIndex: number) => {
    setIsDeletingTile(true)
    try {
      const updatedTiles = layout.tiles.filter((_, index) => index !== tileIndex)

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
      setDeleteTileIndex(null)
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
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No graphs added to this dashboard yet</p>
            <p className="text-sm text-muted-foreground mt-2">Switch to edit mode to add graphs</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <AlertDialog open={deleteTileIndex !== null} onOpenChange={(open) => !open && setDeleteTileIndex(null)}>
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
                  onClick={() => deleteTileIndex !== null && handleDeleteTile(deleteTileIndex)}
                  disabled={isDeletingTile}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeletingTile ? "Removing..." : "Remove"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${layout.grid.columns}, minmax(0, 1fr))` }}>
            {layout.tiles.map((tile, index) => (
              <Card
                key={tile.graphRef}
                style={{
                  gridColumn: `span ${tile.position.w}`,
                  gridRow: `span ${tile.position.h}`,
                }}
                className="relative group"
              >
                <CardContent className="p-4">
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Graph: {tile.graphRef.slice(0, 8)}...</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVerticalIcon className="h-4 w-4" />
                            <span className="sr-only">Graph actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setDeleteTileIndex(index)}
                            className="text-destructive focus:text-destructive"
                          >
                            <TrashIcon className="h-4 w-4 mr-2" />
                            Remove from Dashboard
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center justify-center flex-1 bg-muted rounded-md">
                      <p className="text-xs text-muted-foreground">Graph tile placeholder</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
