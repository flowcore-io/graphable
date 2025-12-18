"use client"

import { GraphTile } from "@/components/graph-tile"
import type { DashboardFragmentData } from "@/lib/services/dashboard.service"
import { cn } from "@/lib/utils"
import { GridStack, type GridStackNode, type GridStackWidget } from "gridstack"
import "gridstack/dist/gridstack.min.css"
import { useEffect, useRef, useState } from "react"

interface DashboardGridstackProps {
  tiles: DashboardFragmentData["layout"]["tiles"]
  isEditing?: boolean
  workspaceId: string
  dashboardId: string
  onLayoutChange?: (tiles: DashboardFragmentData["layout"]["tiles"]) => void
  onDeleteTile?: (graphRef: string) => void
  onEditTile?: (graphRef: string) => void
}

/**
 * Shared Gridstack-backed dashboard grid component
 * Supports both edit and view modes with consistent rendering
 */
export function DashboardGridstack({
  tiles,
  isEditing = false,
  workspaceId,
  dashboardId: _dashboardId,
  onLayoutChange,
  onDeleteTile,
  onEditTile,
}: DashboardGridstackProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<GridStack | null>(null)
  const [isReady, setIsReady] = useState(false)
  const isUpdatingRef = useRef(false)

  // Initialize Gridstack
  useEffect(() => {
    if (!containerRef.current) return

    // Initialize grid
    const grid = GridStack.init(
      {
        column: 12,
        margin: 8,
        cellHeight: "auto",
        staticGrid: !isEditing,
        float: false,
        resizable: {
          handles: "all",
        },
        alwaysShowResizeHandle: "mobile",
      },
      containerRef.current
    )

    gridRef.current = grid

    const handleGridChange = () => {
      if (!onLayoutChange || isUpdatingRef.current) return

      const updatedTiles = grid.save(false) as GridStackWidget[]
      console.log("Gridstack save output:", updatedTiles)

      const mappedTiles: DashboardFragmentData["layout"]["tiles"] = updatedTiles
        .map((node) => {
          // Gridstack stores ID in node.id when using gs-id attribute
          let graphRef = node.id as string | undefined

          // Fallback: try to get ID from the DOM element if missing from save output
          // GridStackWidget may have an el property (not in types, but exists at runtime)
          const nodeWithEl = node as unknown as { el?: HTMLElement }
          if (!graphRef && nodeWithEl.el) {
            const el = nodeWithEl.el
            graphRef = el.getAttribute("gs-id") || el.id || undefined
          }

          if (!graphRef) {
            console.error("Gridstack node missing ID:", node)
            return null
          }

          return {
            graphRef,
            position: {
              x: Math.round(node.x ?? 0),
              y: Math.round(node.y ?? 0),
              w: Math.round(node.w ?? 2),
              h: Math.round(node.h ?? 2),
            },
          }
        })
        .filter((tile): tile is DashboardFragmentData["layout"]["tiles"][0] => tile !== null)

      console.log("Mapped tiles for update:", mappedTiles)
      onLayoutChange(mappedTiles)
    }

    // Handle change events
    grid.on("change", (_event: unknown, _nodes: GridStackNode[]) => {
      handleGridChange()
    })

    grid.on("dragstop", () => {
      handleGridChange()
    })

    grid.on("resizestop", () => {
      handleGridChange()
    })

    setIsReady(true)

    return () => {
      grid.destroy(false)
      gridRef.current = null
    }
  }, [isEditing, onLayoutChange])

  // Update cell height on resize to maintain square-ish cells
  useEffect(() => {
    if (!containerRef.current || !gridRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width
        const columnWidth = (width - 16) / 12 // Adjust for margins/padding
        if (columnWidth > 0) {
          gridRef.current?.cellHeight(columnWidth)
        }
      }
    })

    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  const lastTilesRef = useRef<string>("")

  // Sync tiles when they change from outside (e.g. adding a new graph)
  // We use load() to sync the grid state with the tiles prop
  useEffect(() => {
    if (!gridRef.current || !isReady) return

    // If editing, only load if the number of tiles changed (e.g. added/removed a graph)
    // to avoid interrupting user drag/resize
    const currentNodes = gridRef.current.save(false) as GridStackWidget[]
    if (isEditing && currentNodes.length === tiles.length) {
      return
    }

    // Deeper check to avoid infinite loops if tiles prop is updated with same content
    const tilesJson = JSON.stringify(tiles)
    if (tilesJson === lastTilesRef.current) {
      return
    }
    lastTilesRef.current = tilesJson

    const gridWidgets: GridStackWidget[] = tiles.map((tile) => ({
      id: tile.graphRef,
      x: tile.position.x,
      y: tile.position.y,
      w: tile.position.w,
      h: tile.position.h,
      minW: 2,
      minH: 2,
    }))

    isUpdatingRef.current = true
    gridRef.current.load(gridWidgets)
    // Gridstack load() might be async or trigger events, so we reset the ref in next tick
    setTimeout(() => {
      isUpdatingRef.current = false
    }, 0)
  }, [tiles, isReady, isEditing])

  return (
    <div className="w-full">
      <div className="grid-stack" ref={containerRef}>
        {tiles.map((tile) => (
          <div
            key={tile.graphRef}
            className="grid-stack-item"
            gs-id={tile.graphRef}
            gs-x={tile.position.x}
            gs-y={tile.position.y}
            gs-w={tile.position.w}
            gs-h={tile.position.h}
          >
            <div className="grid-stack-item-content">
              <div
                className={cn(
                  "bg-card border rounded-lg h-full w-full overflow-hidden select-none",
                  !isEditing && "cursor-default"
                )}
              >
                <GraphTile
                  graphId={tile.graphRef}
                  workspaceId={workspaceId}
                  isEditing={isEditing}
                  onDelete={() => onDeleteTile?.(tile.graphRef)}
                  onEdit={() => onEditTile?.(tile.graphRef)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

