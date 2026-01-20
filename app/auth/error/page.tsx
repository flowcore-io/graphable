import { AlertCircle, RefreshCw } from "lucide-react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams
  const error = params.error || "Unknown error"

  const errorMessages: Record<string, { message: string; autoRetry?: boolean }> = {
    Configuration: { message: "There is a problem with the server configuration." },
    AccessDenied: { message: "You do not have permission to sign in." },
    Verification: { message: "The verification link may have expired or been already used." },
    OAuthSignin: { message: "Error in constructing an authorization URL." },
    OAuthCallback: {
      message: "Temporary issue connecting to authentication service. Retrying automatically...",
      autoRetry: true,
    },
    OAuthCreateAccount: { message: "Could not create OAuth provider user in the database." },
    EmailCreateAccount: { message: "Could not create email provider user in the database." },
    Callback: {
      message: "Temporary issue during authentication. Retrying automatically...",
      autoRetry: true,
    },
    OAuthAccountNotLinked: { message: "Email already associated with another account." },
    EmailSignin: { message: "Check your email address." },
    CredentialsSignin: { message: "Sign in failed. Check the details you provided are correct." },
    SessionRequired: { message: "Please sign in to access this page." },
    MissingUsableUserId: {
      message:
        "Your user account needs to be updated. Please sign in to usable.dev to sync your user information, then try again.",
    },
    Default: { message: "Unable to sign in." },
  }

  const errorInfo = errorMessages[error] || errorMessages.Default
  const errorMessage = errorInfo.message
  const shouldAutoRetry = errorInfo.autoRetry || false

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-background to-muted">
      {shouldAutoRetry && <AutoRetryScript />}
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 shadow-lg">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className={cn("rounded-full p-3", shouldAutoRetry ? "bg-blue-500/10" : "bg-destructive/10")}>
              {shouldAutoRetry ? (
                <RefreshCw className="h-10 w-10 text-blue-500 animate-spin" />
              ) : (
                <AlertCircle className="h-10 w-10 text-destructive" />
              )}
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {shouldAutoRetry ? "Retrying Authentication" : "Authentication Error"}
          </h1>
          <p className="mt-2 text-muted-foreground">{errorMessage}</p>
        </div>

        {error === "MissingUsableUserId" && (
          <div className="space-y-3 rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium">What to do:</p>
            <ol className="ml-4 list-decimal space-y-2">
              <li>
                Sign in to{" "}
                <a
                  href="https://usable.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  usable.dev
                </a>
              </li>
              <li>Make sure your user account is properly set up</li>
              <li>Return here and try signing in again</li>
            </ol>
          </div>
        )}

        <div className="space-y-2 rounded-lg bg-destructive/10 p-4 text-sm">
          <p className="font-medium text-destructive">Error Code:</p>
          <p className="font-mono text-xs">{error}</p>
        </div>

        <div className="flex gap-2">
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "flex-1")}>
            Home
          </Link>
          {error === "MissingUsableUserId" ? (
            <a
              href="https://usable.dev"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "default" }), "flex-1")}
            >
              Go to usable.dev
            </a>
          ) : (
            <Link href="/auth/signin" className={cn(buttonVariants(), "flex-1")}>
              Try Again
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Auto-retry component for OAuth callback errors
 * Automatically redirects to sign-in page after 2 seconds
 * This handles race conditions in multi-pod deployments where OAuth codes get consumed by multiple pods
 */
function AutoRetryScript() {
  return <meta httpEquiv="refresh" content="2;url=/auth/signin" />
}
