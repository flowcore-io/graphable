import { db } from "@/db"
import { tenantLinks } from "@/db/schema"
import type { FlowcoreEvent } from "@flowcore/pathways"
import { eq } from "drizzle-orm"
import type { EventTenantLinked, EventTenantUnlinked } from "./tenant.0"

/**
 * Handler for tenant.linked.0 event
 * Creates tenant link in database (idempotent)
 */
export async function handlerTenantLinked(event: FlowcoreEvent<EventTenantLinked>) {
  console.log(`Processing tenant.linked.0: ${event.eventId}`)

  const { workspaceId, usableUserId } = event.payload

  // Check if tenant link already exists (idempotent)
  const existing = await db.select().from(tenantLinks).where(eq(tenantLinks.usableUserId, usableUserId)).limit(1)

  if (existing[0]) {
    console.log(`✅ Tenant link already exists for user ${usableUserId}, skipping`)
    return
  }

  // Create tenant link
  await db.insert(tenantLinks).values({
    usableUserId,
    workspaceId,
  })

  console.log(`✅ Tenant link created: workspace ${workspaceId} linked to user ${usableUserId}`)
}

/**
 * Handler for tenant.unlinked.0 event
 * Deletes tenant link from database (idempotent)
 */
export async function handlerTenantUnlinked(event: FlowcoreEvent<EventTenantUnlinked>) {
  console.log(`Processing tenant.unlinked.0: ${event.eventId}`)

  const { workspaceId, usableUserId } = event.payload

  // Check if tenant link exists
  const existing = await db.select().from(tenantLinks).where(eq(tenantLinks.usableUserId, usableUserId)).limit(1)

  if (!existing[0]) {
    console.log(`⚠️  Tenant link not found for user ${usableUserId}, skipping`)
    return
  }

  // Verify it's the correct workspace
  if (existing[0].workspaceId !== workspaceId) {
    console.log(`⚠️  Workspace mismatch: expected ${workspaceId}, found ${existing[0].workspaceId}, skipping`)
    return
  }

  // Delete tenant link
  await db.delete(tenantLinks).where(eq(tenantLinks.usableUserId, usableUserId))

  console.log(`✅ Tenant link deleted: workspace ${workspaceId} unlinked from user ${usableUserId}`)
}



