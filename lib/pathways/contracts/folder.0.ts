import { z } from "zod"

/**
 * Flow type for Graphable folder events
 * Following PRD event model: graphable.folder.0
 */
export const FlowcoreFolder = {
  flowType: "graphable.folder.0",
  eventType: {
    created: "folder.created.0",
    updated: "folder.updated.0",
    deleted: "folder.deleted.0",
  },
} as const

/**
 * Event schema for folder.created.0
 * Emitted when a folder fragment is created
 */
export const EventFolderCreatedSchema = z.object({
  folderId: z.string().uuid("Invalid folder ID format"),
  fragmentId: z.string().uuid("Invalid fragment ID format"),
  workspaceId: z.string().uuid("Invalid workspace ID format"),
  name: z.string().min(1, "Folder name is required"),
  parentFolderId: z.string().uuid("Invalid parent folder ID format").optional(),
  occurredAt: z.string().datetime(),
  initiatedBy: z.string().min(1, "Initiated by is required"),
  requestId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
})

/**
 * Event schema for folder.updated.0
 * Emitted when a folder fragment is updated
 */
export const EventFolderUpdatedSchema = z.object({
  folderId: z.string().uuid("Invalid folder ID format"),
  fragmentId: z.string().uuid("Invalid fragment ID format"),
  workspaceId: z.string().uuid("Invalid workspace ID format"),
  name: z.string().min(1, "Folder name is required").optional(),
  parentFolderId: z.string().uuid("Invalid parent folder ID format").optional(),
  occurredAt: z.string().datetime(),
  initiatedBy: z.string().min(1, "Initiated by is required"),
  requestId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
})

/**
 * Event schema for folder.deleted.0
 * Emitted when a folder fragment is deleted
 */
export const EventFolderDeletedSchema = z.object({
  folderId: z.string().uuid("Invalid folder ID format"),
  fragmentId: z.string().uuid("Invalid fragment ID format"),
  workspaceId: z.string().uuid("Invalid workspace ID format"),
  occurredAt: z.string().datetime(),
  initiatedBy: z.string().min(1, "Initiated by is required"),
  requestId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
})

// Type exports
export type EventFolderCreated = z.infer<typeof EventFolderCreatedSchema>
export type EventFolderUpdated = z.infer<typeof EventFolderUpdatedSchema>
export type EventFolderDeleted = z.infer<typeof EventFolderDeletedSchema>
