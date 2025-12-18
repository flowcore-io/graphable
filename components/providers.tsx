"use client"

import { WorkspaceProvider } from "@/lib/context/workspace-context"
import { SessionProvider } from "next-auth/react"
import { WorkspaceGuard } from "./workspace-guard"

export function Providers({
  children,
  initialWorkspaceId,
}: {
  children: React.ReactNode
  initialWorkspaceId?: string | null
}) {
  return (
    <SessionProvider>
      <WorkspaceProvider initialWorkspaceId={initialWorkspaceId}>
        <WorkspaceGuard>{children}</WorkspaceGuard>
      </WorkspaceProvider>
    </SessionProvider>
  )
}








