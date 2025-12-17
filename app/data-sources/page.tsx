import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import * as dataSourceService from "@/lib/services/data-source.service"
import { getWorkspaceForUser } from "@/lib/services/tenant.service"
import { DatabaseIcon, PlusIcon } from "lucide-react"
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

  // Fetch data sources from service
  let dataSources: Array<{
    id: string
    fragmentId: string
    name: string
    databaseType: string
    hasSecret: boolean
  }> = []
  if (workspaceId && session?.user?.accessToken) {
    try {
      dataSources = await dataSourceService.listDataSources(workspaceId, session.user.accessToken)
    } catch (error) {
      console.error("Failed to fetch data sources:", error)
    }
  }

  return (
    <main className="container mx-auto px-4 py-8">
      {workspaceId ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Data Sources</h1>
              <p className="text-sm text-muted-foreground">Manage your PostgreSQL data sources</p>
            </div>
            <Button
              render={
                <Link href="/data-sources/new" className="flex items-center">
                  <PlusIcon className="h-4 w-4 mr-2" />
                  New Data Source
                </Link>
              }
            />
          </div>

          {dataSources.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <DatabaseIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No data sources yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Create your first data source to get started</p>
                <Button
                  render={
                    <Link href="/data-sources/new" className="flex items-center">
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Create Data Source
                    </Link>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dataSources.map((dataSource) => (
                <Card key={dataSource.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1">{dataSource.name}</h3>
                        <p className="text-sm text-muted-foreground mb-2">Type: {dataSource.databaseType}</p>
                        <div className="flex items-center gap-2 text-xs">
                          {dataSource.hasSecret ? (
                            <span className="text-green-600">Connected</span>
                          ) : (
                            <span className="text-yellow-600">No Secret</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/data-sources/${dataSource.fragmentId}/edit`}>Edit</Link>}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/data-sources/${dataSource.fragmentId}`}>View</Link>}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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
  )
}
