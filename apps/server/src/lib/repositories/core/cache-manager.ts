/**
 * Cache Manager for Redis-based caching with connection pooling and monitoring
 */

import Redis, { RedisOptions, Cluster } from 'ioredis'
import { EventEmitter } from 'events'
import { Logger } from 'winston'
import { createLogger } from '../../utils/logger.js'

export interface CacheConfig {
  redis: {
    host?: string
    port?: number
    password?: string
    db?: number
    keyPrefix?: string
    cluster?: Array<{ host: string; port: number }>
    maxRetriesPerRequest?: number
    retryDelayOnFailover?: number
    lazyConnect?: boolean
    connectTimeout?: number
    commandTimeout?: number
  }
  defaultTTL?: number
  enableCompression?: boolean
  compressionThreshold?: number
  maxValueSize?: number
  enableMetrics?: boolean
}

export interface CacheMetrics {
  hits: number
  misses: number
  sets: number
  deletes: number
  errors: number
  totalOperations: number
  hitRate: number
  errorRate: number
  avgResponseTime: number
  memoryUsage?: number
  keyCount?: number
}

export interface CacheOperation {
  operation: string
  key: string
  duration: number
  success: boolean
  error?: string
}

export class CacheManager extends EventEmitter {
  private static instance: CacheManager
  private client: Redis | Cluster
  private logger: Logger
  private config: CacheConfig
  private metrics: CacheMetrics
  private operationHistory: CacheOperation[] = []
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10

  private constructor(config: CacheConfig) {
    super()
    this.config = {
      defaultTTL: 300, // 5 minutes
      enableCompression: true,
      compressionThreshold: 1024, // 1KB
      maxValueSize: 1024 * 1024, // 1MB
      enableMetrics: true,
      ...config
    }

    this.logger = createLogger('CacheManager')
    this.initializeMetrics()
    this.createClient()
    this.setupEventHandlers()
  }

  public static getInstance(config?: CacheConfig): CacheManager {
    if (!CacheManager.instance) {
      if (!config) {
        // Default configuration
        config = {
          redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
            keyPrefix: process.env.REDIS_KEY_PREFIX || 'imaginarium:',
            maxRetriesPerRequest: 3,
            retryDelayOnFailover: 100,
            lazyConnect: true,
            connectTimeout: 10000,
            commandTimeout: 5000
          }
        }
      }
      CacheManager.instance = new CacheManager(config)
    }
    return CacheManager.instance
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      totalOperations: 0,
      hitRate: 0,
      errorRate: 0,
      avgResponseTime: 0
    }
  }

  /**
   * Create Redis client (single instance or cluster)
   */
  private createClient(): void {
    try {
      const redisConfig: RedisOptions = {
        host: this.config.redis.host,
        port: this.config.redis.port,
        password: this.config.redis.password,
        db: this.config.redis.db,
        keyPrefix: this.config.redis.keyPrefix,
        maxRetriesPerRequest: this.config.redis.maxRetriesPerRequest,
        retryDelayOnFailover: this.config.redis.retryDelayOnFailover,
        lazyConnect: this.config.redis.lazyConnect,
        connectTimeout: this.config.redis.connectTimeout,
        commandTimeout: this.config.redis.commandTimeout,
        family: 4, // IPv4
        keepAlive: true,
        reconnectOnError: (err) => {
          const targetError = 'READONLY'
          return err.message.includes(targetError)
        }
      }

      if (this.config.redis.cluster && this.config.redis.cluster.length > 0) {
        // Create cluster client
        this.client = new Redis.Cluster(this.config.redis.cluster, {
          redisOptions: redisConfig,
          enableOfflineQueue: false,
          maxRetriesPerRequest: this.config.redis.maxRetriesPerRequest
        })
        this.logger.info('Initialized Redis cluster client')
      } else {
        // Create single instance client
        this.client = new Redis(redisConfig)
        this.logger.info('Initialized Redis single instance client')
      }

    } catch (error) {
      this.logger.error('Failed to create Redis client', { 
        error: (error as Error).message 
      })
      throw error
    }
  }

  /**
   * Setup event handlers for monitoring and reconnection
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.isConnected = true
      this.reconnectAttempts = 0
      this.logger.info('Redis client connected')
      this.emit('connected')
    })

    this.client.on('ready', () => {
      this.logger.info('Redis client ready')
      this.emit('ready')
    })

    this.client.on('error', (error) => {
      this.metrics.errors++
      this.isConnected = false
      this.logger.error('Redis client error', { error: error.message })
      this.emit('error', error)
    })

    this.client.on('close', () => {
      this.isConnected = false
      this.logger.warn('Redis client connection closed')
      this.emit('disconnected')
    })

    this.client.on('reconnecting', (delay) => {
      this.reconnectAttempts++
      this.logger.info('Redis client reconnecting', { 
        attempt: this.reconnectAttempts,
        delay 
      })
      
      if (this.reconnectAttempts > this.maxReconnectAttempts) {
        this.logger.error('Max reconnection attempts reached')
        this.client.disconnect()
      }
    })

    // Performance monitoring
    if (this.config.enableMetrics) {
      this.startMetricsCollection()
    }
  }

  /**
   * Record operation metrics
   */
  private recordOperation(operation: CacheOperation): void {
    if (!this.config.enableMetrics) return

    this.operationHistory.push(operation)
    
    // Keep only last 1000 operations
    if (this.operationHistory.length > 1000) {
      this.operationHistory.shift()
    }

    // Update metrics
    this.metrics.totalOperations++
    
    if (operation.success) {
      switch (operation.operation) {
        case 'get':
          // Hit/miss is determined by caller
          break
        case 'set':
          this.metrics.sets++
          break
        case 'del':
          this.metrics.deletes++
          break
      }
    } else {
      this.metrics.errors++
    }

    this.updateDerivedMetrics()
  }

  /**
   * Update derived metrics
   */
  private updateDerivedMetrics(): void {
    const total = this.metrics.hits + this.metrics.misses
    this.metrics.hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0
    this.metrics.errorRate = this.metrics.totalOperations > 0 
      ? (this.metrics.errors / this.metrics.totalOperations) * 100 
      : 0

    const recentOperations = this.operationHistory.slice(-100)
    if (recentOperations.length > 0) {
      const totalTime = recentOperations.reduce((sum, op) => sum + op.duration, 0)
      this.metrics.avgResponseTime = totalTime / recentOperations.length
    }
  }

  /**
   * Execute operation with metrics and error handling
   */
  private async executeWithMetrics<T>(
    operation: string,
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now()
    let success = true
    let error: string | undefined

    try {
      const result = await fn()
      return result
    } catch (err) {
      success = false
      error = (err as Error).message
      throw err
    } finally {
      const duration = Date.now() - startTime
      this.recordOperation({
        operation,
        key,
        duration,
        success,
        error
      })
    }
  }

  /**
   * Serialize value with optional compression
   */
  private serializeValue(value: any): string {
    let serialized = JSON.stringify(value)
    
    if (this.config.enableCompression && 
        serialized.length > this.config.compressionThreshold!) {
      // Simple compression simulation (in real implementation, use gzip)
      serialized = `compressed:${serialized}`
    }
    
    if (serialized.length > this.config.maxValueSize!) {
      throw new Error(`Value too large: ${serialized.length} bytes (max: ${this.config.maxValueSize})`)
    }
    
    return serialized
  }

  /**
   * Deserialize value with optional decompression
   */
  private deserializeValue(serialized: string): any {
    if (serialized.startsWith('compressed:')) {
      // Simple decompression simulation
      serialized = serialized.substring(11)
    }
    
    return JSON.parse(serialized)
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      this.logger.warn('Cache get attempted while disconnected', { key })
      return null
    }

    return await this.executeWithMetrics('get', key, async () => {
      const value = await this.client.get(key)
      
      if (value === null) {
        this.metrics.misses++
        return null
      }
      
      this.metrics.hits++
      return this.deserializeValue(value)
    })
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Cache set attempted while disconnected', { key })
      return
    }

    return await this.executeWithMetrics('set', key, async () => {
      const serialized = this.serializeValue(value)
      const cacheTTL = ttl || this.config.defaultTTL!
      
      await this.client.setex(key, cacheTTL, serialized)
    })
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isConnected) {
      this.logger.warn('Cache delete attempted while disconnected', { key })
      return false
    }

    return await this.executeWithMetrics('del', key, async () => {
      const result = await this.client.del(key)
      return result > 0
    })
  }

  /**
   * Delete multiple keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.isConnected) {
      this.logger.warn('Cache deletePattern attempted while disconnected', { pattern })
      return 0
    }

    return await this.executeWithMetrics('delPattern', pattern, async () => {
      const keys = await this.client.keys(pattern)
      if (keys.length === 0) return 0
      
      const result = await this.client.del(...keys)
      return result
    })
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false
    }

    return await this.executeWithMetrics('exists', key, async () => {
      const result = await this.client.exists(key)
      return result === 1
    })
  }

  /**
   * Set expiration for key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    if (!this.isConnected) {
      return false
    }

    return await this.executeWithMetrics('expire', key, async () => {
      const result = await this.client.expire(key, ttl)
      return result === 1
    })
  }

  /**
   * Get time to live for key
   */
  async ttl(key: string): Promise<number> {
    if (!this.isConnected) {
      return -2
    }

    return await this.executeWithMetrics('ttl', key, async () => {
      return await this.client.ttl(key)
    })
  }

  /**
   * Increment numeric value
   */
  async increment(key: string, amount = 1): Promise<number> {
    if (!this.isConnected) {
      throw new Error('Cache not connected')
    }

    return await this.executeWithMetrics('incr', key, async () => {
      if (amount === 1) {
        return await this.client.incr(key)
      } else {
        return await this.client.incrby(key, amount)
      }
    })
  }

  /**
   * Set if not exists
   */
  async setIfNotExists<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    if (!this.isConnected) {
      return false
    }

    return await this.executeWithMetrics('setnx', key, async () => {
      const serialized = this.serializeValue(value)
      const cacheTTL = ttl || this.config.defaultTTL!
      
      const result = await this.client.set(key, serialized, 'EX', cacheTTL, 'NX')
      return result === 'OK'
    })
  }

  /**
   * Get multiple keys at once
   */
  async getMultiple<T>(keys: string[]): Promise<Map<string, T | null>> {
    if (!this.isConnected || keys.length === 0) {
      return new Map()
    }

    return await this.executeWithMetrics('mget', keys.join(','), async () => {
      const values = await this.client.mget(...keys)
      const result = new Map<string, T | null>()
      
      keys.forEach((key, index) => {
        const value = values[index]
        if (value !== null) {
          this.metrics.hits++
          result.set(key, this.deserializeValue(value))
        } else {
          this.metrics.misses++
          result.set(key, null)
        }
      })
      
      return result
    })
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics }
  }

  /**
   * Get Redis info
   */
  async getRedisInfo(): Promise<any> {
    if (!this.isConnected) {
      return null
    }

    try {
      const info = await this.client.info()
      return this.parseRedisInfo(info)
    } catch (error) {
      this.logger.error('Failed to get Redis info', { 
        error: (error as Error).message 
      })
      return null
    }
  }

  /**
   * Parse Redis INFO command output
   */
  private parseRedisInfo(info: string): any {
    const sections: any = {}
    let currentSection = 'default'
    
    info.split('\r\n').forEach(line => {
      if (line.startsWith('# ')) {
        currentSection = line.substring(2).toLowerCase()
        sections[currentSection] = {}
      } else if (line.includes(':')) {
        const [key, value] = line.split(':')
        if (!sections[currentSection]) {
          sections[currentSection] = {}
        }
        sections[currentSection][key] = value
      }
    })
    
    return sections
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy'
    latency: number
    error?: string
  }> {
    const start = Date.now()
    
    try {
      await this.client.ping()
      const latency = Date.now() - start
      
      return {
        status: 'healthy',
        latency
      }
    } catch (error) {
      const latency = Date.now() - start
      
      return {
        status: 'unhealthy',
        latency,
        error: (error as Error).message
      }
    }
  }

  /**
   * Start collecting detailed metrics
   */
  private startMetricsCollection(): void {
    const interval = setInterval(async () => {
      try {
        const info = await this.getRedisInfo()
        if (info && info.memory) {
          this.metrics.memoryUsage = parseInt(info.memory.used_memory || '0')
        }
        if (info && info.keyspace) {
          // Parse keyspace info to get key count
          const dbInfo = info.keyspace[`db${this.config.redis.db || 0}`]
          if (dbInfo) {
            const keyMatch = dbInfo.match(/keys=(\d+)/)
            this.metrics.keyCount = keyMatch ? parseInt(keyMatch[1]) : 0
          }
        }
      } catch (error) {
        this.logger.warn('Failed to collect Redis metrics', { 
          error: (error as Error).message 
        })
      }
    }, 30000) // Every 30 seconds

    // Clean up on shutdown
    this.once('shutdown', () => clearInterval(interval))
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.initializeMetrics()
    this.operationHistory = []
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down cache manager')
    
    try {
      this.emit('shutdown')
      await this.client.quit()
      this.removeAllListeners()
      this.logger.info('Cache manager shutdown complete')
    } catch (error) {
      this.logger.error('Error during cache shutdown', { 
        error: (error as Error).message 
      })
      throw error
    }
  }

  /**
   * Get connection status
   */
  isConnectionHealthy(): boolean {
    return this.isConnected
  }

  /**
   * Force reconnection
   */
  async reconnect(): Promise<void> {
    this.logger.info('Forcing cache reconnection')
    await this.client.disconnect()
    await this.client.connect()
  }
}