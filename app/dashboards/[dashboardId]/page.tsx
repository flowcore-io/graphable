import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { WorkspaceSelector } from "@/components/workspace-selector"
import { authOptions } from "@/lib/auth"
import * as dashboardService from "@/lib/services/dashboard.service"
import { getWorkspaceForUser } from "@/lib/services/tenant.service"
import { ArrowLeftIcon, MoreVerticalIcon, PencilIcon, TrashIcon } from "lucide-react"
import { getServerSession } from "next-auth"
import Link from "next/link"

export default async function DashboardViewPage({ params }: { params: Promise<{ dashboardId: string }> }) {
  const { dashboardId } = await params

  const session = await getServerSession(authOptions)
  let workspaceId: string | null = null

  if (session?.user?.id) {
    try {
      workspaceId = await getWorkspaceForUser(session.user.id)
    } catch (error) {
      console.error("Failed to fetch workspace:", error)
    }
  }

  // Fetch dashboard from service
  let dashboard = null
  if (workspaceId && session?.user?.accessToken) {
    try {
      dashboard = await dashboardService.getDashboard(workspaceId, dashboardId, session.user.accessToken)
    } catch (error) {
      console.error("Failed to fetch dashboard:", error)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                render={
                  <Link href="/dashboards">
                    <ArrowLeftIcon className="h-4 w-4" />
                  </Link>
                }
              />
              <div>
                <h1 className="text-2xl font-bold">{dashboard?.title || "Dashboard"}</h1>
                <p className="text-sm text-muted-foreground">View dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {dashboard && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <MoreVerticalIcon className="h-4 w-4" />
                      <span className="sr-only">Dashboard actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboards/${dashboardId}/edit`} className="flex items-center">
                        <PencilIcon className="h-4 w-4 mr-2" />
                        Edit Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
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
              )}
              {session?.user && (
                <div className="text-sm text-muted-foreground">{session.user.name || session.user.email}</div>
              )}
              <WorkspaceSelector />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {workspaceId ? (
          dashboard ? (
            <DashboardLayout dashboard={dashboard} dashboardId={dashboardId} workspaceId={workspaceId} />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">Dashboard not found</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  nativeButton={false}
                  render={<Link href="/dashboards">Back to Dashboards</Link>}
                />
              </CardContent>
            </Card>
          )
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
    </div>
  )
}
