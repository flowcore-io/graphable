import { authOptions } from "@/lib/auth"
import { env } from "@/lib/env"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET /api/auth/keycloak-logout
 * Redirects to Keycloak's end-session endpoint for proper RP-initiated logout
 * Uses id_token_hint and post_logout_redirect_uri as per Keycloak spec
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  const url = new URL(request.url)
  const origin = `${url.protocol}//${url.host}`
  const fallback = new URL("/api/auth/signout", origin)
  fallback.searchParams.set("callbackUrl", "/auth/signin")

  const issuer = env.USABLE_OIDC_ISSUER
  // idToken is stored in JWT but not exposed in Session type
  // Access it via type assertion since it's set in auth.ts callbacks
  // biome-ignore lint/suspicious/noExplicitAny: idToken is not in Session type but exists at runtime
  const idToken: string | undefined = (session as { idToken?: string })?.idToken

  if (!issuer || !idToken) {
    // Fallback to NextAuth signout if we don't have idToken
    return NextResponse.redirect(fallback)
  }

  // After Keycloak logout, redirect to our auto-signout route to clear local session without confirmation
  const postLogoutUrl = new URL("/api/auth/signout-clear", origin)

  // Build Keycloak end-session URL with proper parameters
  const logoutUrl = new URL(`${issuer}/protocol/openid-connect/logout`)
  logoutUrl.searchParams.set("id_token_hint", idToken)
  logoutUrl.searchParams.set("post_logout_redirect_uri", postLogoutUrl.toString())

  // Redirect to Keycloak's logout endpoint
  return NextResponse.redirect(logoutUrl.toString())
}
