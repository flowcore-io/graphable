import { authOptions } from "@/lib/auth"
import { getWorkspaceForUser, validateWorkspaceAccess } from "@/lib/services/tenant.service"
import { getServerSession } from "next-auth"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"

/**
 * Schema for validating workspace ID
 */
const workspaceIdSchema = z.string().uuid("Invalid workspace ID format")

/**
 * Options for requireWorkspace middleware
 */
export interface RequireWorkspaceOptions {
  /**
   * Where to extract workspace ID from
   * - "header": X-Workspace-Id header
   * - "query": workspaceId query parameter
   * - "body": workspaceId in request body (for POST/PUT/PATCH)
   * - "cookie": workspaceId cookie
   */
  source?: "header" | "query" | "body" | "cookie"
  /**
   * Whether to validate workspace access via Usable API
   * Default: false (only checks tenant link)
   */
  validateAccess?: boolean
}

/**
 * Higher-order function to wrap API route handlers with workspace validation
 *
 * Usage:
 * ```typescript
 * export const POST = requireWorkspace(async (req, { workspaceId, userId }) => {
 *   // workspaceId is validated and guaranteed to exist
 *   // userId is the authenticated user's usable_user_id
 *   // Your handler code here
 * });
 * ```
 */
export function requireWorkspace<T = any>(
  handler: (req: NextRequest, context: { workspaceId: string; userId: string }) => Promise<NextResponse<T>>,
  options: RequireWorkspaceOptions = {}
) {
  return async (req: NextRequest): Promise<NextResponse<T> | NextResponse<{ error: string }>> => {
    try {
      // Layer 1 - Authentication (401)
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 })
      }

      const userId = session.user.id
      const source = options.source || "header"

      // Layer 2 - Extract and validate workspace ID format
      let workspaceId: string | null = null

      if (source === "header") {
        workspaceId = req.headers.get("x-workspace-id")
      } else if (source === "query") {
        const url = new URL(req.url)
        workspaceId = url.searchParams.get("workspaceId")
      } else if (source === "cookie") {
        workspaceId = req.cookies.get("workspaceId")?.value || null
      } else if (source === "body") {
        const body = await req.json().catch(() => ({}))
        workspaceId = body.workspaceId || null
      }

      // Validate workspace ID format
      const validationResult = workspaceIdSchema.safeParse(workspaceId)
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: "Invalid workspace ID",
            details: validationResult.error.issues,
          },
          { status: 400 }
        )
      }

      const validatedWorkspaceId = validationResult.data

      // Layer 3 - Verify user has access to workspace via tenant link
      const userWorkspaceId = await getWorkspaceForUser(userId)
      if (userWorkspaceId !== validatedWorkspaceId) {
        return NextResponse.json({ error: "Workspace not found or access denied" }, { status: 404 })
      }

      // Layer 4 - Optional: Validate workspace access via Usable API
      if (options.validateAccess && session.user.accessToken) {
        const hasAccess = await validateWorkspaceAccess(validatedWorkspaceId, userId, session.user.accessToken)
        if (!hasAccess) {
          return NextResponse.json({ error: "Workspace access denied" }, { status: 403 })
        }
      }

      // Call the handler with validated context
      return handler(req, {
        workspaceId: validatedWorkspaceId,
        userId,
      })
    } catch (error) {
      console.error("Workspace guard error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }
}
