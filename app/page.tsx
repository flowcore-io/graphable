import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WorkspaceSelector } from "@/components/workspace-selector"
import { authOptions } from "@/lib/auth"
import { getWorkspaceForUser } from "@/lib/services/tenant.service"
import { DatabaseIcon, LayoutDashboardIcon, PlugIcon, PlusIcon, ShieldIcon } from "lucide-react"
import { getServerSession } from "next-auth"
import Link from "next/link"

export default async function Page() {
  const session = await getServerSession(authOptions)
  let workspaceId: string | null = null

  if (session?.user?.id) {
    try {
      workspaceId = await getWorkspaceForUser(session.user.id)
    } catch (error) {
      console.error("Failed to fetch workspace:", error)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Graphable</h1>
              <p className="text-sm text-muted-foreground">AI-first graphical service</p>
            </div>
            <div className="flex items-center gap-4">
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
          <div className="space-y-8">
            {/* Welcome Section */}
            <div>
              <h2 className="text-3xl font-bold mb-2">Welcome to Graphable</h2>
              <p className="text-muted-foreground">
                Create, manage, and visualize your data with AI-powered dashboards.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-2 items-stretch">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LayoutDashboardIcon className="h-5 w-5" />
                    Create Dashboard
                  </CardTitle>
                  <CardDescription>Compose multiple graphs into a dashboard</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex items-end pt-0">
                  <Button
                    variant="outline"
                    className="w-full"
                    render={
                      <Link href="/dashboards/new" className="flex items-center">
                        <PlusIcon className="h-4 w-4 mr-2" />
                        New Dashboard
                      </Link>
                    }
                  />
                </CardContent>
              </Card>

              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DatabaseIcon className="h-5 w-5" />
                    Add Data Source
                  </CardTitle>
                  <CardDescription>Connect a PostgreSQL data source</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex items-end pt-0">
                  <Button
                    variant="outline"
                    className="w-full"
                    render={
                      <Link href="/data-sources/new" className="flex items-center">
                        <PlusIcon className="h-4 w-4 mr-2" />
                        New Data Source
                      </Link>
                    }
                  />
                </CardContent>
              </Card>
            </div>

            {/* Resource Types Overview */}
            <div>
              <h3 className="text-xl font-semibold mb-4">Resource Types</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <LayoutDashboardIcon className="h-4 w-4 text-purple-500" />
                      Dashboards
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0</div>
                    <p className="text-xs text-muted-foreground mt-1">No dashboards yet</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <DatabaseIcon className="h-4 w-4 text-green-500" />
                      Data Sources
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0</div>
                    <p className="text-xs text-muted-foreground mt-1">No data sources yet</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <PlugIcon className="h-4 w-4 text-amber-500" />
                      Connectors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0</div>
                    <p className="text-xs text-muted-foreground mt-1">No connectors yet</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <ShieldIcon className="h-4 w-4 text-red-500" />
                      Policies
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0</div>
                    <p className="text-xs text-muted-foreground mt-1">No policies yet</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Workspace Info */}
            <Card>
              <CardHeader>
                <CardTitle>Workspace Information</CardTitle>
                <CardDescription>Your Graphable workspace is linked to a Usable workspace</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Workspace ID</span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {workspaceId}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">Active</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <h2 className="text-3xl font-bold mb-4">No Workspace Linked</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              You need to link a Usable workspace to get started with Graphable.
            </p>
            <Button render={<Link href="/onboarding/link-workspace">Link Workspace</Link>} />
          </div>
        )}
      </main>
    </div>
  )
}
