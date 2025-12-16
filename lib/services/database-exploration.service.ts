/**
 * Database exploration service for admin-only database exploration
 * Provides functionality to list tables, describe table schemas, and sample rows
 */

/**
 * Table information
 */
export interface TableInfo {
  name: string
  schema?: string
  type?: string
}

/**
 * Column information
 */
export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  default?: unknown
}

/**
 * Table schema information
 */
export interface TableSchema {
  tableName: string
  schema?: string
  columns: ColumnInfo[]
}

/**
 * List tables in a data source (admin-only)
 * TODO: Implement actual database connection and query
 * For MVP, returns mock data
 */
export async function listTables(dataSourceRef: string, accessToken: string): Promise<TableInfo[]> {
  // TODO: Check workspace admin role before allowing exploration
  // TODO: Connect to data source and query information_schema or pg_tables
  // TODO: Enforce read-only credentials and query guardrails

  // Mock implementation for MVP
  return []
}

/**
 * Get table schema (admin-only)
 * TODO: Implement actual database connection and query
 * For MVP, returns mock data
 */
export async function describeTable(
  dataSourceRef: string,
  tableName: string,
  accessToken: string
): Promise<TableSchema> {
  // TODO: Check workspace admin role before allowing exploration
  // TODO: Connect to data source and query column information
  // TODO: Enforce read-only credentials and query guardrails

  // Mock implementation for MVP
  return {
    tableName,
    columns: [],
  }
}

/**
 * Sample rows from a table (admin-only)
 * TODO: Implement actual database connection and query
 * For MVP, returns mock data
 */
export async function sampleRows(
  dataSourceRef: string,
  tableName: string,
  limit: number = 10,
  accessToken: string
): Promise<unknown[]> {
  // TODO: Check workspace admin role before allowing exploration
  // TODO: Connect to data source and execute SELECT query with LIMIT
  // TODO: Enforce read-only credentials, row limits, and query guardrails
  // TODO: Validate limit parameter (max 100 rows per plan)

  // Mock implementation for MVP
  return []
}

/**
 * Check if user is workspace admin
 * TODO: Implement actual admin role check via Usable API or database
 */
export async function isWorkspaceAdmin(workspaceId: string, userId: string, accessToken: string): Promise<boolean> {
  // TODO: Check user role in workspace via Usable API
  // For MVP, return false (no admin access by default)
  return false
}

