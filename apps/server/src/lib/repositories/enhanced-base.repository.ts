/**
 * Enhanced base repository implementation with full feature support
 */

import { prisma } from '../prisma.js'
import type { 
  IBaseRepository, 
  PaginationOptions, 
  PaginatedResult, 
  FilterOptions, 
  BulkOperationResult, 
  TransactionContext 
} from './interfaces/index.js'

export abstract class EnhancedBaseRepository<T, TCreate, TUpdate, TWhereInput = any> 
  implements IBaseRepository<T, TCreate, TUpdate, TWhereInput> {

  protected abstract model: any
  protected abstract modelName: string

  /**
   * Get the model instance (with transaction support)
   */
  protected getModel(context?: TransactionContext) {
    return context?.tx ? context.tx[this.modelName] : this.model
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
      
      where.OR = searchConditions
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
      result.take = options.limit
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
   * Create a new record
   */
  async create(data: TCreate, context?: TransactionContext): Promise<T> {
    const model = this.getModel(context)
    return await model.create({ data })
  }

  /**
   * Find record by ID
   */
  async findById(id: string, options: FilterOptions<T> = {}, context?: TransactionContext): Promise<T | null> {
    const model = this.getModel(context)
    return await model.findUnique({
      where: { id },
      include: options.include,
      select: options.select
    })
  }

  /**
   * Find many records with filtering
   */
  async findMany(options: FilterOptions<T> = {}, context?: TransactionContext): Promise<T[]> {
    const model = this.getModel(context)
    const where = this.buildWhereClause(options)
    const orderBy = this.buildOrderByClause(options)

    return await model.findMany({
      where,
      orderBy,
      include: options.include,
      select: options.select
    })
  }

  /**
   * Find many records with pagination
   */
  async findManyPaginated(
    options: FilterOptions<T> & PaginationOptions = {},
    context?: TransactionContext
  ): Promise<PaginatedResult<T>> {
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
  }

  /**
   * Update record by ID
   */
  async update(id: string, data: TUpdate, context?: TransactionContext): Promise<T> {
    const model = this.getModel(context)
    return await model.update({
      where: { id },
      data
    })
  }

  /**
   * Delete record by ID
   */
  async delete(id: string, context?: TransactionContext): Promise<T> {
    const model = this.getModel(context)
    return await model.delete({
      where: { id }
    })
  }

  /**
   * Count records with filtering
   */
  async count(options: FilterOptions<T> = {}, context?: TransactionContext): Promise<number> {
    const model = this.getModel(context)
    const where = this.buildWhereClause(options)
    return await model.count({ where })
  }

  /**
   * Check if record exists
   */
  async exists(id: string, context?: TransactionContext): Promise<boolean> {
    const model = this.getModel(context)
    const count = await model.count({ where: { id } })
    return count > 0
  }

  /**
   * Find first record matching conditions
   */
  async findFirst(options: FilterOptions<T>, context?: TransactionContext): Promise<T | null> {
    const model = this.getModel(context)
    const where = this.buildWhereClause(options)
    const orderBy = this.buildOrderByClause(options)

    return await model.findFirst({
      where,
      orderBy,
      include: options.include,
      select: options.select
    })
  }

  /**
   * Find unique record
   */
  async findUnique(
    where: TWhereInput, 
    options: FilterOptions<T> = {}, 
    context?: TransactionContext
  ): Promise<T | null> {
    const model = this.getModel(context)
    return await model.findUnique({
      where,
      include: options.include,
      select: options.select
    })
  }

  /**
   * Upsert record
   */
  async upsert(params: {
    where: TWhereInput
    create: TCreate
    update: TUpdate
  }, context?: TransactionContext): Promise<T> {
    const model = this.getModel(context)
    return await model.upsert(params)
  }

  /**
   * Create many records
   */
  async createMany(data: TCreate[], context?: TransactionContext): Promise<BulkOperationResult> {
    const model = this.getModel(context)
    
    try {
      const result = await model.createMany({ data })
      return {
        count: result.count,
        affectedIds: [], // Prisma createMany doesn't return IDs
        errors: []
      }
    } catch (error) {
      return {
        count: 0,
        affectedIds: [],
        errors: [{ id: 'bulk', error: error.message }]
      }
    }
  }

  /**
   * Update many records
   */
  async updateMany(
    where: Partial<T> | Record<string, any>,
    data: Partial<TUpdate>,
    context?: TransactionContext
  ): Promise<BulkOperationResult> {
    const model = this.getModel(context)
    
    try {
      const result = await model.updateMany({ where, data })
      return {
        count: result.count,
        affectedIds: [],
        errors: []
      }
    } catch (error) {
      return {
        count: 0,
        affectedIds: [],
        errors: [{ id: 'bulk', error: error.message }]
      }
    }
  }

  /**
   * Delete many records
   */
  async deleteMany(
    where: Partial<T> | Record<string, any>,
    context?: TransactionContext
  ): Promise<BulkOperationResult> {
    const model = this.getModel(context)
    
    try {
      const result = await model.deleteMany({ where })
      return {
        count: result.count,
        affectedIds: [],
        errors: []
      }
    } catch (error) {
      return {
        count: 0,
        affectedIds: [],
        errors: [{ id: 'bulk', error: error.message }]
      }
    }
  }

  /**
   * Search records
   */
  async search(
    query: string,
    options: {
      fields?: string[]
      fuzzy?: boolean
      limit?: number
      filters?: FilterOptions<T>
    } = {},
    context?: TransactionContext
  ): Promise<T[]> {
    const searchOptions: FilterOptions<T> = {
      ...options.filters,
      search: query,
      searchFields: options.fields || ['name', 'description']
    }

    const results = await this.findMany(searchOptions, context)
    return options.limit ? results.slice(0, options.limit) : results
  }

  /**
   * Aggregate data
   */
  async aggregate(options: {
    where?: Partial<T> | Record<string, any>
    groupBy?: string[]
    having?: Record<string, any>
    orderBy?: Record<string, 'asc' | 'desc'>
    select?: Record<string, any>
    _count?: boolean | Record<string, boolean>
    _avg?: Record<string, boolean>
    _sum?: Record<string, boolean>
    _min?: Record<string, boolean>
    _max?: Record<string, boolean>
  }, context?: TransactionContext): Promise<any> {
    const model = this.getModel(context)
    
    const aggregateOptions: any = {}
    
    if (options.where) {
      aggregateOptions.where = options.where
    }
    
    if (options._count) {
      aggregateOptions._count = options._count
    }
    
    if (options._avg) {
      aggregateOptions._avg = options._avg
    }
    
    if (options._sum) {
      aggregateOptions._sum = options._sum
    }
    
    if (options._min) {
      aggregateOptions._min = options._min
    }
    
    if (options._max) {
      aggregateOptions._max = options._max
    }

    return await model.aggregate(aggregateOptions)
  }

  /**
   * Validate data (override in subclasses)
   */
  async validate(data: TCreate | TUpdate): Promise<{ isValid: boolean; errors: string[] }> {
    // Default implementation - override in subclasses
    return { isValid: true, errors: [] }
  }

  /**
   * Cache operations (basic implementation - can be extended)
   */
  async getCached(key: string): Promise<T | null> {
    // TODO: Implement caching (Redis, etc.)
    return null
  }

  async setCached(key: string, data: T, ttl: number = 3600): Promise<void> {
    // TODO: Implement caching (Redis, etc.)
  }

  async clearCache(pattern?: string): Promise<void> {
    // TODO: Implement cache clearing
  }
}