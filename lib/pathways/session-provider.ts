import { authOptions } from "@/lib/auth"
import { AUDIT_USER_ENTITY_TYPE, SessionPathwayBuilder } from "@flowcore/pathways"
import { getServerSession } from "next-auth"
import type { NextRequest } from "next/server"
import { pathways } from "./pathways"

export interface SessionPathwayContext {
  pathway: SessionPathwayBuilder<any>
  sessionId: string
  userId: string
  userType: "user" | "key"
}

/**
 * Create a session pathway with user resolver from NextAuth session
 * Enables automatic audit tracking for all events
 */
export async function createSessionPathway(
  _request: NextRequest,
  customSessionId?: string
): Promise<SessionPathwayContext> {
  // Get session from NextAuth
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    throw new Error("Authentication required")
  }

  const entityId = session.user.id
  const entityType = AUDIT_USER_ENTITY_TYPE

  // Create session pathway with user resolver
  const sessionPathway = new SessionPathwayBuilder(pathways, customSessionId).withUserResolver(async () => ({
    entityId,
    entityType,
  }))

  return {
    pathway: sessionPathway,
    sessionId: sessionPathway.getSessionId(),
    userId: entityId,
    userType: entityType,
  }
}

/**
 * Create session pathway for API routes
 * Uses request headers/cookies to get session
 */
export async function createSessionPathwayForAPI(): Promise<SessionPathwayContext | null> {
  try {
    // For API routes, we need to create a mock request
    // In practice, this will be called from API routes with actual request
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return null
    }

    const entityId = session.user.id
    const entityType = AUDIT_USER_ENTITY_TYPE

    const sessionPathway = new SessionPathwayBuilder(pathways).withUserResolver(async () => ({
      entityId,
      entityType,
    }))

    return {
      pathway: sessionPathway,
      sessionId: sessionPathway.getSessionId(),
      userId: entityId,
      userType: entityType,
    }
  } catch (error) {
    console.error("Failed to create session pathway:", error)
    return null
  }
}
