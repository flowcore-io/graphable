"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useWorkspace } from "@/lib/context/workspace-context"
import Editor from "@monaco-editor/react"
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, PlayIcon, TableIcon } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

interface QueryResult {
  rows: unknown[]
  columns: string[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export default function DataSourceViewPage() {
  const { workspaceId } = useWorkspace()
  const router = useRouter()
  const params = useParams()
  const dataSourceId = params.dataSourceId as string
  const [isLoading, setIsLoading] = useState(true)
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dataSourceName, setDataSourceName] = useState("")
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM ")
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null)
  const [tables, setTables] = useState<Array<{ name: string; schema?: string }>>([])
  const [showTables, setShowTables] = useState(true)
  const editorRef = useRef<any>(null)

  useEffect(() => {
    if (!workspaceId || !dataSourceId) return

    // Fetch data source name
    fetch(`/api/data-sources/${dataSourceId}`, {
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    })
      .then(async (res) => {
        const data = await res.json()
        if (res.ok && data.dataSource) {
          setDataSourceName(data.dataSource.name || "Data Source")
        }
      })
      .catch((err) => {
        console.error("Failed to fetch data source:", err)
      })
      .finally(() => {
        setIsLoading(false)
      })

    // Fetch tables list
    fetch(`/api/data-sources/${dataSourceId}/explore?action=listTables`, {
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    })
      .then(async (res) => {
        const data = await res.json()
        if (res.ok && data.tables) {
          setTables(data.tables)
        }
      })
      .catch((err) => {
        console.error("Failed to fetch tables:", err)
      })
  }, [workspaceId, dataSourceId])

  const handleExecuteQuery = async (page: number = 1) => {
    if (!workspaceId || !sqlQuery.trim()) {
      setError("Please enter a SQL query")
      return
    }

    setIsExecuting(true)
    setError(null)

    try {
      const response = await fetch(`/api/data-sources/${dataSourceId}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Workspace-Id": workspaceId,
        },
        body: JSON.stringify({
          query: sqlQuery.trim(),
          page,
          pageSize: 50,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to execute query")
      }

      setQueryResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute query")
      setQueryResult(null)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleTableClick = (tableName: string, schema?: string) => {
    const tableRef = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`
    const newQuery = `SELECT * FROM ${tableRef} LIMIT 100`
    setSqlQuery(newQuery)
    if (editorRef.current) {
      editorRef.current.setValue(newQuery)
    }
  }

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor
    // Configure SQL language
    editor.updateOptions({
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: "on",
      scrollBeyondLastLine: false,
      automaticLayout: true,
    })
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
          <Card className="max-w-full mx-auto">
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
              <h1 className="text-2xl font-bold">{dataSourceName}</h1>
              <p className="text-sm text-muted-foreground">Query and explore your data</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex gap-4 h-[calc(100vh-12rem)]">
          {/* Tables Sidebar */}
          {showTables && (
            <Card className="w-64 flex-shrink-0">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Tables</CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowTables(false)}>
                    <ChevronLeftIcon className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="overflow-y-auto max-h-[calc(100vh-16rem)]">
                {tables.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tables found</p>
                ) : (
                  <div className="space-y-1">
                    {tables.map((table, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleTableClick(table.name, table.schema)}
                        className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2"
                      >
                        <TableIcon className="h-3 w-3" />
                        <span className="truncate">{table.schema ? `${table.schema}.${table.name}` : table.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Main Query Area */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* SQL Editor */}
            <Card className="flex-1 flex flex-col min-h-0">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">SQL Query</CardTitle>
                  <div className="flex items-center gap-2">
                    {!showTables && (
                      <Button variant="outline" size="sm" onClick={() => setShowTables(true)}>
                        <TableIcon className="h-4 w-4 mr-2" />
                        Tables
                      </Button>
                    )}
                    <Button onClick={() => handleExecuteQuery(1)} disabled={isExecuting || !sqlQuery.trim()} size="sm">
                      <PlayIcon className="h-4 w-4 mr-2" />
                      {isExecuting ? "Executing..." : "Execute"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 p-0">
                <div className="h-full border-t">
                  <Editor
                    height="100%"
                    defaultLanguage="sql"
                    value={sqlQuery}
                    onChange={(value) => setSqlQuery(value || "")}
                    onMount={handleEditorDidMount}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      wordWrap: "on",
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            {error && (
              <Card>
                <CardContent className="pt-6">
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                    {error}
                  </div>
                </CardContent>
              </Card>
            )}

            {queryResult && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-medium">Results</CardTitle>
                      <CardDescription className="text-xs">
                        Showing {queryResult.rows.length} of {queryResult.totalCount} rows
                      </CardDescription>
                    </div>
                    {queryResult.totalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExecuteQuery(queryResult.page - 1)}
                          disabled={queryResult.page <= 1 || isExecuting}
                        >
                          <ChevronLeftIcon className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Page {queryResult.page} of {queryResult.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExecuteQuery(queryResult.page + 1)}
                          disabled={queryResult.page >= queryResult.totalPages || isExecuting}
                        >
                          <ChevronRightIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {queryResult.columns.map((col) => (
                            <TableHead key={col} className="font-medium">
                              {col}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queryResult.rows.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={queryResult.columns.length}
                              className="text-center text-muted-foreground"
                            >
                              No rows returned
                            </TableCell>
                          </TableRow>
                        ) : (
                          queryResult.rows.map((row, rowIdx) => (
                            <TableRow key={rowIdx}>
                              {queryResult.columns.map((col) => (
                                <TableCell key={col} className="font-mono text-xs">
                                  {row[col as keyof typeof row] !== null && row[col as keyof typeof row] !== undefined
                                    ? String(row[col as keyof typeof row])
                                    : "NULL"}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
