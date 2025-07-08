/**
 * Execution service for managing pipeline runs, tasks, and execution flow
 */

import { PipelineRunRepository } from '../repositories/pipeline-run.repository.js'
import { TaskExecutionRepository } from '../repositories/task-execution.repository.js'
import { ExecutionLogRepository } from '../repositories/execution-log.repository.js'
import { PipelineRepository } from '../repositories/pipeline.repository.js'
import type { 
  PipelineRun,
  TaskExecution,
  ExecutionLog,
  ExecutionStatus,
  LogLevel,
  PipelineConfiguration,
  CreatePipelineRunInput,
  CreateTaskExecutionInput 
} from '@imaginarium/shared'

export interface ExecutionContext {
  runId: string
  userId: string
  pipelineId: string
  configuration: PipelineConfiguration
  inputs: Record<string, unknown>
  variables: Record<string, unknown>
  secrets: Record<string, string>
  options: {
    timeout?: number
    maxRetries?: number
    priority?: number
    executorId?: string
  }
}

export interface TaskResult {
  success: boolean
  outputs?: Record<string, unknown>
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
    stack?: string
  }
  metrics?: {
    duration: number
    tokensUsed?: number
    cost?: number
    memoryUsage?: number
    cpuTime?: number
  }
}

export interface RetryStrategy {
  maxRetries: number
  baseDelay: number
  backoffMultiplier: number
  maxDelay: number
  retryableErrors: string[]
  retryCondition?: (error: any, retryCount: number) => boolean
}

export class ExecutionService {
  constructor(
    private pipelineRunRepo: PipelineRunRepository,
    private taskExecutionRepo: TaskExecutionRepository,
    private executionLogRepo: ExecutionLogRepository,
    private pipelineRepo: PipelineRepository
  ) {}

  /**
   * Start a new pipeline execution
   */
  async startExecution(
    pipelineId: string,
    userId: string,
    inputs: Record<string, unknown> = {},
    options: {
      priority?: number
      scheduledFor?: Date
      timeout?: number
      maxRetries?: number
      retryStrategy?: RetryStrategy
    } = {}
  ): Promise<PipelineRun> {
    // Get pipeline configuration
    const pipeline = await this.pipelineRepo.findById(pipelineId)
    if (!pipeline) {
      throw new Error('Pipeline not found')
    }

    const configuration = JSON.parse(pipeline.configuration) as PipelineConfiguration

    // Create pipeline run
    const runInput: CreatePipelineRunInput = {
      pipelineId,
      userId,
      inputs,
      configuration,
      priority: options.priority || 0,
      scheduledFor: options.scheduledFor,
      maxRetries: options.maxRetries || 3,
      retryStrategy: options.retryStrategy,
      timeoutAt: options.timeout ? new Date(Date.now() + options.timeout) : undefined,
    }

    const run = await this.pipelineRunRepo.create(runInput)

    // Create task executions from pipeline configuration
    await this.createTaskExecutions(run.id, configuration)

    // Log execution start
    await this.executionLogRepo.create({
      runId: run.id,
      level: 'INFO',
      message: `Pipeline execution started: ${pipeline.name}`,
      category: 'system',
      source: 'execution-service',
      sequenceNumber: 1,
    })

    return run
  }

  /**
   * Execute next available tasks in a pipeline run
   */
  async executeNextTasks(runId: string, executorId?: string): Promise<TaskExecution[]> {
    const run = await this.pipelineRunRepo.findById(runId)
    if (!run) {
      throw new Error('Pipeline run not found')
    }

    if (run.status !== 'QUEUED' && run.status !== 'RUNNING') {
      throw new Error(`Cannot execute tasks for run in status: ${run.status}`)
    }

    // Mark run as running if it's queued
    if (run.status === 'QUEUED') {
      await this.pipelineRunRepo.markStarted(runId, executorId)
    }

    // Get ready tasks (dependencies satisfied)
    const readyTasks = await this.taskExecutionRepo.findReady(runId)
    
    if (readyTasks.length === 0) {
      await this.checkExecutionCompletion(runId)
      return []
    }

    // Start executing ready tasks
    const executingTasks: TaskExecution[] = []
    
    for (const task of readyTasks) {
      try {
        const startedTask = await this.taskExecutionRepo.markStarted(task.id, executorId)
        executingTasks.push(startedTask)

        await this.executionLogRepo.create({
          runId,
          taskId: task.id,
          level: 'INFO',
          message: `Task started: ${task.nodeName}`,
          category: 'execution',
          source: 'execution-service',
          sequenceNumber: await this.getNextSequenceNumber(runId),
        })
      } catch (error) {
        await this.executionLogRepo.logError(
          runId,
          task.id,
          error as Error,
          'TASK_START_ERROR'
        )
      }
    }

    // Update run progress
    await this.updateRunProgress(runId)

    return executingTasks
  }

  /**
   * Complete a task execution
   */
  async completeTask(
    taskId: string,
    result: TaskResult
  ): Promise<TaskExecution> {
    const task = await this.taskExecutionRepo.findById(taskId)
    if (!task) {
      throw new Error('Task execution not found')
    }

    if (result.success && result.outputs) {
      // Mark task as completed
      const completedTask = await this.taskExecutionRepo.markCompleted(
        taskId,
        result.outputs,
        result.metrics
      )

      await this.executionLogRepo.create({
        runId: task.runId,
        taskId,
        level: 'INFO',
        message: `Task completed successfully: ${task.nodeName}`,
        category: 'execution',
        source: 'execution-service',
        sequenceNumber: await this.getNextSequenceNumber(task.runId),
        duration: result.metrics?.duration,
      })

      // Update run progress and check for completion
      await this.updateRunProgress(task.runId)
      await this.checkExecutionCompletion(task.runId)

      return completedTask
    } else {
      // Handle task failure
      return await this.handleTaskFailure(taskId, result.error!)
    }
  }

  /**
   * Handle task failure with retry logic
   */
  async handleTaskFailure(
    taskId: string,
    error: {
      code: string
      message: string
      details?: Record<string, unknown>
      stack?: string
    }
  ): Promise<TaskExecution> {
    const task = await this.taskExecutionRepo.findById(taskId)
    if (!task) {
      throw new Error('Task execution not found')
    }

    // Log the error
    await this.executionLogRepo.create({
      runId: task.runId,
      taskId,
      level: 'ERROR',
      message: `Task failed: ${error.message}`,
      category: 'error',
      source: 'execution-service',
      sequenceNumber: await this.getNextSequenceNumber(task.runId),
      errorCode: error.code,
      stackTrace: error.stack,
      metadata: error.details,
    })

    // Check if task should be retried
    if (await this.shouldRetryTask(task, error)) {
      const retriedTask = await this.taskExecutionRepo.retry(taskId)
      
      await this.executionLogRepo.create({
        runId: task.runId,
        taskId,
        level: 'INFO',
        message: `Task scheduled for retry (attempt ${retriedTask.retryCount})`,
        category: 'retry',
        source: 'execution-service',
        sequenceNumber: await this.getNextSequenceNumber(task.runId),
      })

      return retriedTask
    } else {
      // Mark task as permanently failed
      const failedTask = await this.taskExecutionRepo.markFailed(
        taskId,
        error,
        `${error.code}: ${error.message}`
      )

      // Check if run should be failed
      await this.checkRunFailure(task.runId)

      return failedTask
    }
  }

  /**
   * Cancel a pipeline execution
   */
  async cancelExecution(runId: string, reason = 'Cancelled by user'): Promise<PipelineRun> {
    // Cancel all running tasks
    const runningTasks = await this.taskExecutionRepo.findByStatus(runId, 'RUNNING')
    
    for (const task of runningTasks) {
      await this.taskExecutionRepo.markFailed(
        task.id,
        { code: 'CANCELLED', message: 'Task cancelled' },
        'Execution cancelled'
      )
    }

    // Mark pending tasks as cancelled
    const pendingTasks = await this.taskExecutionRepo.findByStatus(runId, 'PENDING')
    
    for (const task of pendingTasks) {
      await this.taskExecutionRepo.update(task.id, { status: 'CANCELLED' })
    }

    // Cancel the run
    const cancelledRun = await this.pipelineRunRepo.cancel(runId, reason)

    await this.executionLogRepo.create({
      runId,
      level: 'WARN',
      message: `Pipeline execution cancelled: ${reason}`,
      category: 'system',
      source: 'execution-service',
      sequenceNumber: await this.getNextSequenceNumber(runId),
    })

    return cancelledRun
  }

  /**
   * Get execution status and progress
   */
  async getExecutionStatus(runId: string): Promise<{
    run: PipelineRun
    tasks: TaskExecution[]
    progress: {
      totalTasks: number
      completedTasks: number
      runningTasks: number
      failedTasks: number
      percentage: number
    }
    logs: ExecutionLog[]
  }> {
    const [run, tasks, logs] = await Promise.all([
      this.pipelineRunRepo.findById(runId),
      this.taskExecutionRepo.findByRunId(runId),
      this.executionLogRepo.findByRunId(runId, 50),
    ])

    if (!run) {
      throw new Error('Pipeline run not found')
    }

    const statusCounts = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const progress = {
      totalTasks: tasks.length,
      completedTasks: statusCounts.COMPLETED || 0,
      runningTasks: statusCounts.RUNNING || 0,
      failedTasks: statusCounts.FAILED || 0,
      percentage: tasks.length > 0 ? (statusCounts.COMPLETED || 0) / tasks.length * 100 : 0,
    }

    return { run, tasks, progress, logs }
  }

  /**
   * Retry a failed pipeline execution
   */
  async retryExecution(runId: string): Promise<PipelineRun> {
    const run = await this.pipelineRunRepo.findById(runId)
    if (!run) {
      throw new Error('Pipeline run not found')
    }

    if (run.status !== 'FAILED') {
      throw new Error('Can only retry failed executions')
    }

    // Retry the run
    const retriedRun = await this.pipelineRunRepo.retry(runId)

    // Reset failed tasks to pending
    const failedTasks = await this.taskExecutionRepo.findByStatus(runId, 'FAILED')
    
    for (const task of failedTasks) {
      await this.taskExecutionRepo.update(task.id, {
        status: 'PENDING',
        error: null,
        failureReason: null,
        progress: 0,
        outputs: null,
      })
    }

    await this.executionLogRepo.create({
      runId,
      level: 'INFO',
      message: `Pipeline execution retried (attempt ${retriedRun.retryCount})`,
      category: 'retry',
      source: 'execution-service',
      sequenceNumber: await this.getNextSequenceNumber(runId),
    })

    return retriedRun
  }

  /**
   * Get real-time execution stream
   */
  async getExecutionStream(runId: string, fromSequence = 0): Promise<{
    logs: ExecutionLog[]
    tasks: TaskExecution[]
    run: PipelineRun
  }> {
    const [logs, tasks, run] = await Promise.all([
      this.executionLogRepo.getLogStream(runId, fromSequence),
      this.taskExecutionRepo.findByRunId(runId),
      this.pipelineRunRepo.findById(runId),
    ])

    if (!run) {
      throw new Error('Pipeline run not found')
    }

    return { logs, tasks, run }
  }

  /**
   * Private helper methods
   */

  private async createTaskExecutions(
    runId: string,
    configuration: PipelineConfiguration
  ): Promise<void> {
    const tasks: CreateTaskExecutionInput[] = []

    // Create task execution for each node
    configuration.nodes.forEach((node, index) => {
      const dependencies = this.getNodeDependencies(node.id, configuration)
      
      tasks.push({
        runId,
        nodeId: node.id,
        nodeName: (node.config as any)?.label || node.type,
        nodeType: node.type,
        configuration: node.config || {},
        executionOrder: index,
        dependencies,
        maxRetries: 3,
        retryDelay: 1000,
      })
    })

    // Create all tasks
    for (const taskInput of tasks) {
      await this.taskExecutionRepo.create(taskInput)
    }

    // Update run with total task count
    await this.pipelineRunRepo.update(runId, {
      totalTasks: tasks.length,
    })
  }

  private getNodeDependencies(
    nodeId: string,
    configuration: PipelineConfiguration
  ): string[] {
    return configuration.connections
      .filter(conn => conn.target === nodeId)
      .map(conn => conn.source)
  }

  private async updateRunProgress(runId: string): Promise<void> {
    const tasks = await this.taskExecutionRepo.findByRunId(runId)
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length
    const progress = tasks.length > 0 ? completedTasks / tasks.length : 0

    await this.pipelineRunRepo.updateProgress(runId, progress)
    await this.pipelineRunRepo.update(runId, { completedTasks })
  }

  private async checkExecutionCompletion(runId: string): Promise<void> {
    const tasks = await this.taskExecutionRepo.findByRunId(runId)
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length
    const failedTasks = tasks.filter(t => t.status === 'FAILED').length

    if (completedTasks === totalTasks) {
      // All tasks completed successfully
      const outputs = this.collectPipelineOutputs(tasks)
      const metrics = this.calculateRunMetrics(tasks)

      await this.pipelineRunRepo.markCompleted(runId, outputs, metrics)

      await this.executionLogRepo.create({
        runId,
        level: 'INFO',
        message: 'Pipeline execution completed successfully',
        category: 'system',
        source: 'execution-service',
        sequenceNumber: await this.getNextSequenceNumber(runId),
      })
    } else if (failedTasks > 0 && (completedTasks + failedTasks) === totalTasks) {
      // Some tasks failed and no more can run
      await this.checkRunFailure(runId)
    }
  }

  private async checkRunFailure(runId: string): Promise<void> {
    const tasks = await this.taskExecutionRepo.findByRunId(runId)
    const readyTasks = await this.taskExecutionRepo.findReady(runId)
    const failedTasks = tasks.filter(t => t.status === 'FAILED')

    // If no tasks are ready and we have failures, the run is failed
    if (readyTasks.length === 0 && failedTasks.length > 0) {
      const primaryError = failedTasks[0]
      const errorDetails = {
        code: 'PIPELINE_EXECUTION_FAILED',
        message: `Pipeline failed due to task failures`,
        failedTasks: failedTasks.map(t => ({
          taskId: t.id,
          nodeId: t.nodeId,
          nodeName: t.nodeName,
          error: t.error ? JSON.parse(t.error) : null,
        })),
      }

      await this.pipelineRunRepo.markFailed(runId, errorDetails, 'Task execution failures')

      await this.executionLogRepo.create({
        runId,
        level: 'ERROR',
        message: `Pipeline execution failed: ${failedTasks.length} task(s) failed`,
        category: 'error',
        source: 'execution-service',
        sequenceNumber: await this.getNextSequenceNumber(runId),
        metadata: errorDetails,
      })
    }
  }

  private async shouldRetryTask(
    task: TaskExecution,
    error: { code: string; message: string }
  ): Promise<boolean> {
    if (task.retryCount >= task.maxRetries) {
      return false
    }

    // Add custom retry logic based on error codes
    const retryableErrors = [
      'NETWORK_ERROR',
      'TIMEOUT',
      'RATE_LIMIT',
      'TEMPORARY_FAILURE',
      'SERVICE_UNAVAILABLE',
    ]

    return retryableErrors.includes(error.code)
  }

  private collectPipelineOutputs(tasks: TaskExecution[]): Record<string, unknown> {
    const outputs: Record<string, unknown> = {}

    tasks.forEach(task => {
      if (task.outputs) {
        try {
          const taskOutputs = JSON.parse(task.outputs)
          outputs[task.nodeId] = taskOutputs
        } catch {
          // Ignore invalid JSON
        }
      }
    })

    return outputs
  }

  private calculateRunMetrics(tasks: TaskExecution[]): Record<string, unknown> {
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED')
    
    return {
      duration: completedTasks.reduce((sum, t) => sum + (t.duration || 0), 0),
      tokensUsed: completedTasks.reduce((sum, t) => sum + (t.tokensUsed || 0), 0),
      actualCost: completedTasks.reduce((sum, t) => sum + (t.cost || 0), 0),
      memoryUsage: Math.max(...completedTasks.map(t => t.memoryUsage || 0)),
      cpuTime: completedTasks.reduce((sum, t) => sum + (t.cpuTime || 0), 0),
    }
  }

  private async getNextSequenceNumber(runId: string): Promise<number> {
    const lastLog = await this.executionLogRepo.findByRunId(runId, 1)
    return lastLog.length > 0 ? lastLog[0].sequenceNumber + 1 : 1
  }
}