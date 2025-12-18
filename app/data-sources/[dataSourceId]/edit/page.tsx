"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useWorkspace } from "@/lib/context/workspace-context"
import { ArrowLeftIcon, EyeIcon, EyeOffIcon } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function EditDataSourcePage() {
  const { workspaceId } = useWorkspace()
  const router = useRouter()
  const params = useParams()
  const dataSourceId = params.dataSourceId as string
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [secretName, setSecretName] = useState("")
  const [hasSecret, setHasSecret] = useState(false)
  const [connectionInputType, setConnectionInputType] = useState<"string" | "split">("string")

  // Connection string input
  const [connectionString, setConnectionString] = useState("")

  // Split input fields
  const [host, setHost] = useState("")
  const [port, setPort] = useState("5432")
  const [database, setDatabase] = useState("")
  const [user, setUser] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [sslMode, setSslMode] = useState<"disable" | "allow" | "prefer" | "require" | "verify-ca" | "verify-full">(
    "require"
  )

  /**
   * Convert split input fields to connection string
   */
  const buildConnectionString = (): string => {
    if (!host || !database || !user || !password) {
      return ""
    }
    const portPart = port ? `:${port}` : ""
    const params = new URLSearchParams()
    if (sslMode !== "prefer") {
      // prefer is the default, so we only add it if it's not prefer
      params.set("sslmode", sslMode)
    }
    const queryString = params.toString()
    const queryPart = queryString ? `?${queryString}` : ""
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}${portPart}/${encodeURIComponent(database)}${queryPart}`
  }

  /**
   * Get the final connection string based on input type
   */
  const getFinalConnectionString = (): string => {
    if (connectionInputType === "string") {
      return connectionString.trim()
    } else {
      return buildConnectionString()
    }
  }

  useEffect(() => {
    if (!workspaceId || !dataSourceId) return

    // Fetch data source details
    fetch(`/api/data-sources/${dataSourceId}`, {
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    })
      .then(async (res) => {
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch data source")
        }

        if (data.dataSource) {
          setName(data.dataSource.name || "")
          setDescription(data.dataSource.description || "")
          setHasSecret(data.dataSource.hasSecret || false)
          // Set secret name (read-only, for display)
          setSecretName(data.dataSource.secretName || "")

          // Populate connection details if available (includes actual password for editing)
          if (data.dataSource.connectionDetails) {
            const conn = data.dataSource.connectionDetails
            // Populate split input fields
            setHost(conn.host || "")
            setPort(conn.port?.toString() || "5432")
            setDatabase(conn.database || "")
            setUser(conn.user || "")
            // Populate password (actual value, not masked)
            setPassword(conn.password || "")
            // Set SSL mode if available
            if (conn.sslMode) {
              setSslMode(conn.sslMode as typeof sslMode)
            }
            // Populate connection string field with actual connection string (not masked)
            setConnectionString(conn.connectionString || "")
            // Default to split input if we have connection details
            setConnectionInputType("split")
          }
        } else {
          setError("Data source data not found in response")
        }
      })
      .catch((err) => {
        console.error("Failed to fetch data source:", err)
        setError(err instanceof Error ? err.message : "Failed to load data source")
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [workspaceId, dataSourceId])

  const handleTestConnection = async () => {
    const finalConnectionString = getFinalConnectionString()

    if (!finalConnectionString) {
      setTestResult({ success: false, error: "Please fill in connection details to test" })
      return
    }

    setIsTesting(true)
    setTestResult(null)
    setError(null)

    try {
      // Test connection directly without storing
      const testResponse = await fetch("/api/data-sources/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connectionString: finalConnectionString,
        }),
      })

      const testData = await testResponse.json()

      if (testResponse.ok && testData.success) {
        setTestResult({ success: true })
      } else {
        setTestResult({ success: false, error: testData.error || "Connection test failed" })
      }
    } catch (err) {
      setTestResult({ success: false, error: err instanceof Error ? err.message : "Connection test failed" })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspaceId) {
      setError("No workspace selected")
      return
    }

    if (!name) {
      setError("Name is required")
      return
    }

    setIsUpdating(true)
    setError(null)

    try {
      const finalConnectionString = getFinalConnectionString()

      const updateData: {
        name?: string
        description?: string
        secretPayload?: string
      } = {
        name: name.trim() || undefined,
        description: description.trim() || undefined,
      }

      // Only include secret update if provided (secret name cannot be changed)
      if (finalConnectionString) {
        if (!hasSecret) {
          setError("Cannot update secret: secret reference not found. Please create a new data source with a secret.")
          setIsUpdating(false)
          return
        }
        updateData.secretPayload = finalConnectionString // Always store as connection string
      }

      const response = await fetch(`/api/data-sources/${dataSourceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Workspace-Id": workspaceId,
        },
        body: JSON.stringify(updateData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update data source")
      }

      // Redirect to data sources list
      router.push("/data-sources")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update data source")
    } finally {
      setIsUpdating(false)
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
          <Card className="max-w-2xl mx-auto">
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading data source...</p>
            </CardContent>
          </Card>
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
                <Link href="/data-sources">
                  <ArrowLeftIcon className="h-4 w-4" />
                </Link>
              }
            />
            <div>
              <h1 className="text-2xl font-bold">Edit Data Source</h1>
              <p className="text-sm text-muted-foreground">Update data source configuration</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Edit Data Source</CardTitle>
            <CardDescription>Update PostgreSQL data source configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="My Database"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">A friendly name for this data source</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Describe this data source..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">Optional description for this data source</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="databaseType">Database Type</Label>
                <Input id="databaseType" value="PostgreSQL" disabled />
                <p className="text-xs text-muted-foreground">Database type cannot be changed</p>
              </div>

              {hasSecret && secretName && (
                <div className="space-y-2">
                  <Label htmlFor="secretName">Secret Name</Label>
                  <Input id="secretName" value={secretName} disabled />
                  <p className="text-xs text-muted-foreground">
                    Secret name cannot be changed. Only the secret value can be updated.
                  </p>
                </div>
              )}

              {hasSecret && (
                <div className="space-y-2">
                  <Label>Connection Details (Optional - only if updating secret value)</Label>
                  <Tabs
                    value={connectionInputType}
                    onValueChange={(v) => setConnectionInputType(v as "string" | "split")}
                  >
                    <TabsList variant="line" className="grid w-full grid-cols-2">
                      <TabsTrigger value="string">Connection String</TabsTrigger>
                      <TabsTrigger value="split">Split Input</TabsTrigger>
                    </TabsList>

                    <TabsContent value="string" className="space-y-2 mt-4">
                      <Textarea
                        id="connectionString"
                        placeholder="postgresql://user:password@host:port/database?sslmode=require"
                        value={connectionString}
                        onChange={(e) => setConnectionString(e.target.value)}
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave empty to keep existing secret. Paste new connection string to update secret value.
                      </p>
                      {connectionString.trim() && (
                        <div className="space-y-2 rounded-lg border border-border bg-muted/50 p-3">
                          <Label className="text-xs font-medium">Connection String Preview</Label>
                          <div className="font-mono text-xs break-all text-muted-foreground">
                            {connectionString.replace(/:[^:@]+@/, ":••••••••@")}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Password is hidden for security. This is what will be stored.
                          </p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="split" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="host">Host *</Label>
                          <Input
                            id="host"
                            placeholder="localhost"
                            value={host}
                            onChange={(e) => setHost(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="port">Port</Label>
                          <Input
                            id="port"
                            type="number"
                            placeholder="5432"
                            value={port}
                            onChange={(e) => setPort(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="database">Database *</Label>
                        <Input
                          id="database"
                          placeholder="mydb"
                          value={database}
                          onChange={(e) => setDatabase(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="user">Username *</Label>
                        <Input
                          id="user"
                          placeholder="postgres"
                          value={user}
                          onChange={(e) => setUser(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password *</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOffIcon className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <EyeIcon className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sslMode">SSL Mode</Label>
                        <Select value={sslMode} onValueChange={(value) => setSslMode(value as typeof sslMode)}>
                          <SelectTrigger id="sslMode" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-[400px]">
                            <SelectItem value="disable">Disable - No SSL</SelectItem>
                            <SelectItem value="allow">Allow - Try non-SSL first, then SSL</SelectItem>
                            <SelectItem value="prefer">Prefer - Try SSL first, then non-SSL (default)</SelectItem>
                            <SelectItem value="require">
                              Require - SSL required, but don't verify certificate
                            </SelectItem>
                            <SelectItem value="verify-ca">
                              Verify-CA - SSL required, verify certificate authority
                            </SelectItem>
                            <SelectItem value="verify-full">
                              Verify-Full - SSL required, verify certificate and hostname
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Controls SSL/TLS encryption for the connection</p>
                      </div>
                      {buildConnectionString() && (
                        <div className="space-y-2 rounded-lg border border-border bg-muted/50 p-3">
                          <Label className="text-xs font-medium">Generated Connection String</Label>
                          <div className="font-mono text-xs break-all text-muted-foreground">
                            {showPassword
                              ? buildConnectionString()
                              : buildConnectionString().replace(/:[^:@]+@/, ":••••••••@")}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? "Hide" : "Show"} Password
                            </Button>
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Leave empty to keep existing secret. Fill fields to update secret value.
                      </p>
                    </TabsContent>
                  </Tabs>
                </div>
              )}

              {getFinalConnectionString() && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={isTesting || !getFinalConnectionString()}
                    >
                      {isTesting ? "Testing..." : "Test Connection"}
                    </Button>
                  </div>
                  {testResult && (
                    <div
                      className={`rounded-lg border p-3 text-sm ${
                        testResult.success
                          ? "border-green-500/50 bg-green-500/10 text-green-700"
                          : "border-destructive/50 bg-destructive/10 text-destructive"
                      }`}
                    >
                      {testResult.success
                        ? "Connection test successful!"
                        : `Connection test failed: ${testResult.error}`}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href="/data-sources">Cancel</Link>}
                />
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? "Updating..." : "Update Data Source"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}





