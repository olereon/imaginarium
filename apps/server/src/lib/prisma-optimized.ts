/**
 * Optimized Prisma Client with Query Hints and Performance Enhancements
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { QueryAnalyzer } from './query-analyzer';

// Extend Prisma Client with optimization features
export class OptimizedPrismaClient extends PrismaClient {
  private queryAnalyzer: QueryAnalyzer;
  private queryCache: Map<string, { result: any; timestamp: number; ttl: number }> = new Map();
  private batchOperations: Map<string, any[]> = new Map();
  private batchTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(options?: Prisma.PrismaClientOptions) {
    super({
      ...options,
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ],
    });

    // Initialize query analyzer
    this.queryAnalyzer = new QueryAnalyzer(this as any, {
      enableAnalysis: process.env.NODE_ENV !== 'test',
      slowQueryThreshold: 1000,
    });

    // Setup query optimization middleware
    this.setupOptimizationMiddleware();

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Setup optimization middleware
   */
  private setupOptimizationMiddleware(): void {
    // @ts-ignore
    this.$use(async (params, next) => {
      // Apply query hints
      params = this.applyQueryHints(params);

      // Check cache for read operations
      if (this.shouldCache(params)) {
        const cached = await this.getCached(params);
        if (cached !== null) {
          return cached;
        }
      }

      // Execute query
      const result = await next(params);

      // Cache result if applicable
      if (this.shouldCache(params)) {
        await this.setCached(params, result);
      }

      return result;
    });
  }

  /**
   * Apply query hints based on model and operation
   */
  private applyQueryHints(params: any): any {
    const hints = { ...params };

    // Model-specific optimizations
    switch (params.model) {
      case 'PipelineRun':
        hints.args = this.optimizePipelineRunQuery(hints.args, params.action);
        break;

      case 'TaskExecution':
        hints.args = this.optimizeTaskExecutionQuery(hints.args, params.action);
        break;

      case 'ExecutionLog':
        hints.args = this.optimizeExecutionLogQuery(hints.args, params.action);
        break;

      case 'FileUpload':
        hints.args = this.optimizeFileUploadQuery(hints.args, params.action);
        break;

      case 'Artifact':
        hints.args = this.optimizeArtifactQuery(hints.args, params.action);
        break;
    }

    // Apply general optimizations
    hints.args = this.applyGeneralOptimizations(hints.args, params.action);

    return hints;
  }

  /**
   * Optimize PipelineRun queries
   */
  private optimizePipelineRunQuery(args: any, action: string): any {
    const optimized = { ...args };

    if (action === 'findMany') {
      // Add default pagination if not specified
      if (!optimized.take) {
        optimized.take = 100;
      }

      // Add default ordering if not specified
      if (!optimized.orderBy) {
        optimized.orderBy = { queuedAt: 'desc' };
      }

      // Optimize includes
      if (optimized.include) {
        // Limit nested data
        if (optimized.include.tasks) {
          optimized.include.tasks = {
            take: 50,
            orderBy: { executionOrder: 'asc' },
          };
        }

        if (optimized.include.logs) {
          optimized.include.logs = {
            take: 100,
            orderBy: { timestamp: 'desc' },
          };
        }
      }

      // Add index hints for common queries
      if (optimized.where?.status && optimized.where?.userId) {
        // This query can use the [userId, status] composite index
        optimized._hint = { index: 'idx_user_status' };
      }
    }

    if (action === 'count') {
      // For large tables, use approximate count if exact count is not critical
      if (!optimized.where || Object.keys(optimized.where).length === 0) {
        optimized._hint = { approximate: true };
      }
    }

    return optimized;
  }

  /**
   * Optimize TaskExecution queries
   */
  private optimizeTaskExecutionQuery(args: any, action: string): any {
    const optimized = { ...args };

    if (action === 'findMany') {
      // Add default pagination
      if (!optimized.take) {
        optimized.take = 100;
      }

      // Optimize ordering for execution flow
      if (!optimized.orderBy && optimized.where?.runId) {
        optimized.orderBy = { executionOrder: 'asc' };
      }

      // Limit nested includes
      if (optimized.include?.logs) {
        optimized.include.logs = {
          take: 50,
          orderBy: { timestamp: 'desc' },
        };
      }
    }

    return optimized;
  }

  /**
   * Optimize ExecutionLog queries
   */
  private optimizeExecutionLogQuery(args: any, action: string): any {
    const optimized = { ...args };

    if (action === 'findMany') {
      // Enforce pagination for logs
      if (!optimized.take || optimized.take > 1000) {
        optimized.take = 1000;
      }

      // Add time-based filtering if not specified
      if (!optimized.where?.timestamp) {
        // Default to last 24 hours
        optimized.where = {
          ...optimized.where,
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        };
      }

      // Optimize ordering
      if (!optimized.orderBy) {
        optimized.orderBy = { timestamp: 'desc' };
      }
    }

    if (action === 'count' && optimized.where?.runId) {
      // Use cached count for specific runs if available
      optimized._hint = { useCache: true };
    }

    return optimized;
  }

  /**
   * Optimize FileUpload queries
   */
  private optimizeFileUploadQuery(args: any, action: string): any {
    const optimized = { ...args };

    if (action === 'findMany') {
      // Add default pagination
      if (!optimized.take) {
        optimized.take = 50;
      }

      // Optimize file listing queries
      if (optimized.where?.userId && !optimized.orderBy) {
        optimized.orderBy = { uploadedAt: 'desc' };
      }

      // Exclude large metadata fields for list views
      if (!optimized.select && !optimized.include) {
        optimized.select = {
          id: true,
          userId: true,
          filename: true,
          originalName: true,
          mimeType: true,
          size: true,
          status: true,
          uploadedAt: true,
          isPublic: true,
          thumbnails: true,
        };
      }
    }

    return optimized;
  }

  /**
   * Optimize Artifact queries
   */
  private optimizeArtifactQuery(args: any, action: string): any {
    const optimized = { ...args };

    if (action === 'findMany') {
      // Add default pagination
      if (!optimized.take) {
        optimized.take = 50;
      }

      // Filter to latest versions by default
      if (!optimized.where?.isLatest && !optimized.where?.version) {
        optimized.where = {
          ...optimized.where,
          isLatest: true,
        };
      }

      // Optimize ordering
      if (!optimized.orderBy) {
        optimized.orderBy = { createdAt: 'desc' };
      }
    }

    return optimized;
  }

  /**
   * Apply general query optimizations
   */
  private applyGeneralOptimizations(args: any, action: string): any {
    const optimized = { ...args };

    // Optimize findUnique queries with includes
    if (action === 'findUnique' && optimized.include) {
      // Limit nested data fetching
      Object.keys(optimized.include).forEach(key => {
        if (optimized.include[key] === true) {
          optimized.include[key] = { take: 100 };
        }
      });
    }

    // Optimize count queries
    if (action === 'count') {
      // Remove unnecessary includes
      delete optimized.include;
      delete optimized.select;
    }

    // Add soft delete filtering if not specified
    if (action === 'findMany' || action === 'findFirst' || action === 'count') {
      if (!optimized.where?.deletedAt) {
        optimized.where = {
          ...optimized.where,
          deletedAt: null,
        };
      }
    }

    return optimized;
  }

  /**
   * Check if query should be cached
   */
  private shouldCache(params: any): boolean {
    // Only cache read operations
    if (!['findUnique', 'findFirst', 'findMany', 'count'].includes(params.action)) {
      return false;
    }

    // Cache specific models
    const cacheableModels = ['Pipeline', 'PipelineTemplate', 'User', 'ProviderCredential'];
    if (!cacheableModels.includes(params.model)) {
      return false;
    }

    // Don't cache queries with includes (too complex)
    if (params.args?.include) {
      return false;
    }

    return true;
  }

  /**
   * Get cached query result
   */
  private async getCached(params: any): Promise<any> {
    const cacheKey = this.getCacheKey(params);
    const cached = this.queryCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.result;
    }

    // Remove expired cache
    if (cached) {
      this.queryCache.delete(cacheKey);
    }

    return null;
  }

  /**
   * Set cached query result
   */
  private async setCached(params: any, result: any): Promise<void> {
    const cacheKey = this.getCacheKey(params);
    const ttl = this.getCacheTTL(params);

    this.queryCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      ttl,
    });

    // Limit cache size
    if (this.queryCache.size > 1000) {
      const firstKey = this.queryCache.keys().next().value;
      this.queryCache.delete(firstKey);
    }
  }

  /**
   * Generate cache key for query
   */
  private getCacheKey(params: any): string {
    return `${params.model}:${params.action}:${JSON.stringify(params.args)}`;
  }

  /**
   * Get cache TTL based on model and operation
   */
  private getCacheTTL(params: any): number {
    // Model-specific TTLs
    const ttlMap: Record<string, number> = {
      Pipeline: 5 * 60 * 1000, // 5 minutes
      PipelineTemplate: 10 * 60 * 1000, // 10 minutes
      User: 60 * 1000, // 1 minute
      ProviderCredential: 15 * 60 * 1000, // 15 minutes
    };

    return ttlMap[params.model] || 60 * 1000; // Default 1 minute
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for slow queries
    this.queryAnalyzer.on('slowQuery', metrics => {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('Slow query detected:', {
          model: metrics.model,
          operation: metrics.operation,
          duration: `${metrics.duration}ms`,
          query: metrics.query,
        });
      }
    });

    // Listen for query errors
    this.queryAnalyzer.on('queryError', metrics => {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('Query error:', {
          model: metrics.model,
          operation: metrics.operation,
          error: metrics.error,
          query: metrics.query,
        });
      }
    });
  }

  /**
   * Batch create operations
   */
  async batchCreate<T>(
    model: string,
    data: T[],
    options: { batchSize?: number; delayMs?: number } = {}
  ): Promise<T[]> {
    const batchSize = options.batchSize || 100;
    const delayMs = options.delayMs || 100;
    const results: T[] = [];

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const created = await (this as any)[model].createMany({
        data: batch,
        skipDuplicates: true,
      });

      results.push(...created);

      // Add delay between batches to avoid overwhelming the database
      if (i + batchSize < data.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  /**
   * Batch update operations
   */
  async batchUpdate(
    model: string,
    updates: { where: any; data: any }[],
    options: { batchSize?: number; delayMs?: number } = {}
  ): Promise<void> {
    const batchSize = options.batchSize || 50;
    const delayMs = options.delayMs || 100;

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);

      await this.$transaction(batch.map(update => (this as any)[model].update(update)));

      // Add delay between batches
      if (i + batchSize < updates.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  /**
   * Optimized count with approximation
   */
  async approximateCount(model: string, where?: any): Promise<number> {
    // For PostgreSQL, use reltuples for approximate count
    if (process.env.DATABASE_PROVIDER === 'postgresql' && !where) {
      const result = await this.$queryRaw`
        SELECT reltuples::BIGINT AS count
        FROM pg_class
        WHERE relname = ${model.toLowerCase()}
      `;
      return (result as any)[0]?.count || 0;
    }

    // Fall back to regular count
    return await (this as any)[model].count({ where });
  }

  /**
   * Clear query cache
   */
  clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Get query statistics
   */
  getQueryStatistics() {
    return this.queryAnalyzer.getStatistics();
  }

  /**
   * Get slow queries
   */
  getSlowQueries() {
    return this.queryAnalyzer.getSlowQueries();
  }

  /**
   * Get query patterns
   */
  getQueryPatterns() {
    return this.queryAnalyzer.getQueryPatterns();
  }
}

// Export optimized Prisma client instance
export const prisma = new OptimizedPrismaClient();

// Export query optimization utilities
export const QueryOptimizer = {
  /**
   * Create optimized where clause for date range queries
   */
  dateRangeWhere(field: string, start: Date, end: Date) {
    return {
      [field]: {
        gte: start,
        lte: end,
      },
    };
  },

  /**
   * Create optimized where clause for text search
   */
  textSearchWhere(fields: string[], searchTerm: string) {
    return {
      OR: fields.map(field => ({
        [field]: {
          contains: searchTerm,
          mode: 'insensitive',
        },
      })),
    };
  },

  /**
   * Create optimized pagination args
   */
  paginationArgs(page: number, pageSize: number = 20) {
    return {
      skip: (page - 1) * pageSize,
      take: pageSize,
    };
  },

  /**
   * Create cursor-based pagination args
   */
  cursorPaginationArgs(cursor?: string, pageSize: number = 20) {
    return {
      take: pageSize,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
    };
  },

  /**
   * Create optimized select for list views
   */
  listViewSelect<T>(fields: (keyof T)[]) {
    return fields.reduce(
      (acc, field) => {
        acc[field as string] = true;
        return acc;
      },
      {} as Record<string, boolean>
    );
  },
};
