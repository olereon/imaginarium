/**
 * Logger utility with Winston for structured logging
 */

import winston, { Logger, format } from 'winston'
import path from 'path'

const { combine, timestamp, errors, json, printf, colorize, label } = format

// Log levels
export const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
} as const

export type LogLevel = keyof typeof LOG_LEVELS

// Custom format for console output
const consoleFormat = printf(({ level, message, label, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${label}] ${level}: ${message}`
  
  if (Object.keys(metadata).length > 0) {
    msg += `\n${JSON.stringify(metadata, null, 2)}`
  }
  
  return msg
})

// Custom format for file output
const fileFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
)

// Create transports based on environment
function createTransports(loggerLabel: string): winston.transport[] {
  const transports: winston.transport[] = []
  
  // Console transport
  transports.push(
    new winston.transports.Console({
      format: combine(
        colorize(),
        label({ label: loggerLabel }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleFormat
      ),
      level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
    })
  )
  
  // File transports for production
  if (process.env.NODE_ENV === 'production') {
    const logDir = process.env.LOG_DIR || './logs'
    
    // Error log file
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        format: combine(
          label({ label: loggerLabel }),
          fileFormat
        ),
        maxsize: 5242880, // 5MB
        maxFiles: 10
      })
    )
    
    // Combined log file
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        format: combine(
          label({ label: loggerLabel }),
          fileFormat
        ),
        maxsize: 5242880, // 5MB
        maxFiles: 10
      })
    )
  }
  
  return transports
}

// Cache for loggers to avoid creating duplicates
const loggerCache = new Map<string, Logger>()

/**
 * Create or get cached logger instance
 */
export function createLogger(name: string): Logger {
  if (loggerCache.has(name)) {
    return loggerCache.get(name)!
  }
  
  const logger = winston.createLogger({
    levels: LOG_LEVELS,
    defaultMeta: { service: name },
    transports: createTransports(name),
    // Handle uncaught exceptions and rejections
    exceptionHandlers: process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({
        filename: path.join(process.env.LOG_DIR || './logs', 'exceptions.log')
      })
    ] : undefined,
    rejectionHandlers: process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({
        filename: path.join(process.env.LOG_DIR || './logs', 'rejections.log')
      })
    ] : undefined
  })
  
  loggerCache.set(name, logger)
  return logger
}

/**
 * Default application logger
 */
export const appLogger = createLogger('App')

/**
 * Logger for database operations
 */
export const dbLogger = createLogger('Database')

/**
 * Logger for cache operations
 */
export const cacheLogger = createLogger('Cache')

/**
 * Logger for HTTP requests
 */
export const httpLogger = createLogger('HTTP')

/**
 * Performance logger for metrics
 */
export const perfLogger = createLogger('Performance')

/**
 * Security logger for security events
 */
export const securityLogger = createLogger('Security')

/**
 * Structured logging helper
 */
export class StructuredLogger {
  private logger: Logger
  
  constructor(name: string) {
    this.logger = createLogger(name)
  }
  
  /**
   * Log with structured metadata
   */
  log(level: LogLevel, message: string, metadata: Record<string, any> = {}): void {
    this.logger.log(level, message, {
      ...metadata,
      timestamp: new Date().toISOString()
    })
  }
  
  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, metadata: Record<string, any> = {}): void {
    this.logger.info(`Performance: ${operation}`, {
      operation,
      duration,
      durationMs: `${duration}ms`,
      ...metadata
    })
  }
  
  /**
   * Log database query
   */
  query(sql: string, params: any[], duration: number, rowCount?: number): void {
    this.logger.debug('Database Query', {
      sql: sql.length > 1000 ? sql.substring(0, 1000) + '...' : sql,
      params: params.length > 0 ? params : undefined,
      duration,
      rowCount,
      type: 'query'
    })
  }
  
  /**
   * Log cache operation
   */
  cache(operation: 'hit' | 'miss' | 'set' | 'delete', key: string, ttl?: number): void {
    this.logger.debug(`Cache ${operation}`, {
      operation,
      key: key.length > 100 ? key.substring(0, 100) + '...' : key,
      ttl,
      type: 'cache'
    })
  }
  
  /**
   * Log security event
   */
  security(event: string, userId?: string, metadata: Record<string, any> = {}): void {
    securityLogger.warn(`Security Event: ${event}`, {
      event,
      userId,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      timestamp: new Date().toISOString(),
      ...metadata
    })
  }
  
  /**
   * Log error with full context
   */
  error(message: string, error: Error, context: Record<string, any> = {}): void {
    this.logger.error(message, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      timestamp: new Date().toISOString()
    })
  }
  
  /**
   * Log HTTP request
   */
  http(method: string, url: string, statusCode: number, duration: number, metadata: Record<string, any> = {}): void {
    const level = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info'
    
    httpLogger.log(level, `${method} ${url} ${statusCode}`, {
      method,
      url,
      statusCode,
      duration,
      ...metadata
    })
  }
  
  /**
   * Log user action for audit trail
   */
  audit(action: string, userId: string, resourceType: string, resourceId: string, changes?: Record<string, any>): void {
    this.logger.info(`Audit: ${action}`, {
      action,
      userId,
      resourceType,
      resourceId,
      changes,
      timestamp: new Date().toISOString(),
      type: 'audit'
    })
  }
}

/**
 * Express middleware for request logging
 */
export function requestLoggingMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now()
    const originalSend = res.send
    
    res.send = function(data: any) {
      const duration = Date.now() - start
      
      httpLogger.http(`${req.method} ${req.originalUrl}`, {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id,
        responseSize: data ? Buffer.byteLength(data, 'utf8') : 0
      })
      
      return originalSend.call(this, data)
    }
    
    next()
  }
}

/**
 * Log application startup
 */
export function logAppStart(version: string, environment: string, port: number): void {
  appLogger.info('Application starting', {
    version,
    environment,
    port,
    nodeVersion: process.version,
    pid: process.pid,
    timestamp: new Date().toISOString()
  })
}

/**
 * Log application shutdown
 */
export function logAppShutdown(reason: string): void {
  appLogger.info('Application shutting down', {
    reason,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  })
}

/**
 * Create child logger with additional context
 */
export function createChildLogger(parentLogger: Logger, context: Record<string, any>): Logger {
  return parentLogger.child(context)
}

export default createLogger