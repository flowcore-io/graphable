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
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useWorkspace } from "@/lib/context/workspace-context"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function DeleteDashboardPage() {
  const { workspaceId } = useWorkspace()
  const router = useRouter()
  const params = useParams()
  const dashboardId = params.dashboardId as string
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dashboardTitle, setDashboardTitle] = useState<string>("")

  useEffect(() => {
    if (!workspaceId || !dashboardId) return

    fetch(`/api/dashboards/${dashboardId}`, {
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    })
      .then(async (res) => {
        const data = await res.json()
        if (res.ok && data.dashboard) {
          setDashboardTitle(data.dashboard.title || "Dashboard")
        }
      })
      .catch((err) => {
        console.error("Failed to fetch dashboard:", err)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [workspaceId, dashboardId])

  const handleDelete = async () => {
    if (!workspaceId) {
      setError("No workspace selected")
      return
    }

    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/dashboards/${dashboardId}`, {
        method: "DELETE",
        headers: {
          "X-Workspace-Id": workspaceId,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete dashboard")
      }

      // Redirect to dashboards list
      router.push("/dashboards")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete dashboard")
      setIsDeleting(false)
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
              <h1 className="text-2xl font-bold">Delete Dashboard</h1>
              <p className="text-sm text-muted-foreground">Confirm deletion</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6">
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive mb-4">
                {error}
              </div>
            )}

            <AlertDialog open={true}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Dashboard</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{dashboardTitle}"? This action cannot be undone. All graphs in this
                    dashboard will remain, but they will be removed from the dashboard layout.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting} onClick={() => router.push(`/dashboards/${dashboardId}`)}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? "Deleting..." : "Delete Dashboard"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
