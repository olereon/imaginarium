/**
 * Repository interfaces index
 */

// Base interfaces
export * from './base.interface.js'

// Specific repository interfaces
export * from './user.interface.js'
export * from './pipeline.interface.js'
export * from './execution.interface.js'
export * from './file.interface.js'

// Re-export key types for convenience
export type {
  PaginationOptions,
  PaginatedResult,
  FilterOptions,
  SoftDeleteOptions,
  BulkOperationResult,
  TransactionContext,
  IBaseRepository,
  ISoftDeleteRepository,
  IRepositoryFactory
} from './base.interface.js'

export type {
  IUserRepository,
  CreateUserInput,
  UpdateUserInput,
  UserWithRelations,
  UserStats,
  UserActivity,
  UserPreferences
} from './user.interface.js'

export type {
  IPipelineRepository,
  CreatePipelineInput,
  UpdatePipelineInput,
  PipelineWithRelations,
  PipelineStats,
  PipelineConfiguration,
  PipelineSearchOptions
} from './pipeline.interface.js'

export type {
  IExecutionRepository,
  CreatePipelineRunInput,
  UpdatePipelineRunInput,
  CreateTaskExecutionInput,
  UpdateTaskExecutionInput,
  CreateExecutionLogInput,
  ExecutionWithRelations,
  TaskExecutionWithRelations,
  ExecutionStats,
  ExecutionMetrics,
  ExecutionSearchOptions
} from './execution.interface.js'

export type {
  IFileRepository,
  CreateFileUploadInput,
  UpdateFileUploadInput,
  CreateArtifactInput,
  UpdateArtifactInput,
  CreateFileReferenceInput,
  UpdateFileReferenceInput,
  FileWithRelations,
  ArtifactWithRelations,
  FileStats,
  StorageStats,
  FileSearchOptions,
  ArtifactSearchOptions
} from './file.interface.js'