/**
 * Repository-specific error classes with detailed error handling
 */

export interface ErrorDetails {
  field?: string
  value?: any
  constraint?: string
  table?: string
  code?: string
  metadata?: Record<string, any>
}

export interface ValidationErrorDetail {
  field: string
  message: string
  value?: any
  constraint?: string
}

/**
 * Base repository error class
 */
export class RepositoryError extends Error {
  public readonly name = 'RepositoryError'
  public readonly isRepositoryError = true
  public readonly timestamp: Date
  public readonly details?: ErrorDetails
  public readonly cause?: Error

  constructor(
    message: string,
    cause?: Error,
    details?: ErrorDetails
  ) {
    super(message)
    this.cause = cause
    this.details = details
    this.timestamp = new Date()
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RepositoryError)
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      timestamp: this.timestamp,
      details: this.details,
      stack: this.stack,
      cause: this.cause?.message
    }
  }
}

/**
 * Validation error for input data validation failures
 */
export class ValidationError extends RepositoryError {
  public readonly name = 'ValidationError'
  public readonly errors: ValidationErrorDetail[]

  constructor(
    message: string,
    details?: { 
      errors?: string[] | ValidationErrorDetail[]
      field?: string
      value?: any
    }
  ) {
    super(message, undefined, details)
    
    // Convert string errors to detailed format
    if (details?.errors) {
      this.errors = details.errors.map(error => {
        if (typeof error === 'string') {
          return {
            field: details.field || 'unknown',
            message: error,
            value: details.value
          }
        }
        return error
      })
    } else {
      this.errors = [{
        field: details?.field || 'unknown',
        message: message,
        value: details?.value
      }]
    }
  }

  /**
   * Get errors for a specific field
   */
  getFieldErrors(field: string): ValidationErrorDetail[] {
    return this.errors.filter(error => error.field === field)
  }

  /**
   * Check if field has errors
   */
  hasFieldError(field: string): boolean {
    return this.errors.some(error => error.field === field)
  }

  /**
   * Get all error messages as a flat array
   */
  getErrorMessages(): string[] {
    return this.errors.map(error => error.message)
  }
}

/**
 * Not found error for missing records
 */
export class NotFoundError extends RepositoryError {
  public readonly name = 'NotFoundError'
  public readonly resourceType?: string
  public readonly resourceId?: string

  constructor(
    message: string,
    resourceType?: string,
    resourceId?: string
  ) {
    super(message, undefined, { 
      table: resourceType,
      field: 'id',
      value: resourceId
    })
    this.resourceType = resourceType
    this.resourceId = resourceId
  }
}

/**
 * Conflict error for constraint violations
 */
export class ConflictError extends RepositoryError {
  public readonly name = 'ConflictError'
  public readonly constraintType?: 'unique' | 'foreign_key' | 'check' | 'not_null'
  public readonly conflictingField?: string

  constructor(
    message: string,
    constraintType?: ConflictError['constraintType'],
    field?: string,
    value?: any
  ) {
    super(message, undefined, {
      constraint: constraintType,
      field,
      value
    })
    this.constraintType = constraintType
    this.conflictingField = field
  }
}

/**
 * Connection error for database connectivity issues
 */
export class ConnectionError extends RepositoryError {
  public readonly name = 'ConnectionError'
  public readonly isRetryable: boolean
  public readonly connectionDetails?: {
    host?: string
    port?: number
    database?: string
    timeout?: number
  }

  constructor(
    message: string,
    cause?: Error,
    connectionDetails?: ConnectionError['connectionDetails'],
    isRetryable = true
  ) {
    super(message, cause, { metadata: connectionDetails })
    this.isRetryable = isRetryable
    this.connectionDetails = connectionDetails
  }
}

/**
 * Transaction error for transaction-related failures
 */
export class TransactionError extends RepositoryError {
  public readonly name = 'TransactionError'
  public readonly transactionId?: string
  public readonly operation?: string
  public readonly rollbackSuccessful?: boolean

  constructor(
    message: string,
    cause?: Error,
    details?: {
      transactionId?: string
      operation?: string
      rollbackSuccessful?: boolean
    }
  ) {
    super(message, cause, { metadata: details })
    this.transactionId = details?.transactionId
    this.operation = details?.operation
    this.rollbackSuccessful = details?.rollbackSuccessful
  }
}

/**
 * Query timeout error
 */
export class QueryTimeoutError extends RepositoryError {
  public readonly name = 'QueryTimeoutError'
  public readonly timeoutMs: number
  public readonly query?: string

  constructor(
    message: string,
    timeoutMs: number,
    query?: string
  ) {
    super(message, undefined, {
      metadata: { timeoutMs, query }
    })
    this.timeoutMs = timeoutMs
    this.query = query
  }
}

/**
 * Cache error for caching-related failures
 */
export class CacheError extends RepositoryError {
  public readonly name = 'CacheError'
  public readonly operation?: 'get' | 'set' | 'delete' | 'clear'
  public readonly key?: string

  constructor(
    message: string,
    cause?: Error,
    operation?: CacheError['operation'],
    key?: string
  ) {
    super(message, cause, {
      metadata: { operation, key }
    })
    this.operation = operation
    this.key = key
  }
}

/**
 * Rate limit error for when operations are rate limited
 */
export class RateLimitError extends RepositoryError {
  public readonly name = 'RateLimitError'
  public readonly limit: number
  public readonly remaining: number
  public readonly resetTime: Date

  constructor(
    message: string,
    limit: number,
    remaining: number,
    resetTime: Date
  ) {
    super(message, undefined, {
      metadata: { limit, remaining, resetTime }
    })
    this.limit = limit
    this.remaining = remaining
    this.resetTime = resetTime
  }
}

/**
 * Data integrity error for data consistency issues
 */
export class DataIntegrityError extends RepositoryError {
  public readonly name = 'DataIntegrityError'
  public readonly integrityType?: 'referential' | 'domain' | 'entity' | 'user_defined'
  public readonly affectedRecords?: string[]

  constructor(
    message: string,
    integrityType?: DataIntegrityError['integrityType'],
    affectedRecords?: string[]
  ) {
    super(message, undefined, {
      metadata: { integrityType, affectedRecords }
    })
    this.integrityType = integrityType
    this.affectedRecords = affectedRecords
  }
}

/**
 * Permission error for authorization failures
 */
export class PermissionError extends RepositoryError {
  public readonly name = 'PermissionError'
  public readonly requiredPermission?: string
  public readonly resourceType?: string
  public readonly resourceId?: string
  public readonly userId?: string

  constructor(
    message: string,
    details?: {
      requiredPermission?: string
      resourceType?: string
      resourceId?: string
      userId?: string
    }
  ) {
    super(message, undefined, { metadata: details })
    this.requiredPermission = details?.requiredPermission
    this.resourceType = details?.resourceType
    this.resourceId = details?.resourceId
    this.userId = details?.userId
  }
}

/**
 * Bulk operation error for batch operation failures
 */
export class BulkOperationError extends RepositoryError {
  public readonly name = 'BulkOperationError'
  public readonly totalItems: number
  public readonly successfulItems: number
  public readonly failedItems: Array<{
    index: number
    item: any
    error: string
  }>

  constructor(
    message: string,
    totalItems: number,
    successfulItems: number,
    failedItems: BulkOperationError['failedItems']
  ) {
    super(message, undefined, {
      metadata: { totalItems, successfulItems, failedItems }
    })
    this.totalItems = totalItems
    this.successfulItems = successfulItems
    this.failedItems = failedItems
  }

  /**
   * Get success rate as percentage
   */
  getSuccessRate(): number {
    return (this.successfulItems / this.totalItems) * 100
  }

  /**
   * Get failed item indices
   */
  getFailedIndices(): number[] {
    return this.failedItems.map(item => item.index)
  }
}

/**
 * Error factory for creating appropriate error types from database errors
 */
export class ErrorFactory {
  
  /**
   * Create error from Prisma error
   */
  static fromPrismaError(error: any, operation: string = 'unknown'): RepositoryError {
    const message = error.message || 'Unknown database error'
    
    // Prisma error codes
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        return new ConflictError(
          'Unique constraint violation',
          'unique',
          error.meta?.target?.[0] || 'unknown',
          error.meta?.value
        )
      
      case 'P2003': // Foreign key constraint violation
        return new ConflictError(
          'Foreign key constraint violation',
          'foreign_key',
          error.meta?.field_name
        )
      
      case 'P2025': // Record not found
        return new NotFoundError(
          'Record not found',
          error.meta?.modelName,
          error.meta?.id
        )
      
      case 'P2024': // Timed out fetching a new connection
      case 'P2034': // Transaction failed due to a write conflict
        return new ConnectionError(
          'Database connection error',
          error,
          undefined,
          true
        )
      
      case 'P2037': // Too many database connections opened
        return new ConnectionError(
          'Too many database connections',
          error,
          undefined,
          false
        )
      
      case 'P2011': // Null constraint violation
        return new ValidationError(
          'Required field missing',
          {
            field: error.meta?.column || 'unknown',
            errors: ['This field is required']
          }
        )
      
      case 'P2006': // Invalid value provided
      case 'P2007': // Data validation error
        return new ValidationError(
          'Invalid data provided',
          {
            field: error.meta?.field_name || 'unknown',
            errors: [message]
          }
        )
      
      default:
        // Check error message for common patterns
        if (message.includes('timeout') || message.includes('timed out')) {
          return new QueryTimeoutError(
            'Query timeout',
            parseInt(error.meta?.timeout || '30000')
          )
        }
        
        if (message.includes('connection') || message.includes('connect')) {
          return new ConnectionError(
            'Database connection failed',
            error
          )
        }
        
        return new RepositoryError(
          `Database error in ${operation}: ${message}`,
          error,
          { 
            code: error.code,
            metadata: error.meta
          }
        )
    }
  }

  /**
   * Create validation error from validation results
   */
  static fromValidationErrors(
    errors: Array<{ field: string; message: string; value?: any }>
  ): ValidationError {
    return new ValidationError(
      `Validation failed for ${errors.length} field(s)`,
      { errors }
    )
  }

  /**
   * Create bulk operation error from results
   */
  static fromBulkOperationResults(
    operation: string,
    totalItems: number,
    results: Array<{ success: boolean; item?: any; error?: string; index: number }>
  ): BulkOperationError {
    const successful = results.filter(r => r.success)
    const failed = results
      .filter(r => !r.success)
      .map(r => ({
        index: r.index,
        item: r.item,
        error: r.error || 'Unknown error'
      }))

    return new BulkOperationError(
      `Bulk ${operation} completed with ${failed.length} failures`,
      totalItems,
      successful.length,
      failed
    )
  }
}

/**
 * Error matcher utility for handling different error types
 */
export class ErrorMatcher {
  
  /**
   * Check if error is retryable
   */
  static isRetryable(error: Error): boolean {
    if (error instanceof ConnectionError) {
      return error.isRetryable
    }
    
    if (error instanceof QueryTimeoutError) {
      return true
    }
    
    // Check for specific error messages that indicate retryable conditions
    const retryablePatterns = [
      /connection.*reset/i,
      /connection.*lost/i,
      /server.*gone.*away/i,
      /timeout/i,
      /too.*many.*connections/i
    ]
    
    return retryablePatterns.some(pattern => pattern.test(error.message))
  }

  /**
   * Check if error is a validation error
   */
  static isValidationError(error: Error): error is ValidationError {
    return error instanceof ValidationError
  }

  /**
   * Check if error is a not found error
   */
  static isNotFoundError(error: Error): error is NotFoundError {
    return error instanceof NotFoundError
  }

  /**
   * Check if error is a conflict error
   */
  static isConflictError(error: Error): error is ConflictError {
    return error instanceof ConflictError
  }

  /**
   * Get appropriate HTTP status code for error
   */
  static getHttpStatusCode(error: Error): number {
    if (error instanceof ValidationError) return 400
    if (error instanceof NotFoundError) return 404
    if (error instanceof ConflictError) return 409
    if (error instanceof PermissionError) return 403
    if (error instanceof RateLimitError) return 429
    if (error instanceof ConnectionError) return 503
    if (error instanceof QueryTimeoutError) return 504
    
    return 500 // Internal server error
  }

  /**
   * Extract user-friendly message from error
   */
  static getUserFriendlyMessage(error: Error): string {
    if (error instanceof ValidationError) {
      return `Invalid input: ${error.getErrorMessages().join(', ')}`
    }
    
    if (error instanceof NotFoundError) {
      return `${error.resourceType || 'Resource'} not found`
    }
    
    if (error instanceof ConflictError) {
      if (error.constraintType === 'unique') {
        return `${error.conflictingField || 'Field'} already exists`
      }
      return 'Data conflict occurred'
    }
    
    if (error instanceof PermissionError) {
      return 'You do not have permission to perform this action'
    }
    
    if (error instanceof RateLimitError) {
      return 'Too many requests. Please try again later'
    }
    
    if (error instanceof ConnectionError) {
      return 'Service temporarily unavailable'
    }
    
    if (error instanceof QueryTimeoutError) {
      return 'Operation timed out. Please try again'
    }
    
    return 'An unexpected error occurred'
  }
}