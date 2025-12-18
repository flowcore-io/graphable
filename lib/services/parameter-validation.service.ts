import type { ParameterDefinition } from "./graph.service"

/**
 * Validate parameters against parameter schema
 */
export function validateParameters(
  parameterSchema: { parameters: ParameterDefinition[] },
  providedParameters: Record<string, unknown>
): { valid: boolean; errors?: Array<{ parameter: string; error: string }> } {
  const errors: Array<{ parameter: string; error: string }> = []

  // Check required parameters
  for (const paramDef of parameterSchema.parameters) {
    const providedValue = providedParameters[paramDef.name]

    // Check if required parameter is missing
    if (paramDef.required && (providedValue === undefined || providedValue === null)) {
      errors.push({
        parameter: paramDef.name,
        error: `Required parameter '${paramDef.name}' is missing`,
      })
      continue
    }

    // Skip validation if parameter is optional and not provided
    if (!paramDef.required && (providedValue === undefined || providedValue === null)) {
      continue
    }

    // Validate parameter type
    const typeError = validateParameterType(paramDef, providedValue)
    if (typeError) {
      errors.push({
        parameter: paramDef.name,
        error: typeError,
      })
      continue
    }

    // Validate constraints
    const constraintError = validateParameterConstraints(paramDef, providedValue)
    if (constraintError) {
      errors.push({
        parameter: paramDef.name,
        error: constraintError,
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Validate parameter type
 */
function validateParameterType(paramDef: ParameterDefinition, value: unknown): string | null {
  switch (paramDef.type) {
    case "string":
      if (typeof value !== "string") {
        return `Parameter '${paramDef.name}' must be a string`
      }
      break

    case "number":
      if (typeof value !== "number" || Number.isNaN(value)) {
        return `Parameter '${paramDef.name}' must be a number`
      }
      break

    case "boolean":
      if (typeof value !== "boolean") {
        return `Parameter '${paramDef.name}' must be a boolean`
      }
      break

    case "date":
    case "timestamp":
      // Accept ISO string or Date object
      if (typeof value !== "string" && !(value instanceof Date)) {
        return `Parameter '${paramDef.name}' must be a date or ISO timestamp string`
      }
      // Validate ISO string format if string
      if (typeof value === "string") {
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) {
          return `Parameter '${paramDef.name}' must be a valid ISO date string`
        }
      }
      break

    case "enum":
      if (typeof value !== "string") {
        return `Parameter '${paramDef.name}' must be a string`
      }
      if (paramDef.enumValues && !paramDef.enumValues.includes(value)) {
        return `Parameter '${paramDef.name}' must be one of: ${paramDef.enumValues.join(", ")}`
      }
      break

    case "string[]":
      if (!Array.isArray(value)) {
        return `Parameter '${paramDef.name}' must be an array of strings`
      }
      if (!value.every((item) => typeof item === "string")) {
        return `Parameter '${paramDef.name}' must be an array of strings`
      }
      break

    case "number[]":
      if (!Array.isArray(value)) {
        return `Parameter '${paramDef.name}' must be an array of numbers`
      }
      if (!value.every((item) => typeof item === "number" && !Number.isNaN(item))) {
        return `Parameter '${paramDef.name}' must be an array of numbers`
      }
      break

    default:
      return `Unknown parameter type: ${paramDef.type}`
  }

  return null
}

/**
 * Validate parameter constraints (min, max, pattern)
 */
function validateParameterConstraints(paramDef: ParameterDefinition, value: unknown): string | null {
  // Validate min/max for numbers
  if (paramDef.type === "number" && typeof value === "number") {
    if (paramDef.min !== undefined && value < paramDef.min) {
      return `Parameter '${paramDef.name}' must be >= ${paramDef.min}`
    }
    if (paramDef.max !== undefined && value > paramDef.max) {
      return `Parameter '${paramDef.name}' must be <= ${paramDef.max}`
    }
  }

  // Validate pattern for strings
  if (paramDef.type === "string" && typeof value === "string" && paramDef.pattern) {
    const regex = new RegExp(paramDef.pattern)
    if (!regex.test(value)) {
      return `Parameter '${paramDef.name}' does not match required pattern`
    }
  }

  // Validate array length constraints (if needed)
  if ((paramDef.type === "string[]" || paramDef.type === "number[]") && Array.isArray(value)) {
    if (paramDef.min !== undefined && value.length < paramDef.min) {
      return `Parameter '${paramDef.name}' must have at least ${paramDef.min} items`
    }
    if (paramDef.max !== undefined && value.length > paramDef.max) {
      return `Parameter '${paramDef.name}' must have at most ${paramDef.max} items`
    }
  }

  return null
}

/**
 * Bind parameters to SQL query safely (no string interpolation)
 * Returns parameterized query with parameter values
 */
export function bindParametersToQuery(
  queryText: string,
  parameters: ParameterDefinition[],
  providedParameters: Record<string, unknown>
): { query: string; parameterValues: unknown[] } {
  const parameterValues: unknown[] = []
  let boundQuery = queryText

  // Replace parameter placeholders (e.g., $1, $2, :paramName) with actual values
  // For safety, we'll use numbered parameters ($1, $2, etc.)
  let paramIndex = 1

  for (const paramDef of parameters) {
    const providedValue = providedParameters[paramDef.name]

    // Use default value if not provided
    const value = providedValue !== undefined && providedValue !== null ? providedValue : paramDef.default

    // Skip "All" values - treat as null/undefined to skip the filter
    if (value === "All" || value === "all") {
      continue
    }

    if (value === undefined || value === null) {
      continue // Skip if no value and no default
    }

    // Convert value to appropriate format for SQL
    let sqlValue: unknown = value

    // Handle date/timestamp conversion
    if (paramDef.type === "date" || paramDef.type === "timestamp") {
      if (typeof value === "string") {
        sqlValue = new Date(value).toISOString()
      } else if (value instanceof Date) {
        sqlValue = value.toISOString()
      }
    }

    // Handle array types
    if (paramDef.type === "string[]" || paramDef.type === "number[]") {
      if (Array.isArray(value)) {
        sqlValue = value
      }
    }

    // Replace parameter placeholders in query
    // Support both $1, $2 style and :paramName style
    const placeholder1 = `$${paramIndex}`
    const placeholder2 = `:${paramDef.name}`

    // Replace :paramName style first (more specific)
    boundQuery = boundQuery.replace(new RegExp(`:${paramDef.name}\\b`, "g"), placeholder1)

    parameterValues.push(sqlValue)
    paramIndex++
  }

  // Replace remaining $N placeholders if query already uses them
  // This handles queries that already have $1, $2 placeholders
  const finalParamIndex = 1
  const finalParameterValues: unknown[] = []

  // Extract parameter values in order of appearance
  for (const paramDef of parameters) {
    const providedValue = providedParameters[paramDef.name]
    const value = providedValue !== undefined && providedValue !== null ? providedValue : paramDef.default

    // Skip "All" values - treat as null/undefined to skip the filter
    if (value === "All" || value === "all") {
      continue
    }

    if (value === undefined || value === null) {
      continue
    }

    let sqlValue: unknown = value

    if (paramDef.type === "date" || paramDef.type === "timestamp") {
      if (typeof value === "string") {
        sqlValue = new Date(value).toISOString()
      } else if (value instanceof Date) {
        sqlValue = value.toISOString()
      }
    }

    if (paramDef.type === "string[]" || paramDef.type === "number[]") {
      if (Array.isArray(value)) {
        sqlValue = value
      }
    }

    finalParameterValues.push(sqlValue)
  }

  return {
    query: boundQuery,
    parameterValues: finalParameterValues.length > 0 ? finalParameterValues : parameterValues,
  }
}






