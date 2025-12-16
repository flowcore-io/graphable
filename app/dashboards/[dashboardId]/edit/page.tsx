"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useWorkspace } from "@/lib/context/workspace-context"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface Folder {
  id: string
  name: string
  parentFolderId?: string | null
}

export default function EditDashboardPage() {
  const { workspaceId } = useWorkspace()
  const router = useRouter()
  const params = useParams()
  const dashboardId = params.dashboardId as string
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [folderId, setFolderId] = useState<string | null | undefined>(undefined)
  const [folders, setFolders] = useState<Folder[]>([])

  useEffect(() => {
    if (!workspaceId || !dashboardId) return

    // Fetch dashboard details and available folders
    Promise.all([
      fetch(`/api/dashboards/${dashboardId}`, {
        headers: {
          "X-Workspace-Id": workspaceId,
        },
      }),
      fetch("/api/folders", {
        headers: {
          "X-Workspace-Id": workspaceId,
        },
      }),
    ])
      .then(async ([dashboardRes, foldersRes]) => {
        const dashboardData = await dashboardRes.json()
        const foldersData = await foldersRes.json()

        if (!dashboardRes.ok) {
          throw new Error(dashboardData.error || "Failed to fetch dashboard")
        }

        // Set folders first
        if (foldersData.folders) {
          setFolders(foldersData.folders)
        }

        if (dashboardData.dashboard) {
          // Set title from dashboard data (fallback to "Dashboard" if missing)
          const dashboardTitle = dashboardData.dashboard.title || "Dashboard"
          const dashboardFolderId = dashboardData.dashboard.folderId ?? null

          console.log("Loaded dashboard data:", { title: dashboardTitle, folderId: dashboardFolderId })

          setTitle(dashboardTitle)
          setFolderId(dashboardFolderId)
        } else {
          console.error("No dashboard data in response:", dashboardData)
          setError("Dashboard data not found in response")
        }
      })
      .catch((err) => {
        console.error("Failed to fetch dashboard:", err)
        setError(err instanceof Error ? err.message : "Failed to load dashboard")
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [workspaceId, dashboardId])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspaceId) {
      setError("No workspace selected")
      return
    }

    setIsUpdating(true)
    setError(null)

    try {
      const response = await fetch(`/api/dashboards/${dashboardId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Workspace-Id": workspaceId,
        },
        body: JSON.stringify({
          title: title.trim() || undefined,
          folderId: folderId || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update dashboard")
      }

      // Redirect to dashboard view
      router.push(`/dashboards/${dashboardId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update dashboard")
    } finally {
      setIsUpdating(false)
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
            <p className="text-sm text-muted-foreground">Loading dashboard...</p>
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
              <h1 className="text-2xl font-bold">Edit Dashboard</h1>
              <p className="text-sm text-muted-foreground">Update dashboard details</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Edit Dashboard</CardTitle>
            <CardDescription>Update dashboard title and folder</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="title">Dashboard Title</Label>
                <Input id="title" placeholder="My Dashboard" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="folder">Folder (Optional)</Label>
                <Select
                  value={folderId === null || folderId === undefined ? "" : folderId}
                  onValueChange={(value) => setFolderId(value || null)}
                >
                  <SelectTrigger id="folder">
                    <SelectValue placeholder="Select a folder (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None (Uncategorized)</SelectItem>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Display folder name separately if SelectValue doesn't show it */}
                {folderId && folders.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Selected: {folders.find((f) => f.id === folderId)?.name || folderId}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Select a folder to organize this dashboard</p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/dashboards/${dashboardId}`}>Cancel</Link>}
                />
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? "Updating..." : "Update Dashboard"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
