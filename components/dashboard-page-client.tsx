"use client"

import { DashboardEditor } from "@/components/dashboard-editor"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import type { DashboardFragmentData, DashboardWithMetadata } from "@/lib/services/dashboard.service"
import { cn } from "@/lib/utils"
import { ArrowLeftIcon, EyeIcon, MoreVerticalIcon, PencilIcon, TrashIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

interface DashboardPageClientProps {
  dashboard: DashboardWithMetadata
  dashboardId: string
  workspaceId: string | null
  workspaceName?: string | null
}

export function DashboardPageClient({ dashboard, dashboardId, workspaceId, workspaceName }: DashboardPageClientProps) {
  const router = useRouter()
  // Auto-enter edit mode if dashboard is empty (no graphs)
  const isEmpty = !dashboard?.layout?.tiles || dashboard.layout.tiles.length === 0
  const [isEditing, setIsEditing] = useState(isEmpty)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState("")
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Display dashboard title (editable), with fallbacks
  // Note: workspaceName is passed for context but dashboard.title takes precedence for display
  const displayTitle = dashboard?.title?.trim() || workspaceName || "Dashboard"

  // Initialize title value when dashboard title changes (not workspaceName)
  useEffect(() => {
    const currentTitle = dashboard?.title?.trim() || workspaceName || "Dashboard"
    setTitleValue(currentTitle)
  }, [dashboard?.title, workspaceName])

  // Auto-enter edit mode if dashboard becomes empty
  useEffect(() => {
    const isEmpty = !dashboard?.layout?.tiles || dashboard.layout.tiles.length === 0
    if (isEmpty && !isEditing) {
      setIsEditing(true)
    }
  }, [dashboard?.layout?.tiles, isEditing])

  // Focus input when entering title edit mode
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  const handleSave = async (layout: DashboardFragmentData["layout"]) => {
    if (!dashboardId || !workspaceId) return

    setIsSaving(true)
    try {
      // Validate layout structure before sending
      if (!layout || !layout.grid || typeof layout.grid.columns !== "number" || typeof layout.grid.rows !== "number") {
        throw new Error("Invalid layout structure: grid.columns and grid.rows are required")
      }

      if (!Array.isArray(layout.tiles)) {
        throw new Error("Invalid layout structure: tiles must be an array")
      }

      // Validate each tile has required fields
      for (const tile of layout.tiles) {
        if (!tile.graphRef || !tile.position) {
          throw new Error(`Invalid tile structure: graphRef and position are required for tile ${JSON.stringify(tile)}`)
        }
        if (
          typeof tile.position.x !== "number" ||
          typeof tile.position.y !== "number" ||
          typeof tile.position.w !== "number" ||
          typeof tile.position.h !== "number"
        ) {
          throw new Error(`Invalid tile position: x, y, w, h must be numbers for tile ${tile.graphRef}`)
        }
      }

      const response = await fetch(`/api/dashboards/${dashboardId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Workspace-Id": workspaceId,
        },
        credentials: "include", // Ensure cookies are sent for authentication
        body: JSON.stringify({
          layout,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("Dashboard save error:", errorData)
        const errorMessage = errorData.details
          ? `${errorData.error}: ${JSON.stringify(errorData.details, null, 2)}`
          : errorData.error || "Failed to save dashboard"
        throw new Error(errorMessage)
      }

      // Refresh to get updated dashboard
      router.refresh()
      setIsEditing(false)
    } catch (error) {
      console.error("Failed to save dashboard:", error)
      alert(error instanceof Error ? error.message : "Failed to save dashboard")
    } finally {
      setIsSaving(false)
    }
  }

  const handleTitleSave = async () => {
    if (!dashboardId || !workspaceId) return

    const currentTitle = dashboard?.title?.trim() || workspaceName || "Dashboard"
    if (titleValue.trim() === currentTitle.trim()) {
      setIsEditingTitle(false)
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/dashboards/${dashboardId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Workspace-Id": workspaceId,
        },
        credentials: "include",
        body: JSON.stringify({
          title: titleValue.trim() || currentTitle,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save title")
      }

      const responseData = await response.json()
      console.log("✅ Title update response:", responseData)

      // Update local state immediately for better UX
      // The router.refresh() will fetch the latest data from server
      setIsEditingTitle(false)

      // Small delay to ensure Usable has processed the update
      setTimeout(() => {
        router.refresh()
      }, 100)
    } catch (error) {
      console.error("Failed to save title:", error)
      alert(error instanceof Error ? error.message : "Failed to save title")
      // Reset to original title on error
      const currentTitle = dashboard?.title?.trim() || workspaceName || "Dashboard"
      setTitleValue(currentTitle)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleTitleSave()
    } else if (e.key === "Escape") {
      const currentTitle = dashboard?.title?.trim() || workspaceName || "Dashboard"
      setTitleValue(currentTitle)
      setIsEditingTitle(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboards" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
                <ArrowLeftIcon className="h-4 w-4" />
              </Link>
              <div className="min-w-0">
                {isEditing && isEditingTitle ? (
                  <Input
                    ref={titleInputRef}
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={handleTitleKeyDown}
                    className="text-2xl font-bold h-auto py-1 px-0 border-0 border-b-2 rounded-none focus-visible:ring-0 focus-visible:border-ring"
                    disabled={isSaving}
                  />
                ) : (
                  <h1
                    className="text-2xl font-bold truncate cursor-pointer hover:opacity-80 transition-opacity"
                    title={displayTitle}
                    onClick={() => {
                      if (isEditing) {
                        setIsEditingTitle(true)
                      }
                    }}
                    onKeyDown={(e) => {
                      if (isEditing && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault()
                        setIsEditingTitle(true)
                      }
                    }}
                    tabIndex={isEditing ? 0 : -1}
                    role={isEditing ? "button" : undefined}
                  >
                    {displayTitle}
                  </h1>
                )}
                <p className="text-sm text-muted-foreground">
                  {dashboard?.description || dashboard?.summary || "Dashboard with graphs and visualizations"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {dashboard && (
                <>
                  <Button
                    variant={isEditing ? "default" : "outline"}
                    onClick={() => setIsEditing(!isEditing)}
                    disabled={isSaving}
                  >
                    {isEditing ? (
                      <>
                        <PencilIcon className="h-4 w-4 mr-2" />
                        Edit Mode
                      </>
                    ) : (
                      <>
                        <EyeIcon className="h-4 w-4 mr-2" />
                        View Mode
                      </>
                    )}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger className={buttonVariants({ variant: "outline", size: "icon" })}>
                      <MoreVerticalIcon className="h-4 w-4" />
                      <span className="sr-only">Dashboard actions</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Link href={`/dashboards/${dashboardId}/edit`} className="flex items-center">
                          <PencilIcon className="h-4 w-4 mr-2" />
                          Edit Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Link
                          href={`/dashboards/${dashboardId}/delete`}
                          className="flex items-center text-destructive focus:text-destructive"
                        >
                          <TrashIcon className="h-4 w-4 mr-2" />
                          Delete Dashboard
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {workspaceId ? (
          dashboard ? (
            isEditing ? (
              <DashboardEditor
                dashboard={dashboard}
                dashboardId={dashboardId}
                workspaceId={workspaceId}
                onSave={handleSave}
                isEditing={true}
              />
            ) : (
              <DashboardLayout dashboard={dashboard} dashboardId={dashboardId} workspaceId={workspaceId} />
            )
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">Dashboard not found</p>
                <Link href="/dashboards" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>
                  Back to Dashboards
                </Link>
              </CardContent>
            </Card>
          )
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <h2 className="text-3xl font-bold mb-4">No Workspace Linked</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              You need to link a Usable workspace to get started with Graphable.
            </p>
            <Link href="/onboarding/link-workspace" className={cn(buttonVariants())}>
              Link Workspace
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
