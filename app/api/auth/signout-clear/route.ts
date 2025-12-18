import { env } from "@/lib/env"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET /api/auth/signout-clear
 * Clears NextAuth session cookie and redirects to signin
 * Used as post-logout redirect from Keycloak to avoid confirmation page
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = `${url.protocol}//${url.host}`
  const signinUrl = new URL("/auth/signin", origin)

  // Clear NextAuth session cookie by setting it to expire
  const cookieName = env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "dev-next-auth.session-token"

  const response = NextResponse.redirect(signinUrl)

  // Clear the session cookie
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: env.NODE_ENV === "production",
    maxAge: 0,
    expires: new Date(0),
  })

  // Also clear callback URL cookie if it exists
  const callbackCookieName =
    env.NODE_ENV === "production" ? "__Secure-next-auth.callback-url" : "dev-next-auth.callback-url"
  response.cookies.set(callbackCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: env.NODE_ENV === "production",
    maxAge: 0,
    expires: new Date(0),
  })

  return response
}





