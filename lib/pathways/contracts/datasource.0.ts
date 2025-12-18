import { z } from "zod"

/**
 * Flow type for Graphable data source events
 * Following PRD event model: graphable.datasource.0
 */
export const FlowcoreDataSource = {
  flowType: "graphable.datasource.0",
  eventType: {
    created: "datasource.created.0",
    updated: "datasource.updated.0",
    deleted: "datasource.deleted.0",
  },
} as const

/**
 * Event schema for datasource.created.0
 * Emitted when a data source fragment is created
 *
 * SECURITY: This event does NOT contain sensitive data (connection strings, passwords, etc.)
 * Secret references are stored separately in the control plane database (dataSourceSecrets table).
 * The secret reference contains only the key to fetch from Azure Key Vault:
 * { provider, vaultUrl, secretName, version }
 */
export const EventDataSourceCreatedSchema = z.object({
  dataSourceId: z.string().uuid("Invalid data source ID format"),
  fragmentId: z.string().uuid("Invalid fragment ID format"),
  workspaceId: z.string().uuid("Invalid workspace ID format"),
  occurredAt: z.string().datetime(),
  initiatedBy: z.string().min(1, "Initiated by is required"),
  requestId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
})

/**
 * Event schema for datasource.updated.0
 * Emitted when a data source fragment is updated
 *
 * SECURITY: This event does NOT contain sensitive data (connection strings, passwords, etc.)
 * Secret references are stored separately in the control plane database (dataSourceSecrets table).
 * The secret reference contains only the key to fetch from Azure Key Vault:
 * { provider, vaultUrl, secretName, version }
 */
export const EventDataSourceUpdatedSchema = z.object({
  dataSourceId: z.string().uuid("Invalid data source ID format"),
  fragmentId: z.string().uuid("Invalid fragment ID format"),
  workspaceId: z.string().uuid("Invalid workspace ID format"),
  occurredAt: z.string().datetime(),
  initiatedBy: z.string().min(1, "Initiated by is required"),
  requestId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
})

/**
 * Event schema for datasource.deleted.0
 * Emitted when a data source fragment is deleted
 *
 * SECURITY: This event does NOT contain sensitive data (connection strings, passwords, etc.)
 * Secret references are stored separately in the control plane database (dataSourceSecrets table).
 * The secret reference contains only the key to fetch from Azure Key Vault:
 * { provider, vaultUrl, secretName, version }
 */
export const EventDataSourceDeletedSchema = z.object({
  dataSourceId: z.string().uuid("Invalid data source ID format"),
  fragmentId: z.string().uuid("Invalid fragment ID format"),
  workspaceId: z.string().uuid("Invalid workspace ID format"),
  occurredAt: z.string().datetime(),
  initiatedBy: z.string().min(1, "Initiated by is required"),
  requestId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
})

// Type exports
export type EventDataSourceCreated = z.infer<typeof EventDataSourceCreatedSchema>
export type EventDataSourceUpdated = z.infer<typeof EventDataSourceUpdatedSchema>
export type EventDataSourceDeleted = z.infer<typeof EventDataSourceDeletedSchema>





