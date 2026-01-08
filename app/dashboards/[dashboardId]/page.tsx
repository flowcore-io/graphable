import { DashboardPageClient } from "@/components/dashboard-page-client"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import * as dashboardService from "@/lib/services/dashboard.service"
import { getWorkspaceForUser } from "@/lib/services/tenant.service"
import { usableApi } from "@/lib/services/usable-api.service"
import { cn } from "@/lib/utils"
import { getServerSession } from "next-auth"
import Link from "next/link"

export const dynamic = "force-dynamic"

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

  // Fetch dashboard and workspace name from service
  let dashboard = null
  let workspaceName: string | null = null
  if (workspaceId && session?.user?.accessToken) {
    try {
      dashboard = await dashboardService.getDashboard(workspaceId, dashboardId, session.user.accessToken)
      // Fetch workspace name
      try {
        const workspace = await usableApi.getWorkspace(workspaceId, session.user.accessToken)
        workspaceName = workspace.name
      } catch (error) {
        console.error("Failed to fetch workspace name:", error)
      }
    } catch (error) {
      console.error("Failed to fetch dashboard:", error)
    }
  }

  if (!workspaceId) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <h2 className="text-3xl font-bold mb-4">No Workspace Linked</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            You need to link a Usable workspace to get started with Graphable.
          </p>
          <Link href="/onboarding/link-workspace" className={cn(buttonVariants())}>
            Link Workspace
          </Link>
        </div>
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen bg-background">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Dashboard not found</p>
            <Link href="/dashboards" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>
              Back to Dashboards
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <DashboardPageClient
      dashboard={dashboard}
      dashboardId={dashboardId}
      workspaceId={workspaceId}
      workspaceName={workspaceName}
    />
  )
}
