"use client"

import { useWorkspace } from "@/lib/context/workspace-context"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

/**
 * WorkspaceGuard - Client-side component to check tenant link and redirect to onboarding
 * This runs after authentication and checks if user has a linked workspace
 */
export function WorkspaceGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status: sessionStatus } = useSession()
  const { workspaceId, isLoading } = useWorkspace()
  const router = useRouter()

  useEffect(() => {
    // Wait for session to load
    if (sessionStatus === "loading") {
      return
    }

    // If not authenticated, don't check workspace (auth middleware handles redirect)
    if (!session?.user) {
      return
    }

    // Wait for workspace to load
    if (isLoading) {
      return
    }

    // Check if we're already on onboarding page
    if (typeof window !== "undefined") {
      const isOnOnboardingPage = window.location.pathname.startsWith("/onboarding")
      const isOnAuthPage = window.location.pathname.startsWith("/auth")

      // If no workspace linked and not on onboarding/auth page, redirect
      if (!workspaceId && !isOnOnboardingPage && !isOnAuthPage) {
        router.push("/onboarding/link-workspace")
      }
    }
  }, [session, sessionStatus, workspaceId, isLoading, router])

  return <>{children}</>
}



