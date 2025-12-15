import { db } from "@/db"
import { type User, users } from "@/db/schema"
import { eq } from "drizzle-orm"

/**
 * Get or create a user by usableUserId.
 * Handles race conditions gracefully - if user is created between check and insert,
 * re-queries and returns the existing user.
 *
 * This is an exception to the event-driven architecture (see fragment 98494836-ac30-4024-b87b-353bf34db603).
 * Users are sourced from Usable; this local record is a compatibility shim for first-login user creation.
 */
export async function getOrCreateUser(
  usableUserId: string,
  userData: { email: string; name?: string; image?: string }
): Promise<User> {
  // Try to get existing user
  const existing = await db.select().from(users).where(eq(users.usableUserId, usableUserId)).limit(1)

  if (existing[0]) {
    return existing[0]
  }

  // Create new user (idempotent - handles race conditions)
  try {
    const [newUser] = await db
      .insert(users)
      .values({
        usableUserId,
        email: userData.email,
        name: userData.name,
        image: userData.image,
      })
      .returning()

    return newUser
  } catch (error) {
    // Handle race condition - user was created between check and insert
    // Re-query to get the existing user
    const user = await db.select().from(users).where(eq(users.usableUserId, usableUserId)).limit(1)

    if (user[0]) {
      return user[0]
    }

    // If user still doesn't exist, re-throw the error
    throw error
  }
}
