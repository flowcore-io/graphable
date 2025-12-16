import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { getWorkspaceForUser } from "@/lib/services/tenant.service"
import { DatabaseIcon } from "lucide-react"
import { getServerSession } from "next-auth"
import Link from "next/link"

export default async function DataSourcesPage() {
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
    <main className="container mx-auto px-4 py-8">
      {workspaceId ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DatabaseIcon className="h-5 w-5" />
              Data Sources
            </CardTitle>
            <CardDescription>
              Per the PRD, data sources are stored as Usable fragments with secrets kept in a secret provider.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="text-xs text-muted-foreground">
              UI + CRUD for data sources comes next. For now, manage dashboards and wire data sources via the upcoming
              flow.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" render={<Link href="/">Back to overview</Link>} />
              <Button variant="outline" render={<Link href="/dashboards">Dashboards</Link>} />
            </div>
          </CardContent>
        </Card>
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
  )
}

