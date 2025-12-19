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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useWorkspace } from "@/lib/context/workspace-context"
import type { FolderTreeNode } from "@/lib/services/folder.service"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  LayoutDashboardIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type * as React from "react"
import { useState } from "react"

interface Dashboard {
  id: string
  fragmentId: string
  title: string
  folderId?: string | null
}

interface DashboardTableProps {
  folders: FolderTreeNode[]
  dashboards: Dashboard[]
  isLoading?: boolean
}

export function DashboardTable({ folders, dashboards, isLoading }: DashboardTableProps) {
  const { workspaceId } = useWorkspace()
  const router = useRouter()
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [dashboardToDelete, setDashboardToDelete] = useState<Dashboard | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId)
    } else {
      newExpanded.add(folderId)
    }
    setExpandedFolders(newExpanded)
  }

  const getDashboardsForFolder = (folderId: string | null) => {
    // Filter dashboards by folderId
    // folderId === null means uncategorized (no folderId set)
    // Otherwise, match dashboard.folderId to folder.id (both are fragment IDs)
    return dashboards.filter((d) => {
      if (folderId === null) {
        // Uncategorized: dashboard has no folderId or folderId is null
        return !d.folderId || d.folderId === null
      }
      // Match dashboard's folderId to folder's fragment ID
      return d.folderId === folderId
    })
  }

  // Recursively count all dashboards in a folder and its nested children
  const countDashboardsRecursive = (folder: FolderTreeNode): number => {
    // Count dashboards directly in this folder
    const directDashboards = getDashboardsForFolder(folder.id).length

    // Recursively count dashboards in nested folders
    const nestedDashboards =
      folder.children?.reduce((sum, childFolder) => {
        return sum + countDashboardsRecursive(childFolder)
      }, 0) || 0

    return directDashboards + nestedDashboards
  }

  const handleDeleteClick = (dashboard: Dashboard) => {
    setDashboardToDelete(dashboard)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!dashboardToDelete || !workspaceId) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/dashboards/${dashboardToDelete.id}`, {
        method: "DELETE",
        headers: {
          "X-Workspace-Id": workspaceId,
        },
        credentials: "include", // Ensure cookies are sent for authentication
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete dashboard")
      }

      // Refresh the page to update the dashboard list
      router.refresh()
      setDeleteDialogOpen(false)
      setDashboardToDelete(null)
    } catch (error) {
      console.error("Failed to delete dashboard:", error)
      alert(error instanceof Error ? error.message : "Failed to delete dashboard")
    } finally {
      setIsDeleting(false)
    }
  }

  const renderFolderRow = (folder: FolderTreeNode, level: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(folder.id)
    const folderDashboards = getDashboardsForFolder(folder.id)
    const totalDashboards = countDashboardsRecursive(folder) // Use recursive count
    const hasChildren = (folder.children && folder.children.length > 0) || folderDashboards.length > 0

    return (
      <>
        <TableRow key={folder.id} className="hover:bg-muted/50">
          <TableCell style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}>
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleFolder(folder.id)}
                  className="flex items-center justify-center w-5 h-5 rounded hover:bg-muted"
                  aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
                >
                  {isExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                </button>
              ) : (
                <span className="w-5" />
              )}
              <FolderIcon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{folder.name}</span>
            </div>
          </TableCell>
          <TableCell>
            <span className="text-sm text-muted-foreground">
              {totalDashboards} {totalDashboards === 1 ? "dashboard" : "dashboards"}
            </span>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button variant="ghost" size="icon-xs">
                    <MoreVerticalIcon className="h-4 w-4" />
                    <span className="sr-only">Folder actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Link href={`/dashboards/new?folderId=${folder.id}`} className="flex items-center">
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Create Dashboard in Folder
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href={`/folders/${folder.id}/edit`} className="flex items-center">
                      <PencilIcon className="h-4 w-4 mr-2" />
                      Edit Folder
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </TableCell>
        </TableRow>
        {isExpanded && (
          <>
            {/* Render nested folders */}
            {folder.children?.map((childFolder) => renderFolderRow(childFolder, level + 1))}
            {/* Render dashboards in this folder */}
            {folderDashboards.map((dashboard) => (
              <TableRow key={dashboard.id} className="hover:bg-muted/50">
                <TableCell style={{ paddingLeft: `${(level + 1) * 1.5 + 0.5}rem` }}>
                  <div className="flex items-center gap-2">
                    <span className="w-5" />
                    <LayoutDashboardIcon className="h-4 w-4 text-muted-foreground" />
                    <Link href={`/dashboards/${dashboard.id}`} className="text-sm hover:underline font-medium">
                      {dashboard.title || "Dashboard"}
                    </Link>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">-</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button variant="ghost" size="icon-xs">
                          <MoreVerticalIcon className="h-4 w-4" />
                          <span className="sr-only">Dashboard actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Link href={`/dashboards/${dashboard.id}`} className="flex items-center">
                            <LayoutDashboardIcon className="h-4 w-4 mr-2" />
                            View Dashboard
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Link href={`/dashboards/${dashboard.id}/edit`} className="flex items-center">
                            <PencilIcon className="h-4 w-4 mr-2" />
                            Edit Dashboard
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(dashboard)}
                          className="text-destructive focus:text-destructive"
                        >
                          <TrashIcon className="h-4 w-4 mr-2" />
                          Delete Dashboard
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </>
        )}
      </>
    )
  }

  const uncategorizedDashboards = getDashboardsForFolder(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Loading dashboards...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dashboard</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{dashboardToDelete?.title || "this dashboard"}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Details</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Render root folders */}
          {folders.map((folder) => renderFolderRow(folder))}
          {/* Render uncategorized dashboards */}
          {uncategorizedDashboards.length > 0 && (
            <>
              <TableRow className="hover:bg-muted/50">
                <TableCell colSpan={3} className="font-medium text-muted-foreground">
                  Uncategorized
                </TableCell>
              </TableRow>
              {uncategorizedDashboards.map((dashboard) => (
                <TableRow key={dashboard.id} className="hover:bg-muted/50">
                  <TableCell style={{ paddingLeft: "1.5rem" }}>
                    <div className="flex items-center gap-2">
                      <LayoutDashboardIcon className="h-4 w-4 text-muted-foreground" />
                      <Link href={`/dashboards/${dashboard.id}`} className="text-sm hover:underline font-medium">
                        {dashboard.title || "Dashboard"}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">-</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <Button variant="ghost" size="icon-xs">
                            <MoreVerticalIcon className="h-4 w-4" />
                            <span className="sr-only">Dashboard actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Link href={`/dashboards/${dashboard.id}`} className="flex items-center">
                              <LayoutDashboardIcon className="h-4 w-4 mr-2" />
                              View Dashboard
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(dashboard)}
                            className="text-destructive focus:text-destructive"
                          >
                            <TrashIcon className="h-4 w-4 mr-2" />
                            Delete Dashboard
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </>
          )}
          {folders.length === 0 && uncategorizedDashboards.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center py-12">
                <p className="text-sm text-muted-foreground">No dashboards or folders yet</p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
