/**
 * Abstract BaseRepository class with comprehensive CRUD operations, 
 * transaction support, caching, and error handling
 */

import { Logger } from 'winston'
import { EventEmitter } from 'events'
import type { 
  IBaseRepository, 
  PaginationOptions, 
  PaginatedResult, 
  FilterOptions, 
  BulkOperationResult, 
  TransactionContext 
} from '../interfaces/index.js'
import { DatabaseManager } from '../core/database-manager.js'
import { CacheManager } from '../core/cache-manager.js'
import { createLogger } from '../../utils/logger.js'
import { RepositoryError, ValidationError, NotFoundError } from '../core/errors.js'

export interface RepositoryConfig {
  modelName: string
  cacheTTL?: number
  enableSoftDelete?: boolean
  enableAudit?: boolean
  batchSize?: number
  maxRetries?: number
}

export interface QueryMetrics {
  executionTime: number
  cacheHit: boolean
  recordsAffected: number
  queryType: string
}

export interface AuditContext {
  userId?: string
  operation: string
  timestamp: Date
  metadata?: Record<string, any>
}

export abstract class BaseRepository<T, TCreate, TUpdate, TWhereInput = any> 
  extends EventEmitter 
  implements IBaseRepository<T, TCreate, TUpdate, TWhereInput> {

  protected abstract config: RepositoryConfig
  protected logger: Logger
  protected dbManager: DatabaseManager
  protected cacheManager: CacheManager
  protected metrics: Map<string, QueryMetrics[]> = new Map()

  constructor() {
    super()
    this.logger = createLogger(`Repository:${this.constructor.name}`)
    this.dbManager = DatabaseManager.getInstance()
    this.cacheManager = CacheManager.getInstance()
    
    this.setupEventHandlers()
  }

  /**
   * Get the Prisma model instance with transaction support
   */
  protected getModel(context?: TransactionContext) {
    const client = context?.tx || this.dbManager.getClient()
    return client[this.config.modelName as keyof typeof client]
  }

  /**
   * Setup event handlers for monitoring and debugging
   */
  private setupEventHandlers(): void {
    this.on('query:start', (operation: string, params: any) => {
      this.logger.debug(`Starting ${operation}`, { params })
    })

    this.on('query:end', (operation: string, metrics: QueryMetrics) => {
      this.logger.debug(`Completed ${operation}`, { metrics })
      this.recordMetrics(operation, metrics)
    })

    this.on('error', (error: Error, operation: string, params: any) => {
      this.logger.error(`Error in ${operation}`, { error: error.message, params })
    })
  }

  /**
   * Record performance metrics
   */
  private recordMetrics(operation: string, metrics: QueryMetrics): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, [])
    }
    
    const operationMetrics = this.metrics.get(operation)!
    operationMetrics.push(metrics)
    
    // Keep only last 100 metrics per operation
    if (operationMetrics.length > 100) {
      operationMetrics.shift()
    }
  }

  /**
   * Execute operation with metrics and error handling
   */
  protected async executeWithMetrics<R>(
    operation: string,
    fn: () => Promise<R>,
    params?: any
  ): Promise<R> {
    const startTime = Date.now()
    this.emit('query:start', operation, params)

    try {
      const result = await fn()
      const executionTime = Date.now() - startTime
      
      const metrics: QueryMetrics = {
        executionTime,
        cacheHit: false,
        recordsAffected: Array.isArray(result) ? result.length : result ? 1 : 0,
        queryType: operation
      }
      
      this.emit('query:end', operation, metrics)
      return result
    } catch (error) {
      this.emit('error', error, operation, params)
      throw this.handleError(error as Error, operation, params)
    }
  }

  /**
   * Handle and transform errors
   */
  protected handleError(error: Error, operation: string, params?: any): Error {
    this.logger.error(`Repository error in ${operation}`, {
      error: error.message,
      stack: error.stack,
      params
    })

    // Transform Prisma errors to domain errors
    if (error.message.includes('Record to update not found')) {
      return new NotFoundError(`Record not found for ${operation}`)
    }
    
    if (error.message.includes('Unique constraint')) {
      return new ValidationError('Unique constraint violation', { field: 'unique' })
    }
    
    if (error.message.includes('Foreign key constraint')) {
      return new ValidationError('Foreign key constraint violation')
    }

    return new RepositoryError(`Database operation failed: ${error.message}`, error)
  }

  /**
   * Build where clause from filter options
   */
  protected buildWhereClause(options: FilterOptions<T> = {}): any {
    const where: any = {}

    // Basic where conditions
    if (options.where) {
      Object.assign(where, options.where)
    }

    // Search functionality
    if (options.search && options.searchFields) {
      const searchConditions = options.searchFields.map(field => ({
        [field]: {
          contains: options.search,
          mode: 'insensitive'
        }
      }))
      
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchConditions }]
        delete where.OR
      } else {
        where.OR = searchConditions
      }
    }

    // Date range filtering
    if (options.dateRange) {
      const { field, from, to } = options.dateRange
      where[field] = {}
      
      if (from) {
        where[field].gte = from
      }
      if (to) {
        where[field].lte = to
      }
    }

    // Soft delete handling
    if (this.config.enableSoftDelete && !options.includeDeleted) {
      where.deletedAt = null
    }

    return where
  }

  /**
   * Build order by clause
   */
  protected buildOrderByClause(options: FilterOptions<T> = {}): any {
    if (!options.orderBy) return undefined

    if (Array.isArray(options.orderBy)) {
      return options.orderBy.map(order => ({
        [order.field]: order.direction
      }))
    }

    return options.orderBy
  }

  /**
   * Build pagination options
   */
  protected buildPaginationOptions(options: PaginationOptions = {}): any {
    const result: any = {}

    if (options.limit) {
      result.take = Math.min(options.limit, 1000) // Max 1000 records
    }

    if (options.offset) {
      result.skip = options.offset
    } else if (options.page && options.limit) {
      result.skip = (options.page - 1) * options.limit
    }

    if (options.cursor) {
      result.cursor = { id: options.cursor }
      result.skip = 1 // Skip the cursor itself
    }

    return result
  }

  /**
   * Generate cache key
   */
  protected generateCacheKey(operation: string, params: any): string {
    const key = `${this.config.modelName}:${operation}:${JSON.stringify(params)}`
    return Buffer.from(key).toString('base64').slice(0, 250) // Redis key length limit
  }

  /**
   * Get from cache with metrics
   */
  protected async getFromCache<R>(key: string): Promise<R | null> {
    try {
      const result = await this.cacheManager.get<R>(key)
      if (result !== null) {
        this.logger.debug('Cache hit', { key })
      }
      return result
    } catch (error) {
      this.logger.warn('Cache get failed', { key, error: error.message })
      return null
    }
  }

  /**
   * Set cache with TTL
   */
  protected async setCache<R>(key: string, data: R, ttl?: number): Promise<void> {
    try {
      const cacheTTL = ttl || this.config.cacheTTL || 300 // 5 minutes default
      await this.cacheManager.set(key, data, cacheTTL)
      this.logger.debug('Cache set', { key, ttl: cacheTTL })
    } catch (error) {
      this.logger.warn('Cache set failed', { key, error: error.message })
    }
  }

  /**
   * Validate input data
   */
  protected async validateInput(data: TCreate | TUpdate, isUpdate = false): Promise<void> {
    const validation = await this.validate(data)
    if (!validation.isValid) {
      throw new ValidationError('Validation failed', { errors: validation.errors })
    }
  }

  /**
   * Create audit log entry
   */
  protected async createAuditLog(
    operation: string,
    recordId: string,
    data: any,
    context?: TransactionContext
  ): Promise<void> {
    if (!this.config.enableAudit) return

    try {
      const model = this.getModel(context)
      await model.auditLog?.create({
        data: {
          modelName: this.config.modelName,
          operation,
          recordId,
          data: JSON.stringify(data),
          timestamp: new Date(),
          userId: context?.userId
        }
      })
    } catch (error) {
      this.logger.warn('Audit log creation failed', { error: error.message })
    }
  }

  // ==================== CRUD OPERATIONS ====================

  /**
   * Create a new record
   */
  async create(data: TCreate, context?: TransactionContext): Promise<T> {
    return this.executeWithMetrics('create', async () => {
      await this.validateInput(data)
      
      const model = this.getModel(context)
      const result = await model.create({ data })
      
      await this.createAuditLog('CREATE', result.id, data, context)
      this.emit('record:created', result)
      
      return result
    }, data)
  }

  /**
   * Find record by ID with caching
   */
  async findById(
    id: string, 
    options: FilterOptions<T> = {}, 
    context?: TransactionContext
  ): Promise<T | null> {
    const cacheKey = this.generateCacheKey('findById', { id, options })
    
    return this.executeWithMetrics('findById', async () => {
      // Try cache first
      const cached = await this.getFromCache<T>(cacheKey)
      if (cached) return cached

      const model = this.getModel(context)
      const result = await model.findUnique({
        where: { id },
        include: options.include,
        select: options.select
      })

      if (result) {
        await this.setCache(cacheKey, result)
      }

      return result
    }, { id, options })
  }

  /**
   * Find many records with filtering and caching
   */
  async findMany(
    options: FilterOptions<T> = {}, 
    context?: TransactionContext
  ): Promise<T[]> {
    const cacheKey = this.generateCacheKey('findMany', options)
    
    return this.executeWithMetrics('findMany', async () => {
      // Try cache first for simple queries
      if (!options.include && !options.select) {
        const cached = await this.getFromCache<T[]>(cacheKey)
        if (cached) return cached
      }

      const model = this.getModel(context)
      const where = this.buildWhereClause(options)
      const orderBy = this.buildOrderByClause(options)

      const result = await model.findMany({
        where,
        orderBy,
        include: options.include,
        select: options.select
      })

      // Cache simple queries
      if (!options.include && !options.select) {
        await this.setCache(cacheKey, result)
      }

      return result
    }, options)
  }

  /**
   * Find many records with pagination
   */
  async findManyPaginated(
    options: FilterOptions<T> & PaginationOptions = {},
    context?: TransactionContext
  ): Promise<PaginatedResult<T>> {
    return this.executeWithMetrics('findManyPaginated', async () => {
      const model = this.getModel(context)
      const where = this.buildWhereClause(options)
      const orderBy = this.buildOrderByClause(options)
      const paginationOptions = this.buildPaginationOptions(options)

      const [data, total] = await Promise.all([
        model.findMany({
          where,
          orderBy,
          include: options.include,
          select: options.select,
          ...paginationOptions
        }),
        model.count({ where })
      ])

      const page = options.page || 1
      const limit = options.limit || 10
      const totalPages = Math.ceil(total / limit)

      return {
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
          nextCursor: data.length > 0 ? data[data.length - 1].id : undefined,
          previousCursor: data.length > 0 ? data[0].id : undefined
        }
      }
    }, options)
  }

  /**
   * Update record by ID
   */
  async update(
    id: string, 
    data: TUpdate, 
    context?: TransactionContext
  ): Promise<T> {
    return this.executeWithMetrics('update', async () => {
      await this.validateInput(data, true)
      
      const model = this.getModel(context)
      const result = await model.update({
        where: { id },
        data
      })

      await this.createAuditLog('UPDATE', id, data, context)
      this.emit('record:updated', result)
      
      // Invalidate cache
      await this.cacheManager.deletePattern(`${this.config.modelName}:*`)

      return result
    }, { id, data })
  }

  /**
   * Delete record by ID
   */
  async delete(id: string, context?: TransactionContext): Promise<T> {
    return this.executeWithMetrics('delete', async () => {
      const model = this.getModel(context)
      
      let result: T
      if (this.config.enableSoftDelete) {
        result = await model.update({
          where: { id },
          data: { 
            deletedAt: new Date(),
            deletedBy: context?.userId 
          }
        })
      } else {
        result = await model.delete({ where: { id } })
      }

      await this.createAuditLog('DELETE', id, {}, context)
      this.emit('record:deleted', result)
      
      // Invalidate cache
      await this.cacheManager.deletePattern(`${this.config.modelName}:*`)

      return result
    }, { id })
  }

  /**
   * Count records with filtering
   */
  async count(
    options: FilterOptions<T> = {}, 
    context?: TransactionContext
  ): Promise<number> {
    const cacheKey = this.generateCacheKey('count', options)
    
    return this.executeWithMetrics('count', async () => {
      const cached = await this.getFromCache<number>(cacheKey)
      if (cached !== null) return cached

      const model = this.getModel(context)
      const where = this.buildWhereClause(options)
      const result = await model.count({ where })

      await this.setCache(cacheKey, result, 60) // Cache for 1 minute
      return result
    }, options)
  }

  // ==================== ADDITIONAL OPERATIONS ====================

  /**
   * Check if record exists
   */
  async exists(id: string, context?: TransactionContext): Promise<boolean> {
    return this.executeWithMetrics('exists', async () => {
      const model = this.getModel(context)
      const count = await model.count({ where: { id } })
      return count > 0
    }, { id })
  }

  /**
   * Find first record matching conditions
   */
  async findFirst(
    options: FilterOptions<T>, 
    context?: TransactionContext
  ): Promise<T | null> {
    return this.executeWithMetrics('findFirst', async () => {
      const model = this.getModel(context)
      const where = this.buildWhereClause(options)
      const orderBy = this.buildOrderByClause(options)

      return await model.findFirst({
        where,
        orderBy,
        include: options.include,
        select: options.select
      })
    }, options)
  }

  /**
   * Find unique record
   */
  async findUnique(
    where: TWhereInput, 
    options: FilterOptions<T> = {}, 
    context?: TransactionContext
  ): Promise<T | null> {
    return this.executeWithMetrics('findUnique', async () => {
      const model = this.getModel(context)
      return await model.findUnique({
        where,
        include: options.include,
        select: options.select
      })
    }, { where, options })
  }

  /**
   * Upsert record
   */
  async upsert(params: {
    where: TWhereInput
    create: TCreate
    update: TUpdate
  }, context?: TransactionContext): Promise<T> {
    return this.executeWithMetrics('upsert', async () => {
      await this.validateInput(params.create)
      await this.validateInput(params.update, true)
      
      const model = this.getModel(context)
      const result = await model.upsert(params)

      await this.createAuditLog('UPSERT', result.id, params, context)
      this.emit('record:upserted', result)
      
      // Invalidate cache
      await this.cacheManager.deletePattern(`${this.config.modelName}:*`)

      return result
    }, params)
  }

  // ==================== ABSTRACT METHODS ====================

  /**
   * Validate data (to be implemented by subclasses)
   */
  abstract validate(data: TCreate | TUpdate): Promise<{ isValid: boolean; errors: string[] }>

  // ==================== BULK OPERATIONS (to be implemented) ====================

  abstract createMany(data: TCreate[], context?: TransactionContext): Promise<BulkOperationResult>
  abstract updateMany(
    where: Partial<T> | Record<string, any>,
    data: Partial<TUpdate>,
    context?: TransactionContext
  ): Promise<BulkOperationResult>
  abstract deleteMany(
    where: Partial<T> | Record<string, any>,
    context?: TransactionContext
  ): Promise<BulkOperationResult>

  // ==================== SEARCH AND AGGREGATION ====================

  abstract search(
    query: string,
    options?: {
      fields?: string[]
      fuzzy?: boolean
      limit?: number
      filters?: FilterOptions<T>
    },
    context?: TransactionContext
  ): Promise<T[]>

  abstract aggregate(
    options: any,
    context?: TransactionContext
  ): Promise<any>

  // ==================== CACHE OPERATIONS ====================

  async getCached(key: string): Promise<T | null> {
    return this.getFromCache<T>(key)
  }

  async setCached(key: string, data: T, ttl?: number): Promise<void> {
    await this.setCache(key, data, ttl)
  }

  async clearCache(pattern?: string): Promise<void> {
    const cachePattern = pattern || `${this.config.modelName}:*`
    await this.cacheManager.deletePattern(cachePattern)
  }

  // ==================== METRICS AND MONITORING ====================

  /**
   * Get repository metrics
   */
  getMetrics(): Record<string, QueryMetrics[]> {
    return Object.fromEntries(this.metrics)
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics.clear()
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): Record<string, any> {
    const summary: Record<string, any> = {}
    
    for (const [operation, metrics] of this.metrics) {
      const times = metrics.map(m => m.executionTime)
      const cacheHits = metrics.filter(m => m.cacheHit).length
      
      summary[operation] = {
        count: metrics.length,
        avgTime: times.reduce((a, b) => a + b, 0) / times.length,
        minTime: Math.min(...times),
        maxTime: Math.max(...times),
        cacheHitRate: cacheHits / metrics.length
      }
    }
    
    return summary
  }
}