"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useWorkspace } from "@/lib/context/workspace-context"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

interface Folder {
  id: string
  name: string
  parentFolderId?: string | null
}

export default function NewDashboardPage() {
  const { workspaceId } = useWorkspace()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [folderId, setFolderId] = useState<string | null | undefined>(undefined)
  const [folders, setFolders] = useState<Folder[]>([])

  useEffect(() => {
    // Check if folderId is provided in query params
    const folderParam = searchParams.get("folderId")
    if (folderParam) {
      setFolderId(folderParam)
    }
  }, [searchParams])

  useEffect(() => {
    if (!workspaceId) return

    // Fetch folders for folder selection
    fetch("/api/folders", {
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.folders) {
          setFolders(data.folders)
        }
      })
      .catch((err) => {
        console.error("Failed to fetch folders:", err)
      })
  }, [workspaceId])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspaceId) {
      setError("No workspace selected")
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const response = await fetch("/api/dashboards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Workspace-Id": workspaceId,
        },
        body: JSON.stringify({
          title: title || undefined,
          description: description.trim() || undefined,
          folderId: folderId || undefined,
          layout: {
            grid: {
              columns: 12,
              rows: 8,
            },
            tiles: [],
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create dashboard")
      }

      // Redirect to the new dashboard
      if (data.dashboardId) {
        router.push(`/dashboards/${data.dashboardId}`)
      } else {
        router.push("/dashboards")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create dashboard")
    } finally {
      setIsCreating(false)
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
                <Link href="/dashboards">
                  <ArrowLeftIcon className="h-4 w-4" />
                </Link>
              }
            />
            <div>
              <h1 className="text-2xl font-bold">New Dashboard</h1>
              <p className="text-sm text-muted-foreground">Create a new dashboard</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Create Dashboard</CardTitle>
            <CardDescription>Create a new dashboard to organize your graphs</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="title">Dashboard Title (Optional)</Label>
                <Input id="title" placeholder="My Dashboard" value={title} onChange={(e) => setTitle(e.target.value)} />
                <p className="text-xs text-muted-foreground">You can add graphs to this dashboard after creation</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this dashboard is for..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">Optional description for this dashboard</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="folder">Folder (Optional)</Label>
                <Select
                  value={folderId === null || folderId === undefined ? "" : folderId}
                  onValueChange={(value) => setFolderId(value || null)}
                >
                  <SelectTrigger id="folder">
                    <SelectValue>Select a folder (optional)</SelectValue>
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
                <p className="text-xs text-muted-foreground">Select a folder to organize this dashboard</p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" nativeButton={false} render={<Link href="/dashboards">Cancel</Link>} />
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? "Creating..." : "Create Dashboard"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
