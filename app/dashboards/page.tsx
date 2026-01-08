import { DashboardTable } from "@/components/dashboard-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import * as dashboardService from "@/lib/services/dashboard.service"
import * as folderService from "@/lib/services/folder.service"
import { getWorkspaceForUser } from "@/lib/services/tenant.service"
import { FolderPlusIcon, LayoutDashboardIcon, PlusIcon } from "lucide-react"
import { getServerSession } from "next-auth"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function DashboardsPage() {
  const session = await getServerSession(authOptions)
  let workspaceId: string | null = null

  if (session?.user?.id) {
    try {
      workspaceId = await getWorkspaceForUser(session.user.id)
    } catch (error) {
      console.error("Failed to fetch workspace:", error)
    }
  }

  // Fetch folders and dashboards from services
  let folders: folderService.FolderTreeNode[] = []
  let dashboards: Array<{ id: string; fragmentId: string; title: string; folderId?: string | null }> = []
  if (workspaceId && session?.user?.accessToken) {
    try {
      folders = await folderService.getFolderTree(workspaceId, session.user.accessToken)
      dashboards = await dashboardService.listDashboards(workspaceId, session.user.accessToken)

      // Validate: Ensure dashboards' folderId references exist in folders list
      // Build a set of valid folder IDs for quick lookup
      const validFolderIds = new Set<string>()
      const collectFolderIds = (folderNodes: folderService.FolderTreeNode[]) => {
        for (const folder of folderNodes) {
          validFolderIds.add(folder.id)
          if (folder.children) {
            collectFolderIds(folder.children)
          }
        }
      }
      collectFolderIds(folders)

      // Filter out dashboards with invalid folderId references (set to null/uncategorized)
      dashboards = dashboards.map((dashboard) => {
        if (dashboard.folderId && !validFolderIds.has(dashboard.folderId)) {
          console.warn(
            `Dashboard ${dashboard.id} references non-existent folder ${dashboard.folderId}, treating as uncategorized`
          )
          return { ...dashboard, folderId: null }
        }
        return dashboard
      })
    } catch (error) {
      console.error("Failed to fetch folders or dashboards:", error)
    }
  }

  return (
    <main className="container mx-auto px-4 py-8">
      {workspaceId ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Dashboards</h1>
              <p className="text-sm text-muted-foreground">Manage your dashboards and folders</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                render={
                  <Link href="/folders/new" className="flex items-center">
                    <FolderPlusIcon className="h-4 w-4 mr-2" />
                    New Folder
                  </Link>
                }
              />
              <Button
                render={
                  <Link href="/dashboards/new" className="flex items-center">
                    <PlusIcon className="h-4 w-4 mr-2" />
                    New Dashboard
                  </Link>
                }
              />
            </div>
          </div>

          {folders.length === 0 && dashboards.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <LayoutDashboardIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No dashboards yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Create your first dashboard to get started</p>
                <Button
                  render={
                    <Link href="/dashboards/new" className="flex items-center">
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Create Dashboard
                    </Link>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <DashboardTable folders={folders} dashboards={dashboards} />
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <h2 className="text-3xl font-bold mb-4">No Workspace Linked</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            You need to link a Usable workspace to get started with Graphable.
          </p>
          <Button nativeButton={false} render={<Link href="/onboarding/link-workspace">Link Workspace</Link>} />
        </div>
      )}
    </main>
  )
}
