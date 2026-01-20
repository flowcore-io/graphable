"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useWorkspace } from "@/lib/context/workspace-context"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface Graph {
  id: string
  fragmentId: string
  dataSourceRef: string
}

interface Dashboard {
  id: string
  title: string
  description?: string
  layout: {
    tiles: Array<{
      graphRef: string
      position: {
        x: number
        y: number
        w: number
        h: number
      }
    }>
  }
}

export default function AddGraphToDashboardPage() {
  const { workspaceId } = useWorkspace()
  const router = useRouter()
  const params = useParams()
  const dashboardId = params.dashboardId as string
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedGraphId, setSelectedGraphId] = useState<string>("")
  const [graphs, setGraphs] = useState<Graph[]>([])
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)

  useEffect(() => {
    if (!workspaceId || !dashboardId) return

    Promise.all([
      fetch(`/api/dashboards/${dashboardId}`, {
        headers: {
          "X-Workspace-Id": workspaceId,
        },
      }),
      fetch("/api/graphs", {
        headers: {
          "X-Workspace-Id": workspaceId,
        },
      }),
    ])
      .then(async ([dashboardRes, graphsRes]) => {
        const dashboardData = await dashboardRes.json()
        const graphsData = await graphsRes.json()

        if (!dashboardRes.ok) {
          throw new Error(dashboardData.error || "Failed to fetch dashboard")
        }

        if (dashboardData.dashboard) {
          setDashboard(dashboardData.dashboard)
        }

        if (graphsData.graphs) {
          setGraphs(graphsData.graphs)
        }
      })
      .catch((err) => {
        console.error("Failed to fetch data:", err)
        setError(err instanceof Error ? err.message : "Failed to load data")
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [workspaceId, dashboardId])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspaceId || !selectedGraphId) {
      setError("Please select a graph")
      return
    }

    setIsAdding(true)
    setError(null)

    try {
      // Get the selected graph to find its fragment ID
      const selectedGraph = graphs.find((g) => g.id === selectedGraphId)
      if (!selectedGraph) {
        throw new Error("Selected graph not found")
      }

      // Get current dashboard layout
      const currentLayout = dashboard?.layout || {
        grid: {
          columns: 12,
          rows: 8,
        },
        tiles: [],
      }

      // Add new tile at position (0, 0) with default size (4x3)
      const newTile = {
        graphRef: selectedGraph.fragmentId,
        position: {
          x: 0,
          y: 0,
          w: 4,
          h: 3,
        },
      }

      const updatedTiles = [...currentLayout.tiles, newTile]

      const response = await fetch(`/api/dashboards/${dashboardId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Workspace-Id": workspaceId,
        },
        body: JSON.stringify({
          layout: {
            ...currentLayout,
            tiles: updatedTiles,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to add graph to dashboard")
      }

      // Redirect to dashboard view
      router.push(`/dashboards/${dashboardId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add graph to dashboard")
    } finally {
      setIsAdding(false)
    }
  }

  if (!workspaceId) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <h2 className="text-3xl font-bold mb-4">No Workspace Linked</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              You need to link a Usable workspace to get started with Graphable.
            </p>
            <Button nativeButton={false} render={<Link href="/onboarding/link-workspace">Link Workspace</Link>} />
          </div>
        </main>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              nativeButton={false}
              render={
                <Link href={`/dashboards/${dashboardId}`}>
                  <ArrowLeftIcon className="h-4 w-4" />
                </Link>
              }
            />
            <div>
              <h1 className="text-2xl font-bold">Add Graph to Dashboard</h1>
              <p className="text-sm text-muted-foreground">Select a graph to add to this dashboard</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Add Graph</CardTitle>
            <CardDescription>Select a graph to add to "{dashboard?.title || "Dashboard"}"</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                  {error}
                </div>
              )}

              {graphs.length === 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">No graphs available. Create a graph first.</p>
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={<Link href="/graphs/new">Create Graph</Link>}
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="graph">Select Graph</Label>
                    <Select value={selectedGraphId} onValueChange={(value) => setSelectedGraphId(value || "")}>
                      <SelectTrigger id="graph">
                        <SelectValue>Select a graph</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {graphs.map((graph) => (
                          <SelectItem key={graph.id} value={graph.id}>
                            {graph.dataSourceRef} ({graph.id.slice(0, 8)}...)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/dashboards/${dashboardId}`}>Cancel</Link>}
                    />
                    <Button type="submit" disabled={isAdding || !selectedGraphId}>
                      {isAdding ? "Adding..." : "Add Graph"}
                    </Button>
                  </div>
                </>
              )}
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
