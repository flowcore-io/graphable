import { env } from "@/lib/env"

/**
 * Log levels supported by the logger
 */
export type LogLevel = "error" | "warn" | "info" | "debug"

/**
 * Context object for structured logging
 */
export interface LogContext {
  [key: string]: unknown
}

/**
 * Error context with standard error fields
 */
export interface ErrorContext extends LogContext {
  error?: string
  stack?: string
  [key: string]: unknown
}

/**
 * Structured logger service for server-side logging
 *
 * Provides environment-aware logging:
 * - Development: Human-readable format with colors
 * - Production: JSON-structured format for log aggregation systems
 *
 * This service wraps console methods in a structured, configurable way
 * that can be easily replaced with a proper logging library (like pino or winston) later.
 */
class LoggerService {
  private readonly isDevelopment: boolean
  private readonly isProduction: boolean

  constructor() {
    this.isDevelopment = env.NODE_ENV === "development"
    this.isProduction = env.NODE_ENV === "production"
  }

  /**
   * Helper to format an Error object into a standard error context
   * This extracts the error message and stack trace safely
   */
  private formatError(error: unknown): ErrorContext {
    if (error instanceof Error) {
      return {
        error: error.message,
        stack: error.stack,
      }
    }
    return {
      error: String(error),
    }
  }

  /**
   * Log an error with automatic Error object formatting
   * @param message - Human-readable error message
   * @param errorOrContext - Either an Error object, or a context object with additional fields
   */
  errorWithException(message: string, errorOrContext: unknown | LogContext): void {
    // If it's an Error object, format it
    if (errorOrContext instanceof Error) {
      this.log("error", message, this.formatError(errorOrContext))
      return
    }

    // If it's a context object that contains an error field
    if (errorOrContext && typeof errorOrContext === "object" && "error" in errorOrContext) {
      const ctx = errorOrContext as LogContext
      const error = ctx.error

      // If the error field is an Error object, format it
      if (error instanceof Error) {
        this.log("error", message, {
          ...ctx,
          ...this.formatError(error),
        })
        return
      }
    }

    // Otherwise, treat as regular context
    this.log("error", message, errorOrContext as LogContext)
  }

  /**
   * Log an error message with optional context
   */
  error(message: string, context?: LogContext): void {
    this.log("error", message, context)
  }

  /**
   * Log a warning message with optional context
   */
  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context)
  }

  /**
   * Log an info message with optional context
   */
  info(message: string, context?: LogContext): void {
    this.log("info", message, context)
  }

  /**
   * Log a debug message with optional context
   */
  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context)
  }

  /**
   * Internal logging method that formats and outputs logs based on environment
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString()

    if (this.isProduction) {
      // Production: JSON-structured format for log aggregation
      const logEntry = {
        timestamp,
        level,
        message,
        ...(context && { context }),
      }
      const jsonLog = JSON.stringify(logEntry)

      // Use appropriate console method based on level
      switch (level) {
        case "error":
          console.error(jsonLog)
          break
        case "warn":
          console.warn(jsonLog)
          break
        case "info":
          console.info(jsonLog)
          break
        case "debug":
          console.debug(jsonLog)
          break
      }
    } else {
      // Development: Human-readable format
      const levelLabel = `[${level.toUpperCase()}]`
      const timeLabel = `[${timestamp}]`

      if (context) {
        // Format context object nicely for development
        const contextStr = JSON.stringify(context, null, 2)
        switch (level) {
          case "error":
            console.error(`${timeLabel} ${levelLabel} ${message}`, contextStr)
            break
          case "warn":
            console.warn(`${timeLabel} ${levelLabel} ${message}`, contextStr)
            break
          case "info":
            console.info(`${timeLabel} ${levelLabel} ${message}`, contextStr)
            break
          case "debug":
            console.debug(`${timeLabel} ${levelLabel} ${message}`, contextStr)
            break
        }
      } else {
        // No context, just message
        switch (level) {
          case "error":
            console.error(`${timeLabel} ${levelLabel} ${message}`)
            break
          case "warn":
            console.warn(`${timeLabel} ${levelLabel} ${message}`)
            break
          case "info":
            console.info(`${timeLabel} ${levelLabel} ${message}`)
            break
          case "debug":
            console.debug(`${timeLabel} ${levelLabel} ${message}`)
            break
        }
      }
    }
  }
}

// Export singleton instance
export const logger = new LoggerService()
