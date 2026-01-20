import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * NextAuth.js API Route Handler
 *
 * Handles all authentication requests including:
 * - Sign in/out
 * - OAuth callbacks
 * - Session management
 */
const handler = NextAuth(authOptions)

/**
 * Wrap handlers with error logging for debugging 502 issues
 */
export async function GET(req: Request, context: { params: Promise<{ nextauth: string[] }> }) {
  const url = new URL(req.url)
  console.log(`🔐 [AUTH] GET ${url.pathname}${url.search}`)

  try {
    // Await params as per Next.js 16 async params requirement
    const params = await context.params
    const response = await handler(req, { params })
    console.log(`✅ [AUTH] Response status: ${response.status}`)
    return response
  } catch (error) {
    console.error(`❌ [AUTH] Error in GET handler:`, error)
    throw error
  }
}

export async function POST(req: Request, context: { params: Promise<{ nextauth: string[] }> }) {
  const url = new URL(req.url)
  console.log(`🔐 [AUTH] POST ${url.pathname}`)

  try {
    // Await params as per Next.js 16 async params requirement
    const params = await context.params
    const response = await handler(req, { params })
    console.log(`✅ [AUTH] Response status: ${response.status}`)
    return response
  } catch (error) {
    console.error(`❌ [AUTH] Error in POST handler:`, error)
    throw error
  }
}
