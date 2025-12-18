"use client"

import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { useGraphEditor } from "@/lib/context/graph-editor-context"
import Editor from "@monaco-editor/react"
import type * as monaco from "monaco-editor"
import { useEffect, useRef } from "react"

interface SqlQueryEditorProps {
  value: string
  onChange: (value: string) => void
  error?: { message?: string }
}

export function SqlQueryEditor({ value, onChange, error }: SqlQueryEditorProps) {
  const { parameters } = useGraphEditor()
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof monaco | null>(null)

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof monaco) => {
    editorRef.current = editor
    monacoRef.current = monacoInstance

    // Register parameter completion provider
    const disposable = monacoInstance.languages.registerCompletionItemProvider("sql", {
      triggerCharacters: [":"],
      provideCompletionItems: (model, position) => {
        // Get the line text up to the cursor
        const lineText = model.getLineContent(position.lineNumber)
        const textUntilPosition = lineText.substring(0, position.column - 1)

        // Find the last ":" before the cursor
        const lastColonIndex = textUntilPosition.lastIndexOf(":")
        if (lastColonIndex === -1) {
          return { suggestions: [] }
        }

        // Get text after the colon (what user has typed so far)
        const textAfterColon = textUntilPosition.slice(lastColonIndex + 1).toLowerCase()

        // Calculate the range to replace
        // lastColonIndex is 0-based in substring, position.column is 1-based
        // The colon is at column: lastColonIndex + 1
        // We want to replace from after colon (lastColonIndex + 2) to cursor (position.column)
        const colonColumn = lastColonIndex + 1 // Column where colon is (1-based)
        const startColumn = colonColumn + 1 // Start after the colon (1-based)
        const endColumn = position.column // Current cursor position (1-based)

        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn,
          endColumn,
        }

        const suggestions: monaco.languages.CompletionItem[] = []

        // Suggest parameter names that match what's typed
        parameters.forEach((param) => {
          if (param.name) {
            const paramNameLower = param.name.toLowerCase()
            // Show if it matches what's typed after ":" or if nothing is typed yet
            if (!textAfterColon || paramNameLower.startsWith(textAfterColon)) {
              suggestions.push({
                label: `:${param.name}`,
                kind: monacoInstance.languages.CompletionItemKind.Variable,
                insertText: param.name, // Just the param name, colon is already there
                range,
                detail: `Parameter: ${param.type}${param.required ? " (required)" : " (optional)"}`,
                documentation: `Use this parameter in your query. Type: ${param.type}`,
              })
            }
          }
        })

        return { suggestions }
      },
    })

    // Store disposable for cleanup
    // biome-ignore lint/suspicious/noExplicitAny: Need to store disposable on editor instance
    ;(editor as any).__parameterCompletionDisposable = disposable
  }

  // Re-register completion provider when parameters change
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return

    const editor = editorRef.current
    const monacoInstance = monacoRef.current

    // Dispose old provider if exists
    // biome-ignore lint/suspicious/noExplicitAny: Need to access internal disposable
    const oldDisposable = (editor as any).__parameterCompletionDisposable as monaco.IDisposable | undefined
    if (oldDisposable) {
      oldDisposable.dispose()
    }

    // Register new completion provider
    const disposable = monacoInstance.languages.registerCompletionItemProvider("sql", {
      triggerCharacters: [":"],
      provideCompletionItems: (model, position) => {
        // Get the line text up to the cursor
        const lineText = model.getLineContent(position.lineNumber)
        const textUntilPosition = lineText.substring(0, position.column - 1)

        // Find the last ":" before the cursor
        const lastColonIndex = textUntilPosition.lastIndexOf(":")
        if (lastColonIndex === -1) {
          return { suggestions: [] }
        }

        // Get text after the colon (what user has typed so far)
        const textAfterColon = textUntilPosition.slice(lastColonIndex + 1).toLowerCase()

        // Calculate the range to replace
        // lastColonIndex is 0-based in substring, position.column is 1-based
        // The colon is at column: lastColonIndex + 1
        // We want to replace from after colon (lastColonIndex + 2) to cursor (position.column)
        const colonColumn = lastColonIndex + 1 // Column where colon is (1-based)
        const startColumn = colonColumn + 1 // Start after the colon (1-based)
        const endColumn = position.column // Current cursor position (1-based)

        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn,
          endColumn,
        }

        const suggestions: monaco.languages.CompletionItem[] = []

        // Suggest parameter names that match what's typed
        parameters.forEach((param) => {
          if (param.name) {
            const paramNameLower = param.name.toLowerCase()
            // Show if it matches what's typed after ":" or if nothing is typed yet
            if (!textAfterColon || paramNameLower.startsWith(textAfterColon)) {
              suggestions.push({
                label: `:${param.name}`,
                kind: monacoInstance.languages.CompletionItemKind.Variable,
                insertText: param.name, // Just the param name, colon is already there
                range,
                detail: `Parameter: ${param.type}${param.required ? " (required)" : " (optional)"}`,
                documentation: `Use this parameter in your query. Type: ${param.type}`,
              })
            }
          }
        })

        return { suggestions }
      },
    })

    // biome-ignore lint/suspicious/noExplicitAny: Need to store disposable on editor instance
    ;(editor as any).__parameterCompletionDisposable = disposable

    return () => {
      disposable.dispose()
    }
  }, [parameters])

  return (
    <Field>
      <FieldLabel>
        SQL Query <span className="text-destructive">*</span>
      </FieldLabel>
      <FieldContent>
        <div className="border rounded-md overflow-hidden" style={{ minHeight: "300px" }}>
          <Editor
            height="300px"
            defaultLanguage="sql"
            value={value}
            onChange={(val) => onChange(val || "")}
            onMount={handleEditorDidMount}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: "on",
              scrollbar: {
                vertical: "auto",
                horizontal: "auto",
              },
              suggestOnTriggerCharacters: true,
              quickSuggestions: {
                other: true,
                comments: false,
                strings: false,
              },
              quickSuggestionsDelay: 100,
            }}
          />
        </div>
        <FieldDescription>
          Use :paramName for parameters. Type ":" to see available parameters. Example: SELECT * FROM users WHERE age
          &gt; :minAge
        </FieldDescription>
        <FieldError errors={error ? [error] : undefined} />
      </FieldContent>
    </Field>
  )
}




