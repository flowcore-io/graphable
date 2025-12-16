import { env } from "@/lib/env"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

// Create PostgreSQL client with connection pooling
const client = postgres(env.DATABASE_URL, {
  max: 20, // Connection pool size
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  ssl: env.NODE_ENV === "production" ? "require" : false,
  transform: postgres.camel, // snake_case to camelCase conversion
})

// Create Drizzle instance with schema
export const db = drizzle(client, { schema })

// Export schema for use in other files
export * from "./schema"



