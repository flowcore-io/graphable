/**
 * SQL query validation service
 * Provides security validation to prevent SQL injection attacks
 */

/**
 * Maximum allowed query length (characters)
 * Prevents extremely long queries that could be used for DoS attacks
 */
const MAX_QUERY_LENGTH = 10000

/**
 * Dangerous SQL keywords that should be blocked
 * These keywords allow data modification or schema changes
 */
const DANGEROUS_KEYWORDS = [
  "DROP",
  "DELETE",
  "INSERT",
  "UPDATE",
  "ALTER",
  "CREATE",
  "TRUNCATE",
  "EXEC",
  "EXECUTE",
  "GRANT",
  "REVOKE",
  "MERGE",
  "REPLACE",
] as const

/**
 * SQL validation result
 */
export interface SqlValidationResult {
  valid: boolean
  error?: string
}

/**
 * Remove SQL comments from a query string
 * Handles both single-line (--) and multi-line (/* *\/) comments
 * This is necessary to prevent hiding malicious code in comments
 */
function removeComments(query: string): string {
  let result = query
  let inString = false
  let stringChar: string | null = null
  let i = 0

  // Remove single-line comments (--)
  while (i < result.length - 1) {
    const char = result[i]
    const nextChar = result[i + 1]

    // Track string literals
    if ((char === "'" || char === '"') && (i === 0 || result[i - 1] !== "\\")) {
      if (!inString) {
        inString = true
        stringChar = char
      } else if (char === stringChar) {
        inString = false
        stringChar = null
      }
    }

    // Only process comments outside of string literals
    if (!inString && char === "-" && nextChar === "-") {
      // Find end of line
      const endOfLine = result.indexOf("\n", i)
      if (endOfLine !== -1) {
        result = result.slice(0, i) + result.slice(endOfLine)
      } else {
        result = result.slice(0, i)
        break
      }
      continue
    }

    i++
  }

  // Reset for multi-line comments
  inString = false
  stringChar = null
  i = 0

  // Remove multi-line comments (/* */)
  while (i < result.length - 1) {
    const char = result[i]
    const nextChar = result[i + 1]

    // Track string literals
    if ((char === "'" || char === '"') && (i === 0 || result[i - 1] !== "\\")) {
      if (!inString) {
        inString = true
        stringChar = char
      } else if (char === stringChar) {
        inString = false
        stringChar = null
      }
    }

    // Only process comments outside of string literals
    if (!inString && char === "/" && nextChar === "*") {
      // Find closing */
      const endComment = result.indexOf("*/", i + 2)
      if (endComment !== -1) {
        result = result.slice(0, i) + result.slice(endComment + 2)
        continue
      } else {
        // Unclosed comment - invalid query
        return result.slice(0, i)
      }
    }

    i++
  }

  return result
}

/**
 * Check if query contains multiple statements (semicolon-separated)
 * This prevents SQL injection via multiple statements like: SELECT * FROM users; DROP TABLE users;
 */
function hasMultipleStatements(query: string): boolean {
  const cleaned = removeComments(query.trim())
  let inString = false
  let stringChar: string | null = null

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i]

    // Track string literals
    if ((char === "'" || char === '"') && (i === 0 || cleaned[i - 1] !== "\\")) {
      if (!inString) {
        inString = true
        stringChar = char
      } else if (char === stringChar) {
        inString = false
        stringChar = null
      }
    }

    // Check for semicolon outside of string literals
    if (!inString && char === ";") {
      // Check if there's any non-whitespace content after the semicolon
      const remaining = cleaned.slice(i + 1).trim()
      if (remaining.length > 0) {
        return true
      }
    }
  }

  return false
}

/**
 * Check if query contains dangerous SQL keywords
 * Keywords are checked as whole words (word boundaries) to avoid false positives
 */
function containsDangerousKeywords(query: string): { found: boolean; keyword?: string } {
  const cleaned = removeComments(query)

  for (const keyword of DANGEROUS_KEYWORDS) {
    // Use word boundary regex to match whole words only (case-insensitive)
    // This prevents false positives like "SELECT" containing "ELECT"
    const regex = new RegExp(`\\b${keyword}\\b`, "i")
    if (regex.test(cleaned)) {
      return { found: true, keyword }
    }
  }

  return { found: false }
}

/**
 * Validate SQL query for security
 * Ensures query is safe to execute by checking:
 * 1. Query length (max 10,000 characters)
 * 2. Must start with SELECT
 * 3. No dangerous keywords (DROP, DELETE, etc.)
 * 4. No multiple statements
 * 5. No SQL comments (which could hide malicious code)
 *
 * @param query - SQL query string to validate
 * @returns Validation result with error message if invalid
 */
export function validateSqlQuery(query: string): SqlValidationResult {
  // Check query length
  if (query.length > MAX_QUERY_LENGTH) {
    return {
      valid: false,
      error: `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters`,
    }
  }

  // Trim and check if empty
  const trimmed = query.trim()
  if (trimmed.length === 0) {
    return {
      valid: false,
      error: "Query cannot be empty",
    }
  }

  // Check if query starts with SELECT (case-insensitive)
  // This ensures only read-only queries are allowed
  const upperTrimmed = trimmed.toUpperCase()
  if (!upperTrimmed.startsWith("SELECT")) {
    return {
      valid: false,
      error:
        "Only SELECT queries are allowed. Data modification queries (INSERT, UPDATE, DELETE, etc.) are not permitted.",
    }
  }

  // Check for dangerous keywords
  const dangerousCheck = containsDangerousKeywords(trimmed)
  if (dangerousCheck.found) {
    return {
      valid: false,
      error: `Query contains prohibited SQL keyword: ${dangerousCheck.keyword}. Only SELECT queries are allowed.`,
    }
  }

  // Check for multiple statements
  if (hasMultipleStatements(trimmed)) {
    return {
      valid: false,
      error: "Multiple SQL statements are not allowed. Only single SELECT queries are permitted.",
    }
  }

  // Additional check: ensure no remaining comments after removal
  // This catches cases where comments might hide malicious code
  const withoutComments = removeComments(trimmed)
  if (withoutComments.trim().length === 0) {
    return {
      valid: false,
      error: "Query contains only comments and no executable SQL",
    }
  }

  // Ensure the cleaned query still starts with SELECT
  if (!withoutComments.trim().toUpperCase().startsWith("SELECT")) {
    return {
      valid: false,
      error: "Query structure is invalid after removing comments",
    }
  }

  return { valid: true }
}
