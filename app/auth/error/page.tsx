import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AlertCircle } from "lucide-react"
import Link from "next/link"

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams
  const error = params.error || "Unknown error"

  const errorMessages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration.",
    AccessDenied: "You do not have permission to sign in.",
    Verification: "The verification link may have expired or been already used.",
    OAuthSignin: "Error in constructing an authorization URL.",
    OAuthCallback: "Error in handling the response from the OAuth provider.",
    OAuthCreateAccount: "Could not create OAuth provider user in the database.",
    EmailCreateAccount: "Could not create email provider user in the database.",
    Callback: "Error in the OAuth callback handler route.",
    OAuthAccountNotLinked: "Email already associated with another account.",
    EmailSignin: "Check your email address.",
    CredentialsSignin: "Sign in failed. Check the details you provided are correct.",
    SessionRequired: "Please sign in to access this page.",
    MissingUsableUserId:
      "Your user account needs to be updated. Please sign in to usable.dev to sync your user information, then try again.",
    Default: "Unable to sign in.",
  }

  const errorMessage = errorMessages[error] || errorMessages.Default

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 shadow-lg">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Authentication Error</h1>
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
