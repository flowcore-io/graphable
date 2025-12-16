import { boolean, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core"

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(), // UUID primary key
    usableUserId: varchar("usable_user_id", { length: 255 }).notNull().unique(), // Usable user ID from token
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }),
    image: varchar("image", { length: 500 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    usableUserIdIdx: index("users_usable_user_id_idx").on(table.usableUserId),
    emailIdx: index("users_email_idx").on(table.email),
  })
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export const tenantLinks = pgTable(
  "tenant_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    usableUserId: varchar("usable_user_id", { length: 255 }).notNull().unique(), // One tenant link per user
    workspaceId: uuid("workspace_id").notNull().unique(), // One user per workspace
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    usableUserIdIdx: index("tenant_links_usable_user_id_idx").on(table.usableUserId),
    workspaceIdIdx: index("tenant_links_workspace_id_idx").on(table.workspaceId),
  })
)

export type TenantLink = typeof tenantLinks.$inferSelect
export type NewTenantLink = typeof tenantLinks.$inferInsert

// Flowcore Pathways state table - prevents db:push conflicts
export const pathwayState = pgTable(
  "pathway_state",
  {
    eventId: text("event_id").primaryKey(),
    processed: boolean("processed").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    expiresAtIdx: index("pathway_state_expires_at_idx").on(table.expiresAt),
  })
)

// Cache tables removed - all data comes from Usable fragments
// Fragment IDs are used directly as resource IDs (graphId, dashboardId, folderId)

// Graph parameter definitions
// Note: graphId is now a fragment ID (no separate cache table)
export const graphParameters = pgTable(
  "graph_parameters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    graphId: uuid("graph_id").notNull(), // Fragment ID (Usable fragment ID used as graph ID)
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(), // string, number, boolean, date, timestamp, enum, string[], number[]
    required: boolean("required").notNull().default(false),
    defaultValue: text("default_value"), // JSON string for complex types
    enumValues: text("enum_values"), // JSON array for enum type
    minValue: varchar("min_value", { length: 50 }), // For number types
    maxValue: varchar("max_value", { length: 50 }), // For number types
    pattern: varchar("pattern", { length: 500 }), // Regex pattern for string types
    sourceEventId: varchar("source_event_id", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    graphIdIdx: index("graph_parameters_graph_id_idx").on(table.graphId),
    graphIdNameIdx: index("graph_parameters_graph_id_name_idx").on(table.graphId, table.name),
  })
)

export type GraphParameter = typeof graphParameters.$inferSelect
export type NewGraphParameter = typeof graphParameters.$inferInsert

// Dashboard permissions (viewer/admin access)
// Note: dashboardId is now a fragment ID (no separate cache table)
export const dashboardPermissions = pgTable(
  "dashboard_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dashboardId: uuid("dashboard_id").notNull(), // Fragment ID (Usable fragment ID used as dashboard ID)
    userId: varchar("user_id", { length: 255 }).notNull(), // Usable user ID
    role: varchar("role", { length: 50 }).notNull(), // "viewer" | "admin"
    sourceEventId: varchar("source_event_id", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    dashboardIdIdx: index("dashboard_permissions_dashboard_id_idx").on(table.dashboardId),
    userIdIdx: index("dashboard_permissions_user_id_idx").on(table.userId),
    dashboardIdUserIdIdx: index("dashboard_permissions_dashboard_id_user_id_idx").on(table.dashboardId, table.userId),
  })
)

export type DashboardPermission = typeof dashboardPermissions.$inferSelect
export type NewDashboardPermission = typeof dashboardPermissions.$inferInsert

// Parameter-level permissions for dashboards
// Note: dashboardId is now a fragment ID (no separate cache table)
export const parameterPermissions = pgTable(
  "parameter_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dashboardId: uuid("dashboard_id").notNull(), // Fragment ID (Usable fragment ID used as dashboard ID)
    parameterName: varchar("parameter_name", { length: 255 }).notNull(),
    allowed: boolean("allowed").notNull().default(true), // Whether viewers can modify this parameter
    sourceEventId: varchar("source_event_id", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    dashboardIdIdx: index("parameter_permissions_dashboard_id_idx").on(table.dashboardId),
    dashboardIdParameterNameIdx: index("parameter_permissions_dashboard_id_parameter_name_idx").on(
      table.dashboardId,
      table.parameterName
    ),
  })
)

export type ParameterPermission = typeof parameterPermissions.$inferSelect
export type NewParameterPermission = typeof parameterPermissions.$inferInsert
