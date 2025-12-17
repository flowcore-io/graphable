"use client"

import { GraphViewer } from "@/components/graph-viewer"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Skeleton } from "@/components/ui/skeleton"
import type { GraphWithMetadata } from "@/lib/services/graph.service"
import { PencilIcon, TrashIcon } from "lucide-react"
import { useEffect, useState } from "react"

interface GraphTileProps {
  graphId: string
  workspaceId: string
  isEditing?: boolean
  onDelete?: () => void
  onEdit?: () => void
}

/**
 * Graph tile component for grid layout
 * Shows graph visualization with context menu for actions
 */
export function GraphTile({ graphId, workspaceId, isEditing = false, onDelete, onEdit }: GraphTileProps) {
  const [graph, setGraph] = useState<GraphWithMetadata | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadGraph() {
      setIsLoading(true)
      setError(null)

      try {
        // Get access token from session (client-side)
        // In a real implementation, we'd fetch this via an API route
        const response = await fetch(`/api/graphs/${graphId}`, {
          headers: {
            "X-Workspace-Id": workspaceId,
          },
          credentials: "include", // Ensure cookies are sent for authentication
        })

        if (!response.ok) {
          throw new Error("Failed to load graph")
        }

        const data = await response.json()
        setGraph(data.graph)
      } catch (err) {
        console.error("Failed to load graph:", err)
        setError(err instanceof Error ? err.message : "Failed to load graph")
      } finally {
        setIsLoading(false)
      }
    }

    if (graphId) {
      loadGraph()
    }
  }, [graphId, workspaceId])

  if (isLoading) {
    return (
      <div className="h-full p-4 flex flex-col">
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="flex-1 w-full" />
      </div>
    )
  }

  if (error || !graph) {
    return (
      <div className="h-full p-4 flex flex-col items-center justify-center text-muted-foreground text-sm">
        <p>Failed to load graph</p>
        {error && <p className="text-xs mt-1">{error}</p>}
      </div>
    )
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="h-full w-full cursor-pointer">
          <div className="h-full p-4 flex flex-col">
            <div className="text-sm font-medium mb-2">{graph.title}</div>
            <div className="flex-1 overflow-hidden">
              <GraphViewer graph={graph} workspaceId={workspaceId} />
            </div>
          </div>
        </div>
      </ContextMenuTrigger>
      {isEditing && (
        <ContextMenuContent>
          {onEdit && (
            <ContextMenuItem onClick={onEdit}>
              <PencilIcon className="h-4 w-4 mr-2" />
              Edit Graph
            </ContextMenuItem>
          )}
          {onDelete && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onClick={onDelete}>
                <TrashIcon className="h-4 w-4 mr-2" />
                Remove from Dashboard
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      )}
    </ContextMenu>
  )
}
