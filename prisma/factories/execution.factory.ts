/**
 * Execution factory for generating test pipeline executions
 */

import { PipelineRun, TaskExecution, ExecutionLog, ExecutionStatus, LogLevel } from '@prisma/client'
import { BaseFactory, generateId, generateLoremText } from './index'
import type { ExecutionCreateInput, TaskExecutionCreateInput, ExecutionLogCreateInput, FactoryConfig } from './types'

export class ExecutionFactory extends BaseFactory<PipelineRun> {
  constructor(config: FactoryConfig) {
    super(config)
  }

  build(overrides: Partial<ExecutionCreateInput> = {}): PipelineRun {
    const sequence = this.getSequence('execution')
    const status = overrides.status || this.randomElement<ExecutionStatus>(['QUEUED', 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'])
    const queuedAt = overrides.queuedAt || this.randomDate(30)
    const startedAt = this.generateStartedAt(status, queuedAt)
    const completedAt = this.generateCompletedAt(status, startedAt)
    const duration = this.generateDuration(startedAt, completedAt)
    
    const defaultData: ExecutionCreateInput = {
      pipelineId: overrides.pipelineId || 'pipeline_placeholder',
      userId: overrides.userId || 'user_placeholder',
      status,
      inputs: overrides.inputs || JSON.stringify(this.generateRandomInputs()),
      outputs: overrides.outputs || JSON.stringify(this.generateRandomOutputs(status)),
      configuration: overrides.configuration || JSON.stringify(this.generateRandomConfiguration()),
      context: overrides.context || JSON.stringify(this.generateRandomContext()),
      duration,
      tokensUsed: overrides.tokensUsed || (status === 'COMPLETED' ? this.randomInt(50, 2000) : null),
      estimatedCost: overrides.estimatedCost || this.randomInt(1, 100) / 100,
      actualCost: overrides.actualCost || (status === 'COMPLETED' ? this.randomInt(1, 150) / 100 : null),
      memoryUsage: overrides.memoryUsage || this.randomInt(100, 2000) * 1024 * 1024, // MB to bytes
      cpuTime: overrides.cpuTime || this.randomInt(100, 5000), // milliseconds
      error: overrides.error || (status === 'FAILED' ? JSON.stringify(this.generateRandomError()) : null),
      retryCount: overrides.retryCount || (status === 'FAILED' ? this.randomInt(0, 3) : 0),
      maxRetries: overrides.maxRetries || 3,
      retryStrategy: overrides.retryStrategy || JSON.stringify({ strategy: 'exponential', baseDelay: 1000 }),
      failureReason: overrides.failureReason || (status === 'FAILED' ? this.generateFailureReason() : null),
      progress: overrides.progress || this.generateProgress(status),
      currentTaskId: overrides.currentTaskId || (status === 'RUNNING' ? `task_${this.randomInt(1, 10)}` : null),
      totalTasks: overrides.totalTasks || this.randomInt(3, 15),
      completedTasks: overrides.completedTasks || this.generateCompletedTasks(status),
      priority: overrides.priority || this.randomInt(0, 10),
      scheduledFor: overrides.scheduledFor || (this.randomBoolean(0.2) ? this.randomDate(1) : null),
      timeoutAt: overrides.timeoutAt || new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
      executorId: overrides.executorId || `executor_${this.randomInt(1, 5)}`,
      environment: overrides.environment || JSON.stringify(this.generateEnvironment()),
      version: overrides.version || `v${this.randomInt(1, 10)}.${this.randomInt(0, 9)}.${this.randomInt(0, 9)}`,
      queuedAt,
      startedAt,
      completedAt,
      lastUpdateAt: completedAt || startedAt || queuedAt,
    }

    const execution = {
      id: generateId('run'),
      ...defaultData,
      ...overrides,
    } as PipelineRun

    return execution
  }

  buildMany(count: number, overrides: Partial<ExecutionCreateInput> = {}): PipelineRun[] {
    return Array.from({ length: count }, () => this.build(overrides))
  }

  async create(overrides: Partial<ExecutionCreateInput> = {}): Promise<PipelineRun> {
    const executionData = this.build(overrides)
    
    return await this.config.prisma.pipelineRun.create({
      data: executionData
    })
  }

  async createMany(count: number, overrides: Partial<ExecutionCreateInput> = {}): Promise<PipelineRun[]> {
    const executions: PipelineRun[] = []
    
    for (let i = 0; i < count; i++) {
      const execution = await this.create(overrides)
      executions.push(execution)
    }
    
    return executions
  }

  // Specialized factory methods
  async createSuccessfulExecution(overrides: Partial<ExecutionCreateInput> = {}): Promise<PipelineRun> {
    const startedAt = this.randomDate(1)
    const completedAt = new Date(startedAt.getTime() + this.randomInt(5000, 300000)) // 5s to 5min
    
    return await this.create({
      status: 'COMPLETED',
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
      tokensUsed: this.randomInt(100, 1000),
      actualCost: this.randomInt(5, 50) / 100,
      progress: 1.0,
      completedTasks: this.randomInt(5, 15),
      totalTasks: this.randomInt(5, 15),
      ...overrides
    })
  }

  async createFailedExecution(overrides: Partial<ExecutionCreateInput> = {}): Promise<PipelineRun> {
    const startedAt = this.randomDate(1)
    const completedAt = new Date(startedAt.getTime() + this.randomInt(1000, 60000)) // 1s to 1min
    
    return await this.create({
      status: 'FAILED',
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
      error: JSON.stringify(this.generateRandomError()),
      failureReason: this.generateFailureReason(),
      retryCount: this.randomInt(1, 3),
      progress: this.randomInt(10, 80) / 100,
      completedTasks: this.randomInt(1, 5),
      totalTasks: this.randomInt(5, 15),
      ...overrides
    })
  }

  async createRunningExecution(overrides: Partial<ExecutionCreateInput> = {}): Promise<PipelineRun> {
    const startedAt = this.randomDate(0.1) // Started recently
    
    return await this.create({
      status: 'RUNNING',
      startedAt,
      completedAt: null,
      duration: null,
      progress: this.randomInt(20, 80) / 100,
      currentTaskId: `task_${this.randomInt(1, 10)}`,
      completedTasks: this.randomInt(2, 8),
      totalTasks: this.randomInt(8, 15),
      ...overrides
    })
  }

  async createLongRunningExecution(overrides: Partial<ExecutionCreateInput> = {}): Promise<PipelineRun> {
    const startedAt = this.randomDate(0.5) // Started within last 12 hours
    
    return await this.create({
      status: 'RUNNING',
      startedAt,
      completedAt: null,
      duration: null,
      progress: this.randomInt(40, 90) / 100,
      currentTaskId: `task_${this.randomInt(5, 15)}`,
      completedTasks: this.randomInt(10, 25),
      totalTasks: this.randomInt(25, 50),
      memoryUsage: this.randomInt(1000, 4000) * 1024 * 1024, // Higher memory usage
      cpuTime: this.randomInt(300000, 1800000), // 5-30 minutes
      ...overrides
    })
  }

  // Task execution factory
  async createTaskExecution(runId: string, overrides: Partial<TaskExecutionCreateInput> = {}): Promise<TaskExecution> {
    const sequence = this.getSequence('task')
    const status = overrides.status || this.randomElement<ExecutionStatus>(['QUEUED', 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'])
    const queuedAt = overrides.queuedAt || this.randomDate(1)
    const startedAt = this.generateStartedAt(status, queuedAt)
    const completedAt = this.generateCompletedAt(status, startedAt)
    const duration = this.generateDuration(startedAt, completedAt)
    
    const taskData: TaskExecutionCreateInput = {
      runId,
      nodeId: overrides.nodeId || `node_${sequence}`,
      nodeName: overrides.nodeName || `Task ${sequence}`,
      nodeType: overrides.nodeType || this.randomElement(['input', 'transform', 'ai', 'output', 'condition', 'loop']),
      status,
      inputs: overrides.inputs || JSON.stringify(this.generateRandomInputs()),
      outputs: overrides.outputs || JSON.stringify(this.generateRandomOutputs(status)),
      configuration: overrides.configuration || JSON.stringify(this.generateRandomConfiguration()),
      executionOrder: overrides.executionOrder || sequence,
      dependencies: overrides.dependencies || JSON.stringify([]),
      dependents: overrides.dependents || JSON.stringify([]),
      duration,
      tokensUsed: overrides.tokensUsed || (status === 'COMPLETED' ? this.randomInt(10, 500) : null),
      cost: overrides.cost || this.randomInt(1, 20) / 100,
      memoryUsage: overrides.memoryUsage || this.randomInt(50, 500) * 1024 * 1024,
      cpuTime: overrides.cpuTime || this.randomInt(100, 10000),
      error: overrides.error || (status === 'FAILED' ? JSON.stringify(this.generateRandomError()) : null),
      retryCount: overrides.retryCount || (status === 'FAILED' ? this.randomInt(0, 2) : 0),
      maxRetries: overrides.maxRetries || 3,
      retryDelay: overrides.retryDelay || 1000,
      failureReason: overrides.failureReason || (status === 'FAILED' ? this.generateFailureReason() : null),
      progress: overrides.progress || this.generateProgress(status),
      state: overrides.state || JSON.stringify(this.generateTaskState()),
      checkpoint: overrides.checkpoint || (this.randomBoolean(0.3) ? JSON.stringify({ step: this.randomInt(1, 10) }) : null),
      executorId: overrides.executorId || `executor_${this.randomInt(1, 5)}`,
      workerId: overrides.workerId || `worker_${this.randomInt(1, 20)}`,
      queuedAt,
      startedAt,
      completedAt,
      timeoutAt: overrides.timeoutAt || new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      lastUpdateAt: completedAt || startedAt || queuedAt,
      cacheKey: overrides.cacheKey || (this.randomBoolean(0.4) ? `cache_${this.randomInt(1, 1000)}` : null),
      cached: overrides.cached || this.randomBoolean(0.2),
      ...overrides
    }

    return await this.config.prisma.taskExecution.create({
      data: {
        ...taskData,
        id: generateId('task')
      }
    })
  }

  async createTaskExecutions(runId: string, count: number): Promise<TaskExecution[]> {
    const tasks: TaskExecution[] = []
    
    for (let i = 0; i < count; i++) {
      const task = await this.createTaskExecution(runId, {
        executionOrder: i + 1,
        dependencies: i > 0 ? JSON.stringify([`task_${i}`]) : JSON.stringify([]),
        dependents: i < count - 1 ? JSON.stringify([`task_${i + 2}`]) : JSON.stringify([])
      })
      tasks.push(task)
    }
    
    return tasks
  }

  // Execution log factory
  async createExecutionLog(runId: string, overrides: Partial<ExecutionLogCreateInput> = {}): Promise<ExecutionLog> {
    const sequence = this.getSequence('log')
    const level = overrides.level || this.randomElement<LogLevel>(['DEBUG', 'INFO', 'WARN', 'ERROR'])
    
    const logData: ExecutionLogCreateInput = {
      runId,
      taskId: overrides.taskId || (this.randomBoolean(0.7) ? `task_${this.randomInt(1, 10)}` : null),
      level,
      message: overrides.message || this.generateLogMessage(level),
      metadata: overrides.metadata || JSON.stringify(this.generateLogMetadata()),
      category: overrides.category || this.randomElement(['system', 'user', 'error', 'debug', 'performance']),
      source: overrides.source || this.randomElement(['pipeline-engine', 'task-executor', 'ai-provider', 'storage', 'network']),
      correlationId: overrides.correlationId || generateId('corr'),
      sequenceNumber: overrides.sequenceNumber || sequence,
      streamId: overrides.streamId || (this.randomBoolean(0.5) ? generateId('stream') : null),
      errorCode: overrides.errorCode || (level === 'ERROR' ? this.generateErrorCode() : null),
      stackTrace: overrides.stackTrace || (level === 'ERROR' ? this.generateStackTrace() : null),
      duration: overrides.duration || (this.randomBoolean(0.3) ? this.randomInt(1, 5000) : null),
      memorySnapshot: overrides.memorySnapshot || (this.randomBoolean(0.2) ? this.randomInt(100, 1000) * 1024 * 1024 : null),
      timestamp: overrides.timestamp || this.randomDate(1),
      ...overrides
    }

    return await this.config.prisma.executionLog.create({
      data: {
        ...logData,
        id: generateId('log')
      }
    })
  }

  async createExecutionLogs(runId: string, count: number): Promise<ExecutionLog[]> {
    const logs: ExecutionLog[] = []
    const baseTimestamp = this.randomDate(1)
    
    for (let i = 0; i < count; i++) {
      const timestamp = new Date(baseTimestamp.getTime() + i * 1000) // 1 second apart
      const log = await this.createExecutionLog(runId, {
        sequenceNumber: i + 1,
        timestamp
      })
      logs.push(log)
    }
    
    return logs
  }

  // Complex execution creation
  async createCompleteExecution(pipelineId: string, userId: string): Promise<{
    execution: PipelineRun
    tasks: TaskExecution[]
    logs: ExecutionLog[]
  }> {
    const execution = await this.createSuccessfulExecution({
      pipelineId,
      userId
    })
    
    const taskCount = this.randomInt(3, 10)
    const tasks = await this.createTaskExecutions(execution.id, taskCount)
    
    const logCount = this.randomInt(20, 100)
    const logs = await this.createExecutionLogs(execution.id, logCount)
    
    return { execution, tasks, logs }
  }

  // Performance testing
  async createPerformanceExecutions(pipelineId: string, userId: string, count: number): Promise<PipelineRun[]> {
    const batchSize = 50
    const executions: PipelineRun[] = []
    
    for (let i = 0; i < count; i += batchSize) {
      const currentBatchSize = Math.min(batchSize, count - i)
      const batch = this.buildMany(currentBatchSize, { pipelineId, userId })
      
      const createdExecutions = await this.config.prisma.pipelineRun.createMany({
        data: batch.map(exec => ({
          ...exec,
          id: undefined // Let Prisma generate IDs
        }))
      })
      
      // Fetch the created executions
      const fetchedExecutions = await this.config.prisma.pipelineRun.findMany({
        where: { pipelineId, userId },
        orderBy: { createdAt: 'desc' },
        take: currentBatchSize
      })
      
      executions.push(...fetchedExecutions)
    }
    
    return executions
  }

  // Helper methods
  private generateStartedAt(status: ExecutionStatus, queuedAt: Date): Date | null {
    if (status === 'QUEUED') return null
    return new Date(queuedAt.getTime() + this.randomInt(100, 5000))
  }

  private generateCompletedAt(status: ExecutionStatus, startedAt: Date | null): Date | null {
    if (!startedAt || status === 'RUNNING' || status === 'PENDING' || status === 'QUEUED') return null
    return new Date(startedAt.getTime() + this.randomInt(1000, 300000))
  }

  private generateDuration(startedAt: Date | null, completedAt: Date | null): number | null {
    if (!startedAt || !completedAt) return null
    return completedAt.getTime() - startedAt.getTime()
  }

  private generateProgress(status: ExecutionStatus): number {
    switch (status) {
      case 'QUEUED': return 0
      case 'PENDING': return 0.1
      case 'RUNNING': return this.randomInt(10, 90) / 100
      case 'COMPLETED': return 1.0
      case 'FAILED': return this.randomInt(5, 80) / 100
      case 'CANCELLED': return this.randomInt(5, 60) / 100
      default: return 0
    }
  }

  private generateCompletedTasks(status: ExecutionStatus): number {
    const total = this.randomInt(5, 15)
    switch (status) {
      case 'QUEUED': return 0
      case 'PENDING': return 0
      case 'RUNNING': return this.randomInt(1, total - 1)
      case 'COMPLETED': return total
      case 'FAILED': return this.randomInt(1, total - 1)
      case 'CANCELLED': return this.randomInt(1, total - 1)
      default: return 0
    }
  }

  private generateRandomInputs(): Record<string, any> {
    return {
      [`input_${this.randomInt(1, 5)}`]: {
        type: this.randomElement(['text', 'image', 'file', 'json']),
        value: generateLoremText(this.randomInt(5, 20)),
        metadata: { size: this.randomInt(100, 10000) }
      }
    }
  }

  private generateRandomOutputs(status: ExecutionStatus): Record<string, any> {
    if (status !== 'COMPLETED') return {}
    
    return {
      [`output_${this.randomInt(1, 5)}`]: {
        type: this.randomElement(['text', 'image', 'file', 'json']),
        value: generateLoremText(this.randomInt(10, 50)),
        metadata: { 
          size: this.randomInt(1000, 50000),
          format: this.randomElement(['png', 'jpg', 'pdf', 'json', 'txt'])
        }
      }
    }
  }

  private generateRandomConfiguration(): Record<string, any> {
    return {
      timeout: this.randomInt(30, 300) * 1000,
      retries: this.randomInt(0, 5),
      parallel: this.randomBoolean(0.3),
      caching: this.randomBoolean(0.7),
      logging: this.randomElement(['minimal', 'standard', 'verbose'])
    }
  }

  private generateRandomContext(): Record<string, any> {
    return {
      userId: generateId('user'),
      sessionId: generateId('session'),
      requestId: generateId('request'),
      environment: this.randomElement(['development', 'staging', 'production']),
      region: this.randomElement(['us-east-1', 'us-west-2', 'eu-west-1']),
      version: `v${this.randomInt(1, 3)}.${this.randomInt(0, 9)}.${this.randomInt(0, 9)}`
    }
  }

  private generateRandomError(): Record<string, any> {
    const errorTypes = [
      'ValidationError',
      'TimeoutError',
      'NetworkError',
      'AuthenticationError',
      'RateLimitError',
      'InternalServerError'
    ]
    
    return {
      type: this.randomElement(errorTypes),
      message: this.generateErrorMessage(),
      code: this.generateErrorCode(),
      details: {
        timestamp: new Date().toISOString(),
        requestId: generateId('req'),
        retry: this.randomBoolean(0.6)
      }
    }
  }

  private generateFailureReason(): string {
    const reasons = [
      'timeout',
      'validation_failed',
      'rate_limited',
      'authentication_failed',
      'network_error',
      'internal_error',
      'resource_unavailable',
      'quota_exceeded'
    ]
    
    return this.randomElement(reasons)
  }

  private generateEnvironment(): Record<string, any> {
    return {
      platform: this.randomElement(['aws', 'gcp', 'azure']),
      region: this.randomElement(['us-east-1', 'us-west-2', 'eu-west-1']),
      instance: this.randomElement(['t3.medium', 't3.large', 't3.xlarge']),
      runtime: this.randomElement(['nodejs18', 'python39', 'java11']),
      memory: this.randomInt(512, 4096),
      cpu: this.randomInt(1, 8)
    }
  }

  private generateTaskState(): Record<string, any> {
    return {
      phase: this.randomElement(['initializing', 'processing', 'finalizing']),
      progress: this.randomInt(0, 100),
      currentStep: this.randomInt(1, 10),
      totalSteps: this.randomInt(5, 15),
      metrics: {
        processed: this.randomInt(0, 1000),
        errors: this.randomInt(0, 5),
        warnings: this.randomInt(0, 10)
      }
    }
  }

  private generateLogMessage(level: LogLevel): string {
    const messages = {
      DEBUG: [
        'Processing node configuration',
        'Validating input parameters',
        'Caching intermediate results',
        'Optimizing execution path'
      ],
      INFO: [
        'Pipeline execution started',
        'Task completed successfully',
        'Connecting to external service',
        'Processing batch of items'
      ],
      WARN: [
        'Rate limit approaching',
        'Retrying failed operation',
        'Deprecated feature usage detected',
        'Performance threshold exceeded'
      ],
      ERROR: [
        'Failed to connect to service',
        'Validation failed for input',
        'Timeout occurred during processing',
        'Authentication failed'
      ]
    }
    
    return this.randomElement(messages[level])
  }

  private generateLogMetadata(): Record<string, any> {
    return {
      nodeId: generateId('node'),
      duration: this.randomInt(10, 5000),
      memoryUsage: this.randomInt(100, 1000) * 1024 * 1024,
      requestId: generateId('req'),
      userId: generateId('user')
    }
  }

  private generateErrorCode(): string {
    const codes = [
      'E_TIMEOUT',
      'E_VALIDATION',
      'E_NETWORK',
      'E_AUTH',
      'E_RATE_LIMIT',
      'E_INTERNAL',
      'E_RESOURCE',
      'E_QUOTA'
    ]
    
    return this.randomElement(codes)
  }

  private generateErrorMessage(): string {
    const messages = [
      'Request timeout after 30 seconds',
      'Invalid input parameter format',
      'Network connection failed',
      'Authentication token expired',
      'Rate limit exceeded',
      'Internal server error',
      'Resource not available',
      'Quota limit reached'
    ]
    
    return this.randomElement(messages)
  }

  private generateStackTrace(): string {
    const traces = [
      'Error: Timeout\n    at executeTask (engine.js:123)\n    at processNode (pipeline.js:456)\n    at runPipeline (runner.js:789)',
      'ValidationError: Invalid input\n    at validateInput (validator.js:234)\n    at processInput (processor.js:567)\n    at main (index.js:890)',
      'NetworkError: Connection failed\n    at request (http.js:345)\n    at callAPI (api.js:678)\n    at executeNode (executor.js:901)'
    ]
    
    return this.randomElement(traces)
  }

  // Utility methods
  generateExecutionStats(executions: PipelineRun[]): Record<string, any> {
    const stats = {
      total: executions.length,
      byStatus: {
        QUEUED: executions.filter(e => e.status === 'QUEUED').length,
        PENDING: executions.filter(e => e.status === 'PENDING').length,
        RUNNING: executions.filter(e => e.status === 'RUNNING').length,
        COMPLETED: executions.filter(e => e.status === 'COMPLETED').length,
        FAILED: executions.filter(e => e.status === 'FAILED').length,
        CANCELLED: executions.filter(e => e.status === 'CANCELLED').length
      },
      averageDuration: executions
        .filter(e => e.duration)
        .reduce((sum, e) => sum + (e.duration || 0), 0) / executions.filter(e => e.duration).length,
      totalCost: executions
        .filter(e => e.actualCost)
        .reduce((sum, e) => sum + (e.actualCost || 0), 0),
      totalTokens: executions
        .filter(e => e.tokensUsed)
        .reduce((sum, e) => sum + (e.tokensUsed || 0), 0),
      successRate: executions.filter(e => e.status === 'COMPLETED').length / executions.length
    }
    
    return stats
  }
}