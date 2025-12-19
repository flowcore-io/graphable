"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useWorkspace } from "@/lib/context/workspace-context"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function NewDataSourcePage() {
  const { workspaceId } = useWorkspace()
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [secretName, setSecretName] = useState("")
  const [connectionInputType, setConnectionInputType] = useState<"string" | "split">("string")

  // Connection string input
  const [connectionString, setConnectionString] = useState("")

  // Split input fields
  const [host, setHost] = useState("")
  const [port, setPort] = useState("5432")
  const [database, setDatabase] = useState("")
  const [user, setUser] = useState("")
  const [password, setPassword] = useState("")
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

  const handleTestConnection = async () => {
    const finalConnectionString = getFinalConnectionString()

    if (!finalConnectionString) {
      setTestResult({ success: false, error: "Please fill in connection details" })
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

    const finalConnectionString = getFinalConnectionString()

    if (!name || !finalConnectionString || !secretName) {
      setError("Name, connection details, and secret name are required")
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const response = await fetch("/api/data-sources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Workspace-Id": workspaceId,
        },
        body: JSON.stringify({
          name,
          description: description.trim() || undefined,
          databaseType: "postgresql",
          secretPayload: finalConnectionString, // Always store as connection string
          secretName,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create data source")
      }

      // Redirect to the data sources list
      router.push("/data-sources")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create data source")
    } finally {
      setIsCreating(false)
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
              <h1 className="text-2xl font-bold">New Data Source</h1>
              <p className="text-sm text-muted-foreground">Create a new PostgreSQL data source</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Create Data Source</CardTitle>
            <CardDescription>Connect to a PostgreSQL database</CardDescription>
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
                <p className="text-xs text-muted-foreground">PostgreSQL is the only supported database type for MVP</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secretName">Secret Name *</Label>
                <Input
                  id="secretName"
                  placeholder="my-db-connection"
                  value={secretName}
                  onChange={(e) => setSecretName(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Name for the secret in Azure Key Vault (workspace-scoped)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Connection Details *</Label>
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
                      required={connectionInputType === "string"}
                    />
                    <p className="text-xs text-muted-foreground">Paste your PostgreSQL connection string here</p>
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
                          required={connectionInputType === "split"}
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
                        required={connectionInputType === "split"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user">Username *</Label>
                      <Input
                        id="user"
                        placeholder="postgres"
                        value={user}
                        onChange={(e) => setUser(e.target.value)}
                        required={connectionInputType === "split"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required={connectionInputType === "split"}
                      />
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
                          <SelectItem value="require">Require - SSL required, but don't verify certificate</SelectItem>
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
                          {buildConnectionString().replace(/:[^:@]+@/, ":••••••••@")}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Password is hidden for security. This is what will be stored.
                        </p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

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
                    {testResult.success ? "Connection test successful!" : `Connection test failed: ${testResult.error}`}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" nativeButton={false} render={<Link href="/data-sources">Cancel</Link>} />
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? "Creating..." : "Create Data Source"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
