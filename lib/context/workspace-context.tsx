"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"

interface WorkspaceContextType {
  workspaceId: string | null
  setWorkspaceId: (workspaceId: string | null) => void
  isLoading: boolean
  refreshWorkspace: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

const WORKSPACE_STORAGE_KEY = "graphable_workspace_id"

/**
 * WorkspaceProvider - Manages workspace context with localStorage persistence
 */
export function WorkspaceProvider({
  children,
  initialWorkspaceId,
}: {
  children: React.ReactNode
  initialWorkspaceId?: string | null
}) {
  const [workspaceId, setWorkspaceIdState] = useState<string | null>(initialWorkspaceId || null)
  const [isLoading, setIsLoading] = useState(true)

  // Load workspace from localStorage on mount
  useEffect(() => {
    if (initialWorkspaceId) {
      // Server-provided workspace ID takes precedence
      setWorkspaceIdState(initialWorkspaceId)
      if (typeof window !== "undefined") {
        localStorage.setItem(WORKSPACE_STORAGE_KEY, initialWorkspaceId)
      }
      setIsLoading(false)
      return
    }

    // Load from localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY)
      if (stored) {
        setWorkspaceIdState(stored)
      }
    }
    setIsLoading(false)
  }, [initialWorkspaceId])

  // Set workspace ID and persist to localStorage
  const setWorkspaceId = useCallback((id: string | null) => {
    setWorkspaceIdState(id)
    if (typeof window !== "undefined") {
      if (id) {
        localStorage.setItem(WORKSPACE_STORAGE_KEY, id)
      } else {
        localStorage.removeItem(WORKSPACE_STORAGE_KEY)
      }
    }
  }, [])

  // Refresh workspace from server
  const refreshWorkspace = useCallback(async () => {
    try {
      const response = await fetch("/api/workspace/current")
      if (response.ok) {
        const data = await response.json()
        if (data.workspaceId) {
          setWorkspaceId(data.workspaceId)
        } else {
          setWorkspaceId(null)
        }
      } else {
        // No workspace linked
        setWorkspaceId(null)
      }
    } catch (error) {
      console.error("Failed to refresh workspace:", error)
      // Don't clear workspace on error - keep existing value
    }
  }, [setWorkspaceId])

  return (
    <WorkspaceContext.Provider
      value={{
        workspaceId,
        setWorkspaceId,
        isLoading,
        refreshWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

/**
 * Hook to access workspace context
 */
export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (context === undefined) {
    throw new Error("useWorkspace must be used within WorkspaceProvider")
  }
  return context
}








