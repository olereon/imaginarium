/**
 * Database Manager for connection pooling, transaction management, and monitoring
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger } from '../../utils/logger.js';

export interface DatabaseConfig {
  connectionString?: string;
  maxConnections?: number;
  connectionTimeout?: number;
  queryTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  enableQueryLogging?: boolean;
  enableSlowQueryLogging?: boolean;
  slowQueryThreshold?: number;
}

export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  totalQueries: number;
  slowQueries: number;
  errors: number;
  uptime: number;
}

export interface TransactionOptions {
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
  maxWait?: number;
}

export class DatabaseManager extends EventEmitter {
  private static instance: DatabaseManager;
  private client: PrismaClient;
  private logger: Logger;
  private config: DatabaseConfig;
  private metrics: ConnectionMetrics;
  private startTime: Date;
  private transactionCount = 0;
  private connectionPool: Map<string, PrismaClient> = new Map();

  private constructor(config: DatabaseConfig = {}) {
    super();
    this.config = {
      maxConnections: 10,
      connectionTimeout: 10000,
      queryTimeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      enableQueryLogging: process.env.NODE_ENV === 'development',
      enableSlowQueryLogging: true,
      slowQueryThreshold: 1000,
      ...config,
    };

    this.logger = createLogger('DatabaseManager');
    this.startTime = new Date();
    this.initializeMetrics();
    this.createClient();
    this.setupEventHandlers();
  }

  public static getInstance(config?: DatabaseConfig): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(config);
    }
    return DatabaseManager.instance;
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): void {
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingConnections: 0,
      totalQueries: 0,
      slowQueries: 0,
      errors: 0,
      uptime: 0,
    };
  }

  /**
   * Create Prisma client with optimized configuration
   */
  private createClient(): void {
    this.client = new PrismaClient({
      log: this.buildLogConfig(),
      datasources: {
        db: {
          url: this.config.connectionString || process.env.DATABASE_URL,
        },
      },
    });

    // Add query middleware for monitoring
    this.client.$use(async (params, next) => {
      const start = Date.now();

      try {
        this.metrics.totalQueries++;
        this.emit('query:start', params);

        const result = await next(params);
        const duration = Date.now() - start;

        if (duration > this.config.slowQueryThreshold!) {
          this.metrics.slowQueries++;
          this.emit('query:slow', params, duration);

          if (this.config.enableSlowQueryLogging) {
            this.logger.warn('Slow query detected', {
              model: params.model,
              action: params.action,
              duration,
              args: params.args,
            });
          }
        }

        this.emit('query:end', params, duration);
        return result;
      } catch (error) {
        this.metrics.errors++;
        this.emit('query:error', params, error);
        throw error;
      }
    });
  }

  /**
   * Build log configuration based on environment
   */
  private buildLogConfig(): Prisma.LogLevel[] {
    const logConfig: Prisma.LogLevel[] = ['error'];

    if (this.config.enableQueryLogging) {
      logConfig.push('query', 'info', 'warn');
    }

    return logConfig;
  }

  /**
   * Setup event handlers for monitoring
   */
  private setupEventHandlers(): void {
    this.on('query:slow', (params: any, duration: number) => {
      this.logger.warn('Slow query detected', {
        model: params.model,
        action: params.action,
        duration,
        threshold: this.config.slowQueryThreshold,
      });
    });

    this.on('query:error', (params: any, error: Error) => {
      this.logger.error('Query error', {
        model: params.model,
        action: params.action,
        error: error.message,
        stack: error.stack,
      });
    });

    this.on('transaction:start', (id: string) => {
      this.transactionCount++;
      this.logger.debug('Transaction started', { id, active: this.transactionCount });
    });

    this.on('transaction:end', (id: string, success: boolean) => {
      this.transactionCount--;
      this.logger.debug('Transaction ended', { id, success, active: this.transactionCount });
    });
  }

  /**
   * Get the main Prisma client
   */
  getClient(): PrismaClient {
    return this.client;
  }

  /**
   * Execute operation with connection retry
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'unknown'
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.retryAttempts!; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === this.config.retryAttempts) {
          this.logger.error(`Operation ${operationName} failed after ${attempt} attempts`, {
            error: lastError.message,
          });
          throw lastError;
        }

        const isRetryableError = this.isRetryableError(lastError);
        if (!isRetryableError) {
          throw lastError;
        }

        const delay = this.config.retryDelay! * attempt;
        this.logger.warn(`Operation ${operationName} failed, retrying in ${delay}ms`, {
          attempt,
          error: lastError.message,
        });

        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'Connection terminated',
      'Connection lost',
      'Server has gone away',
    ];

    return retryableErrors.some(
      pattern => error.message.includes(pattern) || error.name.includes(pattern)
    );
  }

  /**
   * Execute transaction with comprehensive error handling and monitoring
   */
  async executeTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    this.emit('transaction:start', transactionId);
    this.logger.debug('Starting transaction', { transactionId, options });

    try {
      const result = await this.executeWithRetry(async () => {
        return await this.client.$transaction(fn, {
          timeout: options.timeout || this.config.queryTimeout,
          isolationLevel: options.isolationLevel,
          maxWait: options.maxWait || this.config.connectionTimeout,
        });
      }, `transaction:${transactionId}`);

      const duration = Date.now() - startTime;
      this.emit('transaction:end', transactionId, true);
      this.logger.debug('Transaction completed successfully', {
        transactionId,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.emit('transaction:end', transactionId, false);
      this.logger.error('Transaction failed', {
        transactionId,
        duration,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Execute raw SQL query with error handling
   */
  async executeRaw<T = any>(query: string, params: any[] = []): Promise<T[]> {
    this.logger.debug('Executing raw query', { query, params });

    return await this.executeWithRetry(async () => {
      return (await this.client.$queryRaw`${Prisma.raw(query)}`) as T[];
    }, 'raw-query');
  }

  /**
   * Execute raw SQL (non-query) with error handling
   */
  async executeRawUnsafe(sql: string): Promise<number> {
    this.logger.debug('Executing raw unsafe SQL', { sql });

    return await this.executeWithRetry(async () => {
      return await this.client.$executeRaw`${Prisma.raw(sql)}`;
    }, 'raw-execute');
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency: number;
    error?: string;
  }> {
    const start = Date.now();

    try {
      await this.client.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;

      return {
        status: 'healthy',
        latency,
      };
    } catch (error) {
      const latency = Date.now() - start;

      return {
        status: 'unhealthy',
        latency,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get current database metrics
   */
  getMetrics(): ConnectionMetrics {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime.getTime(),
      activeConnections: this.transactionCount,
    };
  }

  /**
   * Get detailed connection pool statistics
   */
  async getPoolStats(): Promise<any> {
    try {
      // This would require database-specific queries
      // For SQLite, we can't get pool stats, but for PostgreSQL we could use pg_stat_activity
      const healthCheck = await this.healthCheck();

      return {
        ...this.getMetrics(),
        health: healthCheck,
        configuration: {
          maxConnections: this.config.maxConnections,
          connectionTimeout: this.config.connectionTimeout,
          queryTimeout: this.config.queryTimeout,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get pool stats', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.initializeMetrics();
    this.startTime = new Date();
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down database manager');

    try {
      // Wait for active transactions to complete (with timeout)
      const shutdownTimeout = 30000; // 30 seconds
      const startTime = Date.now();

      while (this.transactionCount > 0 && Date.now() - startTime < shutdownTimeout) {
        this.logger.info(`Waiting for ${this.transactionCount} active transactions to complete`);
        await this.sleep(1000);
      }

      if (this.transactionCount > 0) {
        this.logger.warn(`Forcing shutdown with ${this.transactionCount} active transactions`);
      }

      await this.client.$disconnect();
      this.removeAllListeners();

      this.logger.info('Database manager shutdown complete');
    } catch (error) {
      this.logger.error('Error during database shutdown', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Create a dedicated connection for long-running operations
   */
  async createDedicatedConnection(name: string): Promise<PrismaClient> {
    if (this.connectionPool.has(name)) {
      throw new Error(`Connection with name ${name} already exists`);
    }

    const client = new PrismaClient({
      log: this.buildLogConfig(),
      datasources: {
        db: {
          url: this.config.connectionString || process.env.DATABASE_URL,
        },
      },
    });

    this.connectionPool.set(name, client);
    this.logger.debug('Created dedicated connection', { name });

    return client;
  }

  /**
   * Release dedicated connection
   */
  async releaseDedicatedConnection(name: string): Promise<void> {
    const client = this.connectionPool.get(name);
    if (!client) {
      throw new Error(`Connection with name ${name} not found`);
    }

    await client.$disconnect();
    this.connectionPool.delete(name);
    this.logger.debug('Released dedicated connection', { name });
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Monitor query performance and log slow queries
   */
  startPerformanceMonitoring(): void {
    const interval = setInterval(() => {
      const metrics = this.getMetrics();

      if (metrics.slowQueries > 0) {
        this.logger.warn('Performance alert', {
          slowQueries: metrics.slowQueries,
          totalQueries: metrics.totalQueries,
          slowQueryRate: (metrics.slowQueries / metrics.totalQueries) * 100,
          threshold: this.config.slowQueryThreshold,
        });
      }

      // Reset counters for next interval
      this.metrics.slowQueries = 0;
      this.metrics.totalQueries = 0;
      this.metrics.errors = 0;
    }, 60000); // Every minute

    // Clean up on shutdown
    this.once('shutdown', () => clearInterval(interval));
  }
}
