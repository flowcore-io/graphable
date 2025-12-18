import { db } from "@/db"
import { dashboardPermissions, parameterPermissions } from "@/db/schema"
import { randomUUID } from "crypto"
import { and, eq } from "drizzle-orm"

/**
 * Grant dashboard access to a user
 * Creates or updates dashboard permission record
 */
export async function grantDashboardAccess(
  dashboardId: string,
  userId: string,
  role: "viewer" | "admin"
): Promise<void> {
  // Check if permission already exists
  const existing = await db
    .select()
    .from(dashboardPermissions)
    .where(and(eq(dashboardPermissions.dashboardId, dashboardId), eq(dashboardPermissions.userId, userId)))
    .limit(1)

  if (existing[0]) {
    // Update existing permission
    await db
      .update(dashboardPermissions)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(and(eq(dashboardPermissions.dashboardId, dashboardId), eq(dashboardPermissions.userId, userId)))
  } else {
    // Create new permission
    await db.insert(dashboardPermissions).values({
      id: randomUUID(),
      dashboardId,
      userId,
      role,
    })
  }
}

/**
 * Revoke dashboard access for a user
 */
export async function revokeDashboardAccess(dashboardId: string, userId: string): Promise<void> {
  await db
    .delete(dashboardPermissions)
    .where(and(eq(dashboardPermissions.dashboardId, dashboardId), eq(dashboardPermissions.userId, userId)))
}

/**
 * Update parameter-level permissions for a dashboard
 */
export async function updateParameterPermissions(dashboardId: string, allowedParameters: string[]): Promise<void> {
  // Delete existing parameter permissions for this dashboard
  await db.delete(parameterPermissions).where(eq(parameterPermissions.dashboardId, dashboardId))

  // Create new parameter permissions
  if (allowedParameters.length > 0) {
    await db.insert(parameterPermissions).values(
      allowedParameters.map((paramName) => ({
        id: randomUUID(),
        dashboardId,
        parameterName: paramName,
        allowed: true,
      }))
    )
  }
}

/**
 * Check if user has access to dashboard
 * Returns role if access granted, null otherwise
 */
export async function checkDashboardAccess(dashboardId: string, userId: string): Promise<"viewer" | "admin" | null> {
  const result = await db
    .select()
    .from(dashboardPermissions)
    .where(and(eq(dashboardPermissions.dashboardId, dashboardId), eq(dashboardPermissions.userId, userId)))
    .limit(1)

  return (result[0]?.role as "viewer" | "admin") || null
}

/**
 * Check if user can modify a specific parameter on a dashboard
 * Returns true if user has admin role or parameter is in allowed list
 */
export async function checkParameterPermission(
  dashboardId: string,
  parameterName: string,
  userId: string
): Promise<boolean> {
  // Check if user is admin (admins can modify all parameters)
  const access = await checkDashboardAccess(dashboardId, userId)
  if (access === "admin") {
    return true
  }

  // Check if parameter is in allowed list for viewers
  const parameterPermission = await db
    .select()
    .from(parameterPermissions)
    .where(
      and(
        eq(parameterPermissions.dashboardId, dashboardId),
        eq(parameterPermissions.parameterName, parameterName),
        eq(parameterPermissions.allowed, true)
      )
    )
    .limit(1)

  return parameterPermission.length > 0
}

/**
 * Get all dashboard permissions for a dashboard
 */
export async function getDashboardPermissions(dashboardId: string) {
  return db.select().from(dashboardPermissions).where(eq(dashboardPermissions.dashboardId, dashboardId))
}

/**
 * Get all parameter permissions for a dashboard
 */
export async function getParameterPermissions(dashboardId: string) {
  return db.select().from(parameterPermissions).where(eq(parameterPermissions.dashboardId, dashboardId))
}






