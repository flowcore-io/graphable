import { authOptions } from "@/lib/auth"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET /api/auth/signout-auto
 * Auto-signout without confirmation - clears session and redirects to Keycloak logout
 * This bypasses NextAuth's confirmation page
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  const url = new URL(request.url)
  const origin = `${url.protocol}//${url.host}`

  // If no session, redirect directly to signin
  if (!session) {
    return NextResponse.redirect(new URL("/auth/signin", origin))
  }

  // Redirect to Keycloak logout (which will handle the full logout flow)
  return NextResponse.redirect(new URL("/api/auth/keycloak-logout", origin))
}
