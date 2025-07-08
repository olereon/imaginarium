/**
 * Execution repository interface with execution-specific operations
 */

import type { 
  PipelineRun, 
  TaskExecution, 
  ExecutionLog, 
  ExecutionStatus, 
  LogLevel,
  Artifact 
} from '@prisma/client'
import type { 
  IBaseRepository, 
  FilterOptions, 
  PaginatedResult, 
  TransactionContext,
  BulkOperationResult 
} from './base.interface.js'

// Execution-specific types
export interface CreatePipelineRunInput {
  pipelineId: string
  userId: string
  inputs?: string | object
  configuration: string | object
  context?: string | object
  priority?: number
  scheduledFor?: Date
  timeoutAt?: Date
  retryStrategy?: string | object
  environment?: string | object
  version?: string
}

export interface UpdatePipelineRunInput {
  status?: ExecutionStatus
  outputs?: string | object
  context?: string | object
  duration?: number
  tokensUsed?: number
  estimatedCost?: number
  actualCost?: number
  memoryUsage?: number
  cpuTime?: number
  error?: string | object
  retryCount?: number
  failureReason?: string
  progress?: number
  currentTaskId?: string
  totalTasks?: number
  completedTasks?: number
  executorId?: string
  environment?: string | object
  startedAt?: Date
  completedAt?: Date
}

export interface CreateTaskExecutionInput {
  runId: string
  nodeId: string
  nodeName: string
  nodeType: string
  inputs?: string | object
  configuration: string | object
  executionOrder: number
  dependencies?: string | object
  dependents?: string | object
  maxRetries?: number
  retryDelay?: number
  timeoutAt?: Date
  cacheKey?: string
}

export interface UpdateTaskExecutionInput {
  status?: ExecutionStatus
  outputs?: string | object
  duration?: number
  tokensUsed?: number
  cost?: number
  memoryUsage?: number
  cpuTime?: number
  error?: string | object
  retryCount?: number
  failureReason?: string
  progress?: number
  state?: string | object
  checkpoint?: string | object
  executorId?: string
  workerId?: string
  startedAt?: Date
  completedAt?: Date
  cached?: boolean
}

export interface CreateExecutionLogInput {
  runId: string
  taskId?: string
  level: LogLevel
  message: string
  metadata?: string | object
  category?: string
  source?: string
  correlationId?: string
  sequenceNumber?: number
  streamId?: string
  errorCode?: string
  stackTrace?: string
  duration?: number
  memorySnapshot?: number
}

export interface ExecutionWithRelations extends PipelineRun {
  pipeline?: any
  user?: any
  tasks?: TaskExecution[]
  logs?: ExecutionLog[]
  artifacts?: Artifact[]
}

export interface TaskExecutionWithRelations extends TaskExecution {
  run?: PipelineRun
  logs?: ExecutionLog[]
  artifacts?: Artifact[]
}

export interface ExecutionStats {
  totalRuns: number
  successfulRuns: number
  failedRuns: number
  runningRuns: number
  queuedRuns: number
  successRate: number
  avgDuration: number
  totalCost: number
  avgCost: number
  totalTokensUsed: number
  avgTokensUsed: number
  peakMemoryUsage: number
  totalCpuTime: number
}

export interface ExecutionMetrics {
  runId: string
  totalTasks: number
  completedTasks: number
  failedTasks: number
  progress: number
  duration: number
  estimatedTimeRemaining: number
  throughput: number
  errorRate: number
  resourceUtilization: {
    cpu: number
    memory: number
    network: number
  }
}

export interface ExecutionSearchOptions {
  userId?: string
  pipelineId?: string
  status?: ExecutionStatus[]
  dateRange?: {
    from?: Date
    to?: Date
  }
  executorId?: string
  hasErrors?: boolean
  minDuration?: number
  maxDuration?: number
  minCost?: number
  maxCost?: number
}

// Execution repository interface
export interface IExecutionRepository extends IBaseRepository<PipelineRun, CreatePipelineRunInput, UpdatePipelineRunInput> {
  // Pipeline run operations
  findByPipelineId(pipelineId: string, context?: TransactionContext): Promise<PipelineRun[]>
  findByUserId(userId: string, context?: TransactionContext): Promise<PipelineRun[]>
  findByStatus(status: ExecutionStatus, context?: TransactionContext): Promise<PipelineRun[]>
  findRunning(context?: TransactionContext): Promise<PipelineRun[]>
  findQueued(context?: TransactionContext): Promise<PipelineRun[]>
  findFailed(context?: TransactionContext): Promise<PipelineRun[]>
  
  // Execution lifecycle
  startExecution(id: string, context?: TransactionContext): Promise<PipelineRun>
  completeExecution(id: string, outputs?: any, context?: TransactionContext): Promise<PipelineRun>
  failExecution(id: string, error: string | object, context?: TransactionContext): Promise<PipelineRun>
  cancelExecution(id: string, context?: TransactionContext): Promise<PipelineRun>
  pauseExecution(id: string, context?: TransactionContext): Promise<PipelineRun>
  resumeExecution(id: string, context?: TransactionContext): Promise<PipelineRun>
  
  // Progress tracking
  updateProgress(id: string, progress: number, context?: TransactionContext): Promise<PipelineRun>
  updateTaskProgress(id: string, taskId: string, completedTasks: number, context?: TransactionContext): Promise<PipelineRun>
  getCurrentTask(id: string, context?: TransactionContext): Promise<TaskExecution | null>
  
  // Retry management
  canRetry(id: string, context?: TransactionContext): Promise<boolean>
  incrementRetryCount(id: string, context?: TransactionContext): Promise<PipelineRun>
  scheduleRetry(id: string, delay: number, context?: TransactionContext): Promise<PipelineRun>
  
  // Task execution operations
  createTaskExecution(data: CreateTaskExecutionInput, context?: TransactionContext): Promise<TaskExecution>
  updateTaskExecution(id: string, data: UpdateTaskExecutionInput, context?: TransactionContext): Promise<TaskExecution>
  findTasksByRunId(runId: string, context?: TransactionContext): Promise<TaskExecution[]>
  findTaskById(id: string, context?: TransactionContext): Promise<TaskExecution | null>
  findTasksByStatus(status: ExecutionStatus, context?: TransactionContext): Promise<TaskExecution[]>
  
  // Task lifecycle
  startTask(id: string, context?: TransactionContext): Promise<TaskExecution>
  completeTask(id: string, outputs?: any, context?: TransactionContext): Promise<TaskExecution>
  failTask(id: string, error: string | object, context?: TransactionContext): Promise<TaskExecution>
  
  // Dependencies and ordering
  findReadyTasks(runId: string, context?: TransactionContext): Promise<TaskExecution[]>
  findDependencies(taskId: string, context?: TransactionContext): Promise<TaskExecution[]>
  findDependents(taskId: string, context?: TransactionContext): Promise<TaskExecution[]>
  canExecuteTask(taskId: string, context?: TransactionContext): Promise<boolean>
  
  // Logging
  createLog(data: CreateExecutionLogInput, context?: TransactionContext): Promise<ExecutionLog>
  findLogsByRunId(runId: string, context?: TransactionContext): Promise<ExecutionLog[]>
  findLogsByTaskId(taskId: string, context?: TransactionContext): Promise<ExecutionLog[]>
  findLogsByLevel(level: LogLevel, context?: TransactionContext): Promise<ExecutionLog[]>
  streamLogs(
    runId: string,
    options?: {
      level?: LogLevel
      category?: string
      since?: Date
      follow?: boolean
    },
    context?: TransactionContext
  ): Promise<AsyncIterable<ExecutionLog>>
  
  // Relationships
  findWithTasks(id: string, context?: TransactionContext): Promise<ExecutionWithRelations | null>
  findWithLogs(id: string, context?: TransactionContext): Promise<ExecutionWithRelations | null>
  findWithArtifacts(id: string, context?: TransactionContext): Promise<ExecutionWithRelations | null>
  findTaskWithLogs(id: string, context?: TransactionContext): Promise<TaskExecutionWithRelations | null>
  
  // Search and filtering
  searchExecutions(options: ExecutionSearchOptions, context?: TransactionContext): Promise<PipelineRun[]>
  findExecutionsInDateRange(from: Date, to: Date, context?: TransactionContext): Promise<PipelineRun[]>
  findLongRunningExecutions(minDuration: number, context?: TransactionContext): Promise<PipelineRun[]>
  findHighCostExecutions(minCost: number, context?: TransactionContext): Promise<PipelineRun[]>
  
  // Analytics and statistics
  getExecutionStats(
    options?: {
      userId?: string
      pipelineId?: string
      dateRange?: { from?: Date; to?: Date }
    },
    context?: TransactionContext
  ): Promise<ExecutionStats>
  
  getExecutionMetrics(id: string, context?: TransactionContext): Promise<ExecutionMetrics>
  
  getPerformanceMetrics(
    options?: {
      pipelineId?: string
      dateRange?: { from?: Date; to?: Date }
      granularity?: 'hour' | 'day' | 'week'
    },
    context?: TransactionContext
  ): Promise<any[]>
  
  // Queue management
  getQueueStatus(context?: TransactionContext): Promise<{
    queued: number
    running: number
    failed: number
    avgWaitTime: number
    avgExecutionTime: number
  }>
  
  findNextInQueue(context?: TransactionContext): Promise<PipelineRun | null>
  prioritizeExecution(id: string, priority: number, context?: TransactionContext): Promise<PipelineRun>
  
  // Resource management
  getResourceUsage(
    options?: {
      dateRange?: { from?: Date; to?: Date }
      granularity?: 'hour' | 'day' | 'week'
    },
    context?: TransactionContext
  ): Promise<any[]>
  
  // Cleanup and maintenance
  cleanupOldExecutions(daysToKeep: number, context?: TransactionContext): Promise<number>
  cleanupLogs(daysToKeep: number, context?: TransactionContext): Promise<number>
  archiveCompletedExecutions(daysToArchive: number, context?: TransactionContext): Promise<number>
  
  // Monitoring and alerts
  findStuckExecutions(timeoutMinutes: number, context?: TransactionContext): Promise<PipelineRun[]>
  findFailingPipelines(
    options?: {
      minFailureRate?: number
      timeRange?: { from?: Date; to?: Date }
    },
    context?: TransactionContext
  ): Promise<any[]>
  
  // Export and reporting
  exportExecutionData(
    options?: {
      runId?: string
      pipelineId?: string
      dateRange?: { from?: Date; to?: Date }
      format?: 'json' | 'csv' | 'xlsx'
    },
    context?: TransactionContext
  ): Promise<any>
  
  // Bulk operations
  bulkUpdateStatus(runIds: string[], status: ExecutionStatus, context?: TransactionContext): Promise<BulkOperationResult>
  bulkCancel(runIds: string[], context?: TransactionContext): Promise<BulkOperationResult>
  bulkRetry(runIds: string[], context?: TransactionContext): Promise<BulkOperationResult>
  
  // Caching
  findCachedResult(cacheKey: string, context?: TransactionContext): Promise<TaskExecution | null>
  setCachedResult(taskId: string, cacheKey: string, context?: TransactionContext): Promise<TaskExecution>
  
  // Execution context
  getExecutionContext(id: string, context?: TransactionContext): Promise<any>
  updateExecutionContext(id: string, contextData: any, context?: TransactionContext): Promise<PipelineRun>
  
  // Checkpointing
  createCheckpoint(taskId: string, checkpointData: any, context?: TransactionContext): Promise<TaskExecution>
  restoreFromCheckpoint(taskId: string, context?: TransactionContext): Promise<TaskExecution>
  
  // Real-time updates
  subscribeToExecutionUpdates(runId: string): Promise<AsyncIterable<PipelineRun>>
  subscribeToTaskUpdates(taskId: string): Promise<AsyncIterable<TaskExecution>>
}