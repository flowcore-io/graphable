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

export default function EditFolderPage() {
  const { workspaceId } = useWorkspace()
  const router = useRouter()
  const params = useParams()
  const folderId = params.folderId as string
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [parentFolderId, setParentFolderId] = useState<string | null | undefined>(undefined)
  const [folders, setFolders] = useState<Folder[]>([])
  const [allFolders, setAllFolders] = useState<Folder[]>([]) // Keep all folders for parent name lookup

  useEffect(() => {
    if (!workspaceId || !folderId) return

    // Fetch folder details and available folders
    Promise.all([
      fetch(`/api/folders/${folderId}`, {
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
      .then(async ([folderRes, foldersRes]) => {
        const folderData = await folderRes.json()
        const foldersData = await foldersRes.json()

        if (!folderRes.ok) {
          throw new Error(folderData.error || "Failed to fetch folder")
        }

        if (foldersData.folders) {
          // Keep all folders for parent name lookup
          setAllFolders(foldersData.folders)
          // Filter out current folder and its descendants to prevent circular references
          const filteredFolders = foldersData.folders.filter((f: Folder) => f.id !== folderId)
          setFolders(filteredFolders)
        }

        if (folderData.folder) {
          setName(folderData.folder.name || "")
          setParentFolderId(folderData.folder.parentFolderId || null)
        }
      })
      .catch((err) => {
        console.error("Failed to fetch folder:", err)
        setError(err instanceof Error ? err.message : "Failed to load folder")
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [workspaceId, folderId])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspaceId) {
      setError("No workspace selected")
      return
    }

    if (!name.trim()) {
      setError("Folder name is required")
      return
    }

    setIsUpdating(true)
    setError(null)

    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Workspace-Id": workspaceId,
        },
        body: JSON.stringify({
          name: name.trim(),
          parentFolderId: parentFolderId || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update folder")
      }

      // Redirect to dashboards page
      router.push("/dashboards")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update folder")
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
            <p className="text-sm text-muted-foreground">Loading folder...</p>
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
              <h1 className="text-2xl font-bold">Edit Folder</h1>
              <p className="text-sm text-muted-foreground">Update folder details</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Edit Folder</CardTitle>
            <CardDescription>Update folder name and parent folder</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Folder Name</Label>
                <Input
                  id="name"
                  placeholder="My Folder"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parentFolder">Parent Folder (Optional)</Label>
                <Select
                  value={parentFolderId === null || parentFolderId === undefined ? "" : parentFolderId}
                  onValueChange={(value) => setParentFolderId(value || null)}
                >
                  <SelectTrigger id="parentFolder">
                    <SelectValue>Select a parent folder (optional)</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None (Root Level)</SelectItem>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select a parent folder to create a nested folder structure
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" nativeButton={false} render={<Link href="/dashboards">Cancel</Link>} />
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? "Updating..." : "Update Folder"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
