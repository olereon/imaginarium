/**
 * Core repository system exports
 */

// Base repository classes
export * from './base.repository.js';

// Database and connection management
export * from './database-manager.js';

// Cache management
export * from './cache-manager.js';

// Batch operations
export * from './batch-operations.js';

// Error handling
export * from './errors.js';

// Testing utilities
export * from './testing-utils.js';

// Type exports
export type { RepositoryConfig, QueryMetrics, AuditContext } from './base.repository.js';

export type { DatabaseConfig, ConnectionMetrics, TransactionOptions } from './database-manager.js';

export type { CacheConfig, CacheMetrics, CacheOperation } from './cache-manager.js';

export type { BatchConfig, BatchProgress, BatchOperation } from './batch-operations.js';

export type { ErrorDetails, ValidationErrorDetail } from './errors.js';
