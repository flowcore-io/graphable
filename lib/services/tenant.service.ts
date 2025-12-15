import { db } from "@/db"
import type { TenantLink } from "@/db/schema"
import { tenantLinks } from "@/db/schema"
import type { SessionPathwayBuilder } from "@flowcore/pathways"
import { eq } from "drizzle-orm"
import { usableApi } from "./usable-api.service"

/**
 * Get tenant link for a user
 */
export async function getTenantLink(usableUserId: string): Promise<TenantLink | null> {
  const result = await db.select().from(tenantLinks).where(eq(tenantLinks.usableUserId, usableUserId)).limit(1)

  return result[0] || null
}

/**
 * Get tenant link by workspace ID
 * Used to check if a workspace is already linked to another user
 */
export async function getTenantLinkByWorkspace(workspaceId: string): Promise<TenantLink | null> {
  const result = await db.select().from(tenantLinks).where(eq(tenantLinks.workspaceId, workspaceId)).limit(1)

  return result[0] || null
}

/**
 * Create tenant link by emitting tenant.linked.0 event
 * Does NOT write to database directly - event handler does that
 */
export async function createTenantLink(
  usableUserId: string,
  workspaceId: string,
  sessionPathway: SessionPathwayBuilder<any>
): Promise<void> {
  // Check if workspace is already linked to another user
  const existingLink = await getTenantLinkByWorkspace(workspaceId)
  if (existingLink && existingLink.usableUserId !== usableUserId) {
    throw new Error("Workspace is already linked to another user")
  }

  // Check if user already has a tenant link
  const userLink = await getTenantLink(usableUserId)
  if (userLink) {
    throw new Error("User already has a linked workspace")
  }

  // Emit tenant.linked.0 event via Session Pathways
  await (sessionPathway as any).write("graphable.tenant.0/tenant.linked.0", {
    data: {
      workspaceId,
      usableUserId,
      occurredAt: new Date().toISOString(),
      initiatedBy: usableUserId,
    },
  })
}

/**
 * Delete tenant link by emitting tenant.unlinked.0 event
 * Does NOT delete from database directly - event handler does that
 */
export async function deleteTenantLink(
  usableUserId: string,
  sessionPathway: SessionPathwayBuilder<any>
): Promise<void> {
  // Check if tenant link exists
  const tenantLink = await getTenantLink(usableUserId)
  if (!tenantLink) {
    throw new Error("No tenant link found for user")
  }

  // Emit tenant.unlinked.0 event via Session Pathways
  await (sessionPathway as any).write("graphable.tenant.0/tenant.unlinked.0", {
    data: {
      workspaceId: tenantLink.workspaceId,
      usableUserId,
      occurredAt: new Date().toISOString(),
      initiatedBy: usableUserId,
    },
  })
}

/**
 * Validate that user has access to workspace via Usable API
 */
export async function validateWorkspaceAccess(
  workspaceId: string,
  _usableUserId: string,
  accessToken: string
): Promise<boolean> {
  try {
    const workspace = await usableApi.getWorkspace(workspaceId, accessToken)
    // If we can get the workspace, user has access
    // Additional role checking can be added here if needed
    return !!workspace
  } catch (error) {
    console.error("Workspace access validation failed:", error)
    return false
  }
}

/**
 * Get workspace ID for a user
 */
export async function getWorkspaceForUser(usableUserId: string): Promise<string | null> {
  const tenantLink = await getTenantLink(usableUserId)
  return tenantLink?.workspaceId || null
}
