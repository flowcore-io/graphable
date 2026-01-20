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
  private readonly isProduction: boolean

  constructor() {
    this.isProduction = env.NODE_ENV === "production"
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
