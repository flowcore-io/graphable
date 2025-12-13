import {
	boolean,
	index,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

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
	}),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

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
		usableUserIdIdx: index("tenant_links_usable_user_id_idx").on(
			table.usableUserId,
		),
		workspaceIdIdx: index("tenant_links_workspace_id_idx").on(
			table.workspaceId,
		),
	}),
);

export type TenantLink = typeof tenantLinks.$inferSelect;
export type NewTenantLink = typeof tenantLinks.$inferInsert;

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
	}),
);
