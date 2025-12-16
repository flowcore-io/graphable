import { z } from "zod"

/**
 * Flow type for Graphable dashboard events
 * Following PRD event model: graphable.dashboard.0
 */
export const FlowcoreDashboard = {
  flowType: "graphable.dashboard.0",
  eventType: {
    created: "dashboard.created.0",
    updated: "dashboard.updated.0",
    deleted: "dashboard.deleted.0",
  },
} as const

/**
 * Event schema for dashboard.created.0
 * Emitted when a dashboard fragment is created
 */
export const EventDashboardCreatedSchema = z.object({
  dashboardId: z.string().uuid("Invalid dashboard ID format"),
  fragmentId: z.string().uuid("Invalid fragment ID format"),
  workspaceId: z.string().uuid("Invalid workspace ID format"),
  folderId: z.string().uuid("Invalid folder ID format").optional(),
  occurredAt: z.string().datetime(),
  initiatedBy: z.string().min(1, "Initiated by is required"),
  requestId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
})

/**
 * Event schema for dashboard.updated.0
 * Emitted when a dashboard fragment is updated
 */
export const EventDashboardUpdatedSchema = z.object({
  dashboardId: z.string().uuid("Invalid dashboard ID format"),
  fragmentId: z.string().uuid("Invalid fragment ID format"),
  workspaceId: z.string().uuid("Invalid workspace ID format"),
  folderId: z.string().uuid("Invalid folder ID format").optional(),
  occurredAt: z.string().datetime(),
  initiatedBy: z.string().min(1, "Initiated by is required"),
  requestId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
})

/**
 * Event schema for dashboard.deleted.0
 * Emitted when a dashboard fragment is deleted
 */
export const EventDashboardDeletedSchema = z.object({
  dashboardId: z.string().uuid("Invalid dashboard ID format"),
  fragmentId: z.string().uuid("Invalid fragment ID format"),
  workspaceId: z.string().uuid("Invalid workspace ID format"),
  occurredAt: z.string().datetime(),
  initiatedBy: z.string().min(1, "Initiated by is required"),
  requestId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
})

// Type exports
export type EventDashboardCreated = z.infer<typeof EventDashboardCreatedSchema>
export type EventDashboardUpdated = z.infer<typeof EventDashboardUpdatedSchema>
export type EventDashboardDeleted = z.infer<typeof EventDashboardDeletedSchema>
