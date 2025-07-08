/**
 * Pipeline Run repository for managing pipeline executions
 */

import { PipelineRun, ExecutionStatus, type CreatePipelineRunInput, type UpdatePipelineRunInput } from '@imaginarium/shared'
import { BaseRepository } from './base.repository.js'
import { prisma } from '../database.js'

export interface IPipelineRunRepository {
  findByUserId(userId: string, status?: ExecutionStatus): Promise<PipelineRun[]>
  findByPipelineId(pipelineId: string, limit?: number): Promise<PipelineRun[]>
  findRunning(): Promise<PipelineRun[]>
  findQueued(): Promise<PipelineRun[]>
  findWithTasks(id: string): Promise<PipelineRun & { tasks: any[] } | null>
  findWithLogs(id: string, limit?: number): Promise<PipelineRun & { logs: any[] } | null>
  updateProgress(id: string, progress: number, currentTaskId?: string): Promise<PipelineRun>
  markStarted(id: string, executorId?: string): Promise<PipelineRun>
  markCompleted(id: string, outputs?: object, metrics?: object): Promise<PipelineRun>
  markFailed(id: string, error: object, failureReason?: string): Promise<PipelineRun>
  retry(id: string): Promise<PipelineRun>
  cancel(id: string, reason?: string): Promise<PipelineRun>
  getMetrics(id: string): Promise<object>
  getExecutionStats(pipelineId: string): Promise<object>
}

export class PipelineRunRepository 
  extends BaseRepository<PipelineRun, CreatePipelineRunInput, UpdatePipelineRunInput> 
  implements IPipelineRunRepository {
  
  protected model = prisma.pipelineRun
  
  async create(data: CreatePipelineRunInput): Promise<PipelineRun> {
    return await this.model.create({
      data: {
        ...data,
        configuration: JSON.stringify(data.configuration),
        inputs: data.inputs ? JSON.stringify(data.inputs) : null,
        context: data.context ? JSON.stringify(data.context) : null,
        retryStrategy: data.retryStrategy ? JSON.stringify(data.retryStrategy) : null,
      },
    })
  }

  async findByUserId(userId: string, status?: ExecutionStatus): Promise<PipelineRun[]> {
    return await this.model.findMany({
      where: {
        userId,
        ...(status && { status }),
      },
      include: {
        pipeline: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: {
        queuedAt: 'desc',
      },
    })
  }

  async findByPipelineId(pipelineId: string, limit = 50): Promise<PipelineRun[]> {
    return await this.model.findMany({
      where: { pipelineId },
      orderBy: {
        queuedAt: 'desc',
      },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })
  }

  async findRunning(): Promise<PipelineRun[]> {
    return await this.model.findMany({
      where: {
        status: {
          in: ['RUNNING', 'PENDING'],
        },
      },
      orderBy: {
        startedAt: 'asc',
      },
    })
  }

  async findQueued(): Promise<PipelineRun[]> {
    return await this.model.findMany({
      where: {
        status: 'QUEUED',
        OR: [
          { scheduledFor: null },
          { scheduledFor: { lte: new Date() } },
        ],
      },
      orderBy: [
        { priority: 'desc' },
        { queuedAt: 'asc' },
      ],
    })
  }

  async findWithTasks(id: string): Promise<PipelineRun & { tasks: any[] } | null> {
    return await this.model.findUnique({
      where: { id },
      include: {
        tasks: {
          orderBy: {
            executionOrder: 'asc',
          },
        },
      },
    })
  }

  async findWithLogs(id: string, limit = 100): Promise<PipelineRun & { logs: any[] } | null> {
    return await this.model.findUnique({
      where: { id },
      include: {
        logs: {
          orderBy: {
            sequenceNumber: 'asc',
          },
          take: limit,
        },
      },
    })
  }

  async updateProgress(id: string, progress: number, currentTaskId?: string): Promise<PipelineRun> {
    return await this.model.update({
      where: { id },
      data: {
        progress,
        currentTaskId,
        lastUpdateAt: new Date(),
      },
    })
  }

  async markStarted(id: string, executorId?: string): Promise<PipelineRun> {
    return await this.model.update({
      where: { id },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        executorId,
        lastUpdateAt: new Date(),
      },
    })
  }

  async markCompleted(id: string, outputs?: object, metrics?: object): Promise<PipelineRun> {
    const updateData: any = {
      status: 'COMPLETED',
      completedAt: new Date(),
      progress: 1.0,
      lastUpdateAt: new Date(),
    }

    if (outputs) {
      updateData.outputs = JSON.stringify(outputs)
    }

    if (metrics) {
      if (metrics.duration) updateData.duration = metrics.duration
      if (metrics.tokensUsed) updateData.tokensUsed = metrics.tokensUsed
      if (metrics.actualCost) updateData.actualCost = metrics.actualCost
      if (metrics.memoryUsage) updateData.memoryUsage = metrics.memoryUsage
      if (metrics.cpuTime) updateData.cpuTime = metrics.cpuTime
    }

    return await this.model.update({
      where: { id },
      data: updateData,
    })
  }

  async markFailed(id: string, error: object, failureReason?: string): Promise<PipelineRun> {
    return await this.model.update({
      where: { id },
      data: {
        status: 'FAILED',
        error: JSON.stringify(error),
        failureReason,
        completedAt: new Date(),
        lastUpdateAt: new Date(),
      },
    })
  }

  async retry(id: string): Promise<PipelineRun> {
    const run = await this.model.findUnique({ where: { id } })
    if (!run) {
      throw new Error('Pipeline run not found')
    }

    if (run.retryCount >= run.maxRetries) {
      throw new Error('Maximum retry count exceeded')
    }

    return await this.model.update({
      where: { id },
      data: {
        status: 'QUEUED',
        retryCount: run.retryCount + 1,
        startedAt: null,
        completedAt: null,
        error: null,
        failureReason: null,
        progress: 0.0,
        currentTaskId: null,
        lastUpdateAt: new Date(),
      },
    })
  }

  async cancel(id: string, reason?: string): Promise<PipelineRun> {
    return await this.model.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        failureReason: reason || 'Cancelled by user',
        completedAt: new Date(),
        lastUpdateAt: new Date(),
      },
    })
  }

  async getMetrics(id: string): Promise<object> {
    const run = await this.model.findUnique({
      where: { id },
      select: {
        duration: true,
        tokensUsed: true,
        estimatedCost: true,
        actualCost: true,
        memoryUsage: true,
        cpuTime: true,
        totalTasks: true,
        completedTasks: true,
        retryCount: true,
        status: true,
        queuedAt: true,
        startedAt: true,
        completedAt: true,
      },
    })

    if (!run) {
      throw new Error('Pipeline run not found')
    }

    return {
      ...run,
      queueTime: run.startedAt ? run.startedAt.getTime() - run.queuedAt.getTime() : null,
      totalTime: run.completedAt ? run.completedAt.getTime() - run.queuedAt.getTime() : null,
      efficiency: run.actualCost && run.estimatedCost ? run.actualCost / run.estimatedCost : null,
    }
  }

  async getExecutionStats(pipelineId: string): Promise<object> {
    const [totalRuns, statusCounts, avgMetrics, recentRuns] = await Promise.all([
      this.model.count({ where: { pipelineId } }),
      
      this.model.groupBy({
        by: ['status'],
        where: { pipelineId },
        _count: { id: true },
      }),
      
      this.model.aggregate({
        where: { 
          pipelineId,
          status: 'COMPLETED',
          duration: { not: null },
        },
        _avg: {
          duration: true,
          tokensUsed: true,
          actualCost: true,
          memoryUsage: true,
        },
      }),
      
      this.model.findMany({
        where: { pipelineId },
        orderBy: { queuedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          status: true,
          duration: true,
          queuedAt: true,
          completedAt: true,
          retryCount: true,
        },
      }),
    ])

    const statusMap = statusCounts.reduce((acc, { status, _count }) => {
      acc[status] = _count.id
      return acc
    }, {} as Record<string, number>)

    return {
      totalRuns,
      statusCounts: statusMap,
      successRate: totalRuns > 0 ? ((statusMap.COMPLETED || 0) / totalRuns) * 100 : 0,
      averageMetrics: avgMetrics,
      recentRuns,
    }
  }

  /**
   * Find runs that have timed out
   */
  async findTimedOut(): Promise<PipelineRun[]> {
    return await this.model.findMany({
      where: {
        status: {
          in: ['RUNNING', 'PENDING'],
        },
        timeoutAt: {
          lte: new Date(),
        },
      },
    })
  }

  /**
   * Update execution environment info
   */
  async updateEnvironment(id: string, environment: object): Promise<PipelineRun> {
    return await this.model.update({
      where: { id },
      data: {
        environment: JSON.stringify(environment),
        lastUpdateAt: new Date(),
      },
    })
  }

  /**
   * Get runs ready for execution (queued and scheduled)
   */
  async getExecutionQueue(limit = 50): Promise<PipelineRun[]> {
    return await this.model.findMany({
      where: {
        status: 'QUEUED',
        OR: [
          { scheduledFor: null },
          { scheduledFor: { lte: new Date() } },
        ],
      },
      orderBy: [
        { priority: 'desc' },
        { queuedAt: 'asc' },
      ],
      take: limit,
      include: {
        pipeline: {
          select: {
            id: true,
            name: true,
            configuration: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            maxExecutionsPerMonth: true,
          },
        },
      },
    })
  }

  /**
   * Get resource usage statistics
   */
  async getResourceUsage(timeRange: { start: Date; end: Date }): Promise<object> {
    const runs = await this.model.findMany({
      where: {
        queuedAt: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
        status: 'COMPLETED',
      },
      select: {
        duration: true,
        tokensUsed: true,
        actualCost: true,
        memoryUsage: true,
        cpuTime: true,
        queuedAt: true,
      },
    })

    return {
      totalRuns: runs.length,
      totalDuration: runs.reduce((sum, run) => sum + (run.duration || 0), 0),
      totalTokens: runs.reduce((sum, run) => sum + (run.tokensUsed || 0), 0),
      totalCost: runs.reduce((sum, run) => sum + (run.actualCost || 0), 0),
      peakMemory: Math.max(...runs.map(run => run.memoryUsage || 0)),
      totalCpuTime: runs.reduce((sum, run) => sum + (run.cpuTime || 0), 0),
      timeRange,
    }
  }
}