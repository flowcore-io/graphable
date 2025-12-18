import { z } from "zod"

/**
 * Flow type for Graphable tenant events
 * Following PRD event model: graphable.tenant.0
 */
export const FlowcoreTenant = {
  flowType: "graphable.tenant.0",
  eventType: {
    linked: "tenant.linked.0",
    unlinked: "tenant.unlinked.0",
  },
} as const

/**
 * Event schema for tenant.linked.0
 * Emitted when a workspace is linked to a user
 */
export const EventTenantLinkedSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID format"),
  usableUserId: z.string().min(1, "Usable user ID is required"),
  occurredAt: z.string().datetime(),
  initiatedBy: z.string().min(1, "Initiated by is required"),
  requestId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
})

/**
 * Event schema for tenant.unlinked.0
 * Emitted when a workspace is unlinked from a user
 */
export const EventTenantUnlinkedSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID format"),
  usableUserId: z.string().min(1, "Usable user ID is required"),
  occurredAt: z.string().datetime(),
  initiatedBy: z.string().min(1, "Initiated by is required"),
  requestId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
})

// Type exports
export type EventTenantLinked = z.infer<typeof EventTenantLinkedSchema>
export type EventTenantUnlinked = z.infer<typeof EventTenantUnlinkedSchema>








