/**
 * Repository exports
 */

// Core repository system
export * from './core/index.js';

// Repository interfaces
export * from './interfaces/index.js';

// Repository factory
export * from './factory.js';

// Base repository implementations
export * from './base.repository.js';
export * from './enhanced-base.repository.js';
export * from './soft-delete.repository.js';

// Enhanced repository implementations
export * from './enhanced-user.repository.js';

// Legacy repository implementations
export * from './user.repository.js';
export * from './pipeline.repository.js';
export * from './execution-log.repository.js';
export * from './pipeline-run.repository.js';
export * from './pipeline-version.repository.js';
export * from './task-execution.repository.js';

// Repository instances for dependency injection
export { UserRepository } from './user.repository.js';
export { PipelineRepository } from './pipeline.repository.js';
export { EnhancedUserRepository } from './enhanced-user.repository.js';

// Factory instance
export {
  repositoryFactory,
  withTransaction,
  getUserRepository,
  getPipelineRepository,
  getExecutionRepository,
  getFileRepository,
} from './factory.js';

// Core utilities
export { DatabaseManager } from './core/database-manager.js';
export { CacheManager } from './core/cache-manager.js';
export {
  BatchOperationManager,
  defaultBatchManager,
  batchOperations,
} from './core/batch-operations.js';
export { ErrorFactory, ErrorMatcher } from './core/errors.js';
export { testUtils } from './core/testing-utils.js';
