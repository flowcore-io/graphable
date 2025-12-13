import {
	pgTable,
	varchar,
	timestamp,
	uuid,
	index,
} from "drizzle-orm/pg-core";

export const users = pgTable(
	"users",
	{
		id: uuid("id").primaryKey().defaultRandom(), // UUID primary key
		usableUserId: varchar("usable_user_id", { length: 255 })
			.notNull()
			.unique(), // Usable user ID from token
		email: varchar("email", { length: 255 }).notNull(),
		name: varchar("name", { length: 255 }),
		image: varchar("image", { length: 500 }),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => ({
		usableUserIdIdx: index("users_usable_user_id_idx").on(
			table.usableUserId,
		),
		emailIdx: index("users_email_idx").on(table.email),
	}),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
