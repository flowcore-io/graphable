"use client"

import { useWorkspace } from "@/lib/context/workspace-context"
import { signOut } from "next-auth/react"
import { useEffect } from "react"

export default function SignOutPage() {
  const { setWorkspaceId } = useWorkspace()

  useEffect(() => {
    // Clear any local tenant context first so the app doesn't "remember" a workspace after logout.
    setWorkspaceId(null)

    // For Keycloak, we need to manually redirect to the end-session endpoint
    // NextAuth's signOut doesn't always handle Keycloak logout properly
    const performLogout = async () => {
      try {
        // First, clear the NextAuth session
        await signOut({ redirect: false })

        // Then redirect to our API route which will handle the Keycloak logout redirect
        // This ensures proper Keycloak end-session flow
        const redirectUri = encodeURIComponent(`${window.location.origin}/auth/signin`)
        window.location.href = `/api/auth/keycloak-logout?redirect_uri=${redirectUri}`
      } catch (error) {
        console.error("Error during logout:", error)
        // Fallback: just redirect to signin
        window.location.href = "/auth/signin"
      }
    }

    performLogout()
  }, [setWorkspaceId])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-sm text-muted-foreground">Signing you out…</div>
    </div>
  )
}
