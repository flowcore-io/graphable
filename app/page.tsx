import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { authOptions } from "@/lib/auth"
import * as dashboardService from "@/lib/services/dashboard.service"
import { getWorkspaceForUser } from "@/lib/services/tenant.service"
import { BellIcon, LayoutDashboardIcon, ListFilterIcon, PlusIcon, RefreshCwIcon, SearchIcon } from "lucide-react"
import { getServerSession } from "next-auth"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function Page() {
  const session = await getServerSession(authOptions)
  let workspaceId: string | null = null
  const accessToken = session?.user?.accessToken

  if (session?.user?.id) {
    try {
      workspaceId = await getWorkspaceForUser(session.user.id)
    } catch (error) {
      console.error("Failed to fetch workspace:", error)
    }
  }

  let dashboardsCount = 0
  let recentDashboards: Array<{ id: string; title: string }> = []
  let hasGraphs = false

  if (workspaceId && accessToken) {
    try {
      const dashboards = await dashboardService.listDashboards(workspaceId, accessToken)

      dashboardsCount = dashboards.length

      recentDashboards = dashboards.slice(0, 3).map((d) => ({ id: d.id, title: d.title || "Dashboard" }))

      // Check if any dashboard has graphs (tiles)
      if (dashboards.length > 0) {
        try {
          const firstDashboard = await dashboardService.getDashboard(workspaceId, dashboards[0].id, accessToken)
          hasGraphs = (firstDashboard?.layout?.tiles?.length ?? 0) > 0
          // If first dashboard has no graphs, check others
          if (!hasGraphs && dashboards.length > 1) {
            for (let i = 1; i < Math.min(dashboards.length, 5); i++) {
              const dashboard = await dashboardService.getDashboard(workspaceId, dashboards[i].id, accessToken)
              if ((dashboard?.layout?.tiles?.length ?? 0) > 0) {
                hasGraphs = true
                break
              }
            }
          }
        } catch (error) {
          // Silently fail - graphs check is optional
          console.error("Failed to check for graphs:", error)
        }
      }
    } catch (error) {
      console.error("Failed to fetch workspace resources:", error)
    }
  }

  const onboardingSteps = [
    { key: "workspace", label: "Workspace linked", done: !!workspaceId },
    { key: "graphs", label: "Create graphs", done: hasGraphs },
    { key: "dashboards", label: "Build dashboards", done: dashboardsCount > 0 },
  ] as const

  const onboardingDoneCount = onboardingSteps.filter((s) => s.done).length
  const onboardingProgress = Math.round((onboardingDoneCount / onboardingSteps.length) * 100)

  return (
    <main className="container mx-auto px-4 py-8">
      {workspaceId ? (
        <div className="space-y-6">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
              <p className="text-sm text-muted-foreground">Workspace-level status and shortcuts</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <div className="relative w-full sm:w-[320px]">
                <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search dashboards and resources…" className="pl-8" />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm">
                  <RefreshCwIcon className="mr-1 h-4 w-4" />
                  Refresh
                </Button>
                <Button variant="outline" size="sm">
                  <ListFilterIcon className="mr-1 h-4 w-4" />
                  Filters
                </Button>
                <Button
                  size="sm"
                  render={
                    <Link href="/dashboards/new" className="flex items-center">
                      <PlusIcon className="mr-1 h-4 w-4" />
                      New dashboard
                    </Link>
                  }
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Top grid: briefing + KPIs */}
          <div className="grid gap-4 lg:grid-cols-12">
            <Card className="lg:col-span-7">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <BellIcon className="h-4 w-4" />
                  Workspace briefing
                </CardTitle>
                <CardDescription>High-level status derived from your current workspace</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border border-border bg-muted/20 p-3">
                    <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Dashboards</div>
                    <div className="mt-1 text-2xl font-semibold">{dashboardsCount}</div>
                  </div>
                  <div className="rounded-md border border-border bg-muted/20 p-3">
                    <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Graphs</div>
                    <div className="mt-1 text-2xl font-semibold">—</div>
                  </div>
                  <div className="rounded-md border border-border bg-muted/20 p-3">
                    <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Executions</div>
                    <div className="mt-1 text-2xl font-semibold">—</div>
                  </div>
                </div>

                <div className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">Onboarding progress</div>
                      <div className="text-xs text-muted-foreground">
                        {onboardingDoneCount}/{onboardingSteps.length} steps completed
                      </div>
                    </div>
                    <div className="text-sm font-medium tabular-nums">{onboardingProgress}%</div>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${onboardingProgress}%` }} />
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {onboardingSteps.map((step) => (
                      <div key={step.key} className="flex items-center gap-2 text-xs">
                        <span
                          className={[
                            "inline-block h-2 w-2 rounded-full",
                            step.done ? "bg-green-500" : "bg-muted-foreground/40",
                          ].join(" ")}
                        />
                        <span className={step.done ? "text-foreground" : "text-muted-foreground"}>{step.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:col-span-5 sm:grid-cols-3 lg:grid-cols-1">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <LayoutDashboardIcon className="h-4 w-4" />
                    Dashboards
                  </CardTitle>
                  <CardDescription>Browse and manage dashboards</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4">
                  <div className="text-3xl font-semibold tabular-nums">{dashboardsCount}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <Link href="/dashboards" className="flex items-center">
                        Open
                      </Link>
                    }
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Graphs</CardTitle>
                  <CardDescription>Created and managed inside dashboards</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4">
                  <div className="text-3xl font-semibold tabular-nums">—</div>
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <Link href="/dashboards" className="flex items-center">
                        View dashboards
                      </Link>
                    }
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Data sources</CardTitle>
                  <CardDescription>Postgres-first (BYO + provisioned)</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4">
                  <div className="text-3xl font-semibold tabular-nums">—</div>
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <Link href="/data-sources" className="flex items-center">
                        Open
                      </Link>
                    }
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Secondary grid: lightweight “charts” and recent items */}
          <div className="grid gap-4 lg:grid-cols-12">
            <Card className="lg:col-span-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Resource distribution</CardTitle>
                <CardDescription>Snapshot of definitions in this workspace</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Dashboards</span>
                    <span className="tabular-nums">{dashboardsCount}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-purple-500/80"
                      style={{ width: `${Math.min(100, dashboardsCount * 15)}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Graphs</span>
                    <span className="tabular-nums">—</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-blue-500/30" style={{ width: "0%" }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Data sources</span>
                    <span className="tabular-nums">0</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-emerald-500/40" style={{ width: "0%" }} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Recent dashboards</CardTitle>
                <CardDescription>Most recent items in your workspace</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {recentDashboards.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No dashboards yet.</div>
                ) : (
                  <div className="space-y-2">
                    {recentDashboards.map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0 text-xs">
                          <div className="truncate font-medium">{d.title}</div>
                          <div className="truncate text-muted-foreground">ID: {d.id.slice(0, 8)}…</div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          render={
                            <Link href={`/dashboards/${d.id}`} className="flex items-center">
                              Open
                            </Link>
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Graphs</CardTitle>
                <CardDescription>Managed inside dashboards (no separate list)</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Graphs are created and maintained as part of a dashboard’s composition. We’ll surface per-dashboard
                graph tiles here once the dashboard layout renderer is live.
              </CardContent>
            </Card>
          </div>
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
