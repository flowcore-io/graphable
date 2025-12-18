import { z } from "zod"

/**
 * Flow type for Graphable graph events
 * Following PRD event model: graphable.graph.0
 */
export const FlowcoreGraph = {
  flowType: "graphable.graph.0",
  eventType: {
    created: "graph.created.0",
    updated: "graph.updated.0",
    deleted: "graph.deleted.0",
  },
} as const

/**
 * Event schema for graph.created.0
 * Emitted when a graph fragment is created
 */
export const EventGraphCreatedSchema = z.object({
  graphId: z.string().uuid("Invalid graph ID format"),
  fragmentId: z.string().uuid("Invalid fragment ID format"),
  workspaceId: z.string().uuid("Invalid workspace ID format"),
  dataSourceRef: z.string().min(1, "Data source reference is required"),
  connectorRef: z.string().optional(),
  occurredAt: z.string().datetime(),
  initiatedBy: z.string().min(1, "Initiated by is required"),
  requestId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
})

/**
 * Event schema for graph.updated.0
 * Emitted when a graph fragment is updated
 */
export const EventGraphUpdatedSchema = z.object({
  graphId: z.string().uuid("Invalid graph ID format"),
  fragmentId: z.string().uuid("Invalid fragment ID format"),
  workspaceId: z.string().uuid("Invalid workspace ID format"),
  dataSourceRef: z.string().min(1, "Data source reference is required"),
  connectorRef: z.string().optional(),
  occurredAt: z.string().datetime(),
  initiatedBy: z.string().min(1, "Initiated by is required"),
  requestId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
})

/**
 * Event schema for graph.deleted.0
 * Emitted when a graph fragment is deleted
 */
export const EventGraphDeletedSchema = z.object({
  graphId: z.string().uuid("Invalid graph ID format"),
  fragmentId: z.string().uuid("Invalid fragment ID format"),
  workspaceId: z.string().uuid("Invalid workspace ID format"),
  occurredAt: z.string().datetime(),
  initiatedBy: z.string().min(1, "Initiated by is required"),
  requestId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
})

// Type exports
export type EventGraphCreated = z.infer<typeof EventGraphCreatedSchema>
export type EventGraphUpdated = z.infer<typeof EventGraphUpdatedSchema>
export type EventGraphDeleted = z.infer<typeof EventGraphDeletedSchema>






