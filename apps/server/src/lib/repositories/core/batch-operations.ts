/**
 * Batch operations utility for efficient bulk database operations
 */

import { EventEmitter } from 'events'
import { Logger } from 'winston'
import { createLogger } from '../../utils/logger.js'
import type { TransactionContext, BulkOperationResult } from '../interfaces/index.js'
import { BulkOperationError, ErrorFactory } from './errors.js'
import { DatabaseManager } from './database-manager.js'

export interface BatchConfig {
  batchSize: number
  maxConcurrency: number
  retryAttempts: number
  retryDelay: number
  progressReporting: boolean
  failOnFirstError: boolean
  validateBeforeProcess: boolean
}

export interface BatchProgress {
  total: number
  processed: number
  successful: number
  failed: number
  percentage: number
  errors: Array<{ index: number; error: string }>
}

export interface BatchOperation<T, R> {
  id: string
  data: T[]
  operation: (item: T, index: number) => Promise<R>
  validation?: (item: T, index: number) => Promise<boolean>
  onProgress?: (progress: BatchProgress) => void
  onError?: (error: Error, item: T, index: number) => void
  onSuccess?: (result: R, item: T, index: number) => void
}

export class BatchOperationManager extends EventEmitter {
  private logger: Logger
  private dbManager: DatabaseManager
  private activeBatches: Map<string, BatchOperation<any, any>> = new Map()
  private defaultConfig: BatchConfig = {
    batchSize: 100,
    maxConcurrency: 5,
    retryAttempts: 3,
    retryDelay: 1000,
    progressReporting: true,
    failOnFirstError: false,
    validateBeforeProcess: true
  }

  constructor(config: Partial<BatchConfig> = {}) {
    super()
    this.logger = createLogger('BatchOperationManager')
    this.dbManager = DatabaseManager.getInstance()
    this.defaultConfig = { ...this.defaultConfig, ...config }
  }

  /**
   * Execute batch operation with comprehensive error handling and monitoring
   */
  async executeBatch<T, R>(
    operation: BatchOperation<T, R>,
    config: Partial<BatchConfig> = {}
  ): Promise<BulkOperationResult & { results: Array<R | null> }> {
    const finalConfig = { ...this.defaultConfig, ...config }
    const startTime = Date.now()
    
    this.logger.info('Starting batch operation', {
      operationId: operation.id,
      dataSize: operation.data.length,
      config: finalConfig
    })

    this.activeBatches.set(operation.id, operation)
    this.emit('batch:start', operation.id, operation.data.length)

    try {
      const results = await this.processInBatches(operation, finalConfig)
      const duration = Date.now() - startTime
      
      this.logger.info('Batch operation completed', {
        operationId: operation.id,
        duration,
        successful: results.successful,
        failed: results.failed,
        total: results.total
      })

      this.emit('batch:complete', operation.id, results)
      return results
    } catch (error) {
      const duration = Date.now() - startTime
      
      this.logger.error('Batch operation failed', {
        operationId: operation.id,
        duration,
        error: (error as Error).message
      })

      this.emit('batch:error', operation.id, error)
      throw error
    } finally {
      this.activeBatches.delete(operation.id)
    }
  }

  /**
   * Process data in batches with concurrency control
   */
  private async processInBatches<T, R>(
    operation: BatchOperation<T, R>,
    config: BatchConfig
  ): Promise<BulkOperationResult & { results: Array<R | null> }> {
    const { data, operation: operationFn, validation } = operation
    const { batchSize, maxConcurrency, failOnFirstError, validateBeforeProcess } = config

    const results: Array<R | null> = new Array(data.length).fill(null)
    const errors: Array<{ index: number; error: string }> = []
    let processed = 0
    let successful = 0

    // Pre-validation if enabled
    if (validateBeforeProcess && validation) {
      const validationResults = await this.validateItems(data, validation)
      if (validationResults.errors.length > 0) {
        throw new BulkOperationError(
          'Validation failed before processing',
          data.length,
          0,
          validationResults.errors.map(e => ({
            index: e.index,
            item: data[e.index],
            error: e.error
          }))
        )
      }
    }

    // Create batches
    const batches = this.createBatches(data, batchSize)
    
    // Process batches with concurrency control
    for (let i = 0; i < batches.length; i += maxConcurrency) {
      const currentBatches = batches.slice(i, i + maxConcurrency)
      
      const batchPromises = currentBatches.map(batch => 
        this.processBatch(batch, operationFn, config)
      )

      const batchResults = await Promise.allSettled(batchPromises)
      
      // Collect results from current batch group
      for (let j = 0; j < batchResults.length; j++) {
        const batchResult = batchResults[j]
        const batchIndex = i + j
        
        if (batchResult.status === 'fulfilled') {
          const { results: batchItemResults, errors: batchErrors } = batchResult.value
          
          // Merge results
          for (const itemResult of batchItemResults) {
            if (itemResult.success) {
              results[itemResult.originalIndex] = itemResult.result
              successful++
            } else {
              errors.push({
                index: itemResult.originalIndex,
                error: itemResult.error || 'Unknown error'
              })
            }
            processed++
          }
        } else {
          // Entire batch failed
          const batch = currentBatches[j]
          for (const item of batch) {
            errors.push({
              index: item.originalIndex,
              error: batchResult.reason.message
            })
            processed++
          }
        }

        // Progress reporting
        if (config.progressReporting && operation.onProgress) {
          const progress: BatchProgress = {
            total: data.length,
            processed,
            successful,
            failed: errors.length,
            percentage: (processed / data.length) * 100,
            errors: errors.slice(-10) // Last 10 errors
          }
          
          operation.onProgress(progress)
          this.emit('batch:progress', operation.id, progress)
        }

        // Fail fast if configured
        if (failOnFirstError && errors.length > 0) {
          throw new BulkOperationError(
            'Batch operation failed on first error',
            data.length,
            successful,
            errors.map(e => ({
              index: e.index,
              item: data[e.index],
              error: e.error
            }))
          )
        }
      }
    }

    return {
      count: successful,
      affectedIds: [], // Would need to track IDs from results
      errors: errors.map(e => ({ id: e.index.toString(), error: e.error })),
      results,
      total: data.length,
      successful,
      failed: errors.length
    }
  }

  /**
   * Process a single batch
   */
  private async processBatch<T, R>(
    batch: Array<{ item: T; originalIndex: number }>,
    operationFn: (item: T, index: number) => Promise<R>,
    config: BatchConfig
  ): Promise<{
    results: Array<{
      originalIndex: number
      success: boolean
      result?: R
      error?: string
    }>
  }> {
    const results: Array<{
      originalIndex: number
      success: boolean
      result?: R
      error?: string
    }> = []

    for (const { item, originalIndex } of batch) {
      let attempts = 0
      let lastError: Error | null = null

      while (attempts < config.retryAttempts) {
        try {
          const result = await operationFn(item, originalIndex)
          results.push({
            originalIndex,
            success: true,
            result
          })
          break
        } catch (error) {
          lastError = error as Error
          attempts++
          
          if (attempts < config.retryAttempts) {
            // Wait before retry
            await this.sleep(config.retryDelay * attempts)
          }
        }
      }

      if (attempts >= config.retryAttempts && lastError) {
        results.push({
          originalIndex,
          success: false,
          error: lastError.message
        })
      }
    }

    return { results }
  }

  /**
   * Create batches from data array
   */
  private createBatches<T>(data: T[], batchSize: number): Array<Array<{ item: T; originalIndex: number }>> {
    const batches: Array<Array<{ item: T; originalIndex: number }>> = []
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize).map((item, index) => ({
        item,
        originalIndex: i + index
      }))
      batches.push(batch)
    }
    
    return batches
  }

  /**
   * Validate items before processing
   */
  private async validateItems<T>(
    data: T[],
    validation: (item: T, index: number) => Promise<boolean>
  ): Promise<{ errors: Array<{ index: number; error: string }> }> {
    const errors: Array<{ index: number; error: string }> = []
    
    for (let i = 0; i < data.length; i++) {
      try {
        const isValid = await validation(data[i], i)
        if (!isValid) {
          errors.push({
            index: i,
            error: 'Validation failed'
          })
        }
      } catch (error) {
        errors.push({
          index: i,
          error: (error as Error).message
        })
      }
    }
    
    return { errors }
  }

  /**
   * Create batch operation for database transactions
   */
  async executeBatchTransaction<T, R>(
    data: T[],
    operation: (item: T, index: number, context: TransactionContext) => Promise<R>,
    config: Partial<BatchConfig> = {}
  ): Promise<BulkOperationResult & { results: Array<R | null> }> {
    const operationId = `batch_tx_${Date.now()}`
    
    return await this.dbManager.executeTransaction(async (tx) => {
      const context: TransactionContext = { tx }
      
      const batchOperation: BatchOperation<T, R> = {
        id: operationId,
        data,
        operation: (item, index) => operation(item, index, context)
      }
      
      return await this.executeBatch(batchOperation, config)
    })
  }

  /**
   * Execute batch create operation
   */
  async batchCreate<T, R>(
    repository: any,
    data: T[],
    config: Partial<BatchConfig> = {}
  ): Promise<BulkOperationResult & { results: Array<R | null> }> {
    const operationId = `batch_create_${Date.now()}`
    
    const batchOperation: BatchOperation<T, R> = {
      id: operationId,
      data,
      operation: async (item: T) => {
        return await repository.create(item)
      },
      validation: async (item: T) => {
        const validation = await repository.validate(item)
        return validation.isValid
      }
    }
    
    return await this.executeBatch(batchOperation, config)
  }

  /**
   * Execute batch update operation
   */
  async batchUpdate<T extends { id: string }, R>(
    repository: any,
    data: T[],
    config: Partial<BatchConfig> = {}
  ): Promise<BulkOperationResult & { results: Array<R | null> }> {
    const operationId = `batch_update_${Date.now()}`
    
    const batchOperation: BatchOperation<T, R> = {
      id: operationId,
      data,
      operation: async (item: T) => {
        const { id, ...updateData } = item
        return await repository.update(id, updateData)
      },
      validation: async (item: T) => {
        const validation = await repository.validate(item)
        return validation.isValid
      }
    }
    
    return await this.executeBatch(batchOperation, config)
  }

  /**
   * Execute batch delete operation
   */
  async batchDelete<T extends { id: string }>(
    repository: any,
    data: T[],
    config: Partial<BatchConfig> = {}
  ): Promise<BulkOperationResult & { results: Array<any | null> }> {
    const operationId = `batch_delete_${Date.now()}`
    
    const batchOperation: BatchOperation<T, any> = {
      id: operationId,
      data,
      operation: async (item: T) => {
        return await repository.delete(item.id)
      }
    }
    
    return await this.executeBatch(batchOperation, config)
  }

  /**
   * Get status of active batches
   */
  getActiveBatches(): Array<{ id: string; dataSize: number; startTime: Date }> {
    return Array.from(this.activeBatches.entries()).map(([id, operation]) => ({
      id,
      dataSize: operation.data.length,
      startTime: new Date() // Would need to track actual start time
    }))
  }

  /**
   * Cancel batch operation
   */
  async cancelBatch(operationId: string): Promise<boolean> {
    const operation = this.activeBatches.get(operationId)
    if (!operation) {
      return false
    }
    
    this.activeBatches.delete(operationId)
    this.emit('batch:cancelled', operationId)
    
    this.logger.info('Batch operation cancelled', { operationId })
    return true
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Batch operation builder for fluent API
 */
export class BatchOperationBuilder<T, R> {
  private operation: Partial<BatchOperation<T, R>> = {}
  private config: Partial<BatchConfig> = {}

  constructor(private manager: BatchOperationManager) {}

  withId(id: string): this {
    this.operation.id = id
    return this
  }

  withData(data: T[]): this {
    this.operation.data = data
    return this
  }

  withOperation(operation: (item: T, index: number) => Promise<R>): this {
    this.operation.operation = operation
    return this
  }

  withValidation(validation: (item: T, index: number) => Promise<boolean>): this {
    this.operation.validation = validation
    return this
  }

  withProgressCallback(callback: (progress: BatchProgress) => void): this {
    this.operation.onProgress = callback
    return this
  }

  withErrorCallback(callback: (error: Error, item: T, index: number) => void): this {
    this.operation.onError = callback
    return this
  }

  withSuccessCallback(callback: (result: R, item: T, index: number) => void): this {
    this.operation.onSuccess = callback
    return this
  }

  withBatchSize(size: number): this {
    this.config.batchSize = size
    return this
  }

  withMaxConcurrency(concurrency: number): this {
    this.config.maxConcurrency = concurrency
    return this
  }

  withRetryAttempts(attempts: number): this {
    this.config.retryAttempts = attempts
    return this
  }

  withRetryDelay(delay: number): this {
    this.config.retryDelay = delay
    return this
  }

  failOnFirstError(fail: boolean = true): this {
    this.config.failOnFirstError = fail
    return this
  }

  validateBeforeProcess(validate: boolean = true): this {
    this.config.validateBeforeProcess = validate
    return this
  }

  async execute(): Promise<BulkOperationResult & { results: Array<R | null> }> {
    if (!this.operation.id) {
      this.operation.id = `batch_${Date.now()}`
    }

    if (!this.operation.data || !this.operation.operation) {
      throw new Error('Data and operation are required')
    }

    return await this.manager.executeBatch(
      this.operation as BatchOperation<T, R>,
      this.config
    )
  }
}

/**
 * Factory function for creating batch operation builder
 */
export function createBatchOperation<T, R>(
  manager: BatchOperationManager
): BatchOperationBuilder<T, R> {
  return new BatchOperationBuilder<T, R>(manager)
}

/**
 * Default batch operation manager instance
 */
export const defaultBatchManager = new BatchOperationManager()

/**
 * Convenience functions for common batch operations
 */
export const batchOperations = {
  create: defaultBatchManager.batchCreate.bind(defaultBatchManager),
  update: defaultBatchManager.batchUpdate.bind(defaultBatchManager),
  delete: defaultBatchManager.batchDelete.bind(defaultBatchManager),
  transaction: defaultBatchManager.executeBatchTransaction.bind(defaultBatchManager),
  custom: <T, R>(data: T[], operation: (item: T, index: number) => Promise<R>) => 
    createBatchOperation<T, R>(defaultBatchManager)
      .withData(data)
      .withOperation(operation)
}