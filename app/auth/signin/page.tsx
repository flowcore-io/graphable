"use client"

import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"

function SignInContent() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/"

  useEffect(() => {
    // CRITICAL: Automatically redirect to Keycloak provider
    // This provides seamless UX - no intermediate button click needed
    signIn("keycloak", { callbackUrl })
  }, [callbackUrl])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted">
      <div className="w-full max-w-md space-y-8 rounded-lg border bg-card p-8 shadow-lg">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Redirecting to Keycloak...</h2>
          <p className="text-muted-foreground">You will be redirected to the Keycloak login page automatically.</p>
          <p className="text-sm text-muted-foreground mt-4">
            If you are not redirected automatically,{" "}
            <button
              type="button"
              onClick={() => signIn("keycloak", { callbackUrl })}
              className="text-primary hover:text-primary/80 underline"
            >
              click here
            </button>
            .
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted">
          <div className="w-full max-w-md space-y-8 rounded-lg border bg-card p-8 shadow-lg">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Loading...</h2>
            </div>
          </div>
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  )
}



