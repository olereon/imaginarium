/**
 * Task Execution repository for managing individual node executions
 */

import {
  TaskExecution,
  ExecutionStatus,
  type CreateTaskExecutionInput,
  type UpdateTaskExecutionInput,
} from '@imaginarium/shared';
import { BaseRepository } from './base.repository.js';
import { prisma } from '../database.js';

export interface ITaskExecutionRepository {
  findByRunId(runId: string): Promise<TaskExecution[]>;
  findByNodeId(runId: string, nodeId: string): Promise<TaskExecution | null>;
  findReady(runId: string): Promise<TaskExecution[]>;
  findRunning(): Promise<TaskExecution[]>;
  findWithLogs(id: string): Promise<(TaskExecution & { logs: any[] }) | null>;
  updateProgress(id: string, progress: number, state?: object): Promise<TaskExecution>;
  markStarted(id: string, executorId?: string, workerId?: string): Promise<TaskExecution>;
  markCompleted(id: string, outputs: object, metrics?: object): Promise<TaskExecution>;
  markFailed(id: string, error: object, failureReason?: string): Promise<TaskExecution>;
  retry(id: string): Promise<TaskExecution>;
  getDependencies(id: string): Promise<string[]>;
  areDependenciesComplete(id: string): Promise<boolean>;
  getExecutionOrder(runId: string): Promise<TaskExecution[]>;
  updateCache(id: string, cacheKey: string, cached: boolean): Promise<TaskExecution>;
}

export class TaskExecutionRepository
  extends BaseRepository<TaskExecution, CreateTaskExecutionInput, UpdateTaskExecutionInput>
  implements ITaskExecutionRepository
{
  protected model = prisma.taskExecution;

  async create(data: CreateTaskExecutionInput): Promise<TaskExecution> {
    return await this.model.create({
      data: {
        ...data,
        configuration: JSON.stringify(data.configuration),
        dependencies: data.dependencies ? JSON.stringify(data.dependencies) : null,
      },
    });
  }

  async findByRunId(runId: string): Promise<TaskExecution[]> {
    return await this.model.findMany({
      where: { runId },
      orderBy: {
        executionOrder: 'asc',
      },
    });
  }

  async findByNodeId(runId: string, nodeId: string): Promise<TaskExecution | null> {
    return await this.model.findFirst({
      where: {
        runId,
        nodeId,
      },
    });
  }

  async findReady(runId: string): Promise<TaskExecution[]> {
    const tasks = await this.model.findMany({
      where: {
        runId,
        status: 'PENDING',
      },
      orderBy: {
        executionOrder: 'asc',
      },
    });

    // Filter tasks whose dependencies are complete
    const readyTasks: TaskExecution[] = [];

    for (const task of tasks) {
      const dependenciesComplete = await this.areDependenciesComplete(task.id);
      if (dependenciesComplete) {
        readyTasks.push(task);
      }
    }

    return readyTasks;
  }

  async findRunning(): Promise<TaskExecution[]> {
    return await this.model.findMany({
      where: {
        status: 'RUNNING',
      },
      include: {
        run: {
          select: {
            id: true,
            pipelineId: true,
            status: true,
          },
        },
      },
    });
  }

  async findWithLogs(id: string): Promise<(TaskExecution & { logs: any[] }) | null> {
    return await this.model.findUnique({
      where: { id },
      include: {
        logs: {
          orderBy: {
            sequenceNumber: 'asc',
          },
        },
      },
    });
  }

  async updateProgress(id: string, progress: number, state?: object): Promise<TaskExecution> {
    const updateData: any = {
      progress,
      lastUpdateAt: new Date(),
    };

    if (state) {
      updateData.state = JSON.stringify(state);
    }

    return await this.model.update({
      where: { id },
      data: updateData,
    });
  }

  async markStarted(id: string, executorId?: string, workerId?: string): Promise<TaskExecution> {
    return await this.model.update({
      where: { id },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        executorId,
        workerId,
        lastUpdateAt: new Date(),
      },
    });
  }

  async markCompleted(id: string, outputs: object, metrics?: object): Promise<TaskExecution> {
    const updateData: any = {
      status: 'COMPLETED',
      outputs: JSON.stringify(outputs),
      completedAt: new Date(),
      progress: 1.0,
      lastUpdateAt: new Date(),
    };

    if (metrics) {
      if (metrics.duration) updateData.duration = metrics.duration;
      if (metrics.tokensUsed) updateData.tokensUsed = metrics.tokensUsed;
      if (metrics.cost) updateData.cost = metrics.cost;
      if (metrics.memoryUsage) updateData.memoryUsage = metrics.memoryUsage;
      if (metrics.cpuTime) updateData.cpuTime = metrics.cpuTime;
    }

    return await this.model.update({
      where: { id },
      data: updateData,
    });
  }

  async markFailed(id: string, error: object, failureReason?: string): Promise<TaskExecution> {
    return await this.model.update({
      where: { id },
      data: {
        status: 'FAILED',
        error: JSON.stringify(error),
        failureReason,
        completedAt: new Date(),
        lastUpdateAt: new Date(),
      },
    });
  }

  async retry(id: string): Promise<TaskExecution> {
    const task = await this.model.findUnique({ where: { id } });
    if (!task) {
      throw new Error('Task execution not found');
    }

    if (task.retryCount >= task.maxRetries) {
      throw new Error('Maximum retry count exceeded');
    }

    // Calculate retry delay with exponential backoff
    const baseDelay = task.retryDelay || 1000;
    const retryDelay = baseDelay * Math.pow(2, task.retryCount);

    return await this.model.update({
      where: { id },
      data: {
        status: 'PENDING',
        retryCount: task.retryCount + 1,
        startedAt: null,
        completedAt: null,
        error: null,
        failureReason: null,
        progress: 0.0,
        state: null,
        queuedAt: new Date(Date.now() + retryDelay),
        lastUpdateAt: new Date(),
      },
    });
  }

  async getDependencies(id: string): Promise<string[]> {
    const task = await this.model.findUnique({
      where: { id },
      select: { dependencies: true },
    });

    if (!task?.dependencies) {
      return [];
    }

    try {
      return JSON.parse(task.dependencies) as string[];
    } catch {
      return [];
    }
  }

  async areDependenciesComplete(id: string): Promise<boolean> {
    const task = await this.model.findUnique({
      where: { id },
      select: { dependencies: true, runId: true },
    });

    if (!task?.dependencies) {
      return true; // No dependencies
    }

    let dependencyNodeIds: string[];
    try {
      dependencyNodeIds = JSON.parse(task.dependencies) as string[];
    } catch {
      return true; // Invalid dependencies JSON, assume no dependencies
    }

    if (dependencyNodeIds.length === 0) {
      return true;
    }

    // Check if all dependency tasks are completed
    const dependencyTasks = await this.model.findMany({
      where: {
        runId: task.runId,
        nodeId: { in: dependencyNodeIds },
      },
      select: { status: true },
    });

    return dependencyTasks.every(dep => dep.status === 'COMPLETED');
  }

  async getExecutionOrder(runId: string): Promise<TaskExecution[]> {
    return await this.model.findMany({
      where: { runId },
      orderBy: [{ executionOrder: 'asc' }, { queuedAt: 'asc' }],
    });
  }

  async updateCache(id: string, cacheKey: string, cached: boolean): Promise<TaskExecution> {
    return await this.model.update({
      where: { id },
      data: {
        cacheKey,
        cached,
        lastUpdateAt: new Date(),
      },
    });
  }

  /**
   * Find tasks that have timed out
   */
  async findTimedOut(): Promise<TaskExecution[]> {
    return await this.model.findMany({
      where: {
        status: 'RUNNING',
        timeoutAt: {
          lte: new Date(),
        },
      },
    });
  }

  /**
   * Create checkpoint for long-running task
   */
  async createCheckpoint(id: string, checkpoint: object): Promise<TaskExecution> {
    return await this.model.update({
      where: { id },
      data: {
        checkpoint: JSON.stringify(checkpoint),
        lastUpdateAt: new Date(),
      },
    });
  }

  /**
   * Get task metrics and statistics
   */
  async getTaskMetrics(id: string): Promise<object> {
    const task = await this.model.findUnique({
      where: { id },
      select: {
        duration: true,
        tokensUsed: true,
        cost: true,
        memoryUsage: true,
        cpuTime: true,
        retryCount: true,
        cached: true,
        queuedAt: true,
        startedAt: true,
        completedAt: true,
        progress: true,
      },
    });

    if (!task) {
      throw new Error('Task execution not found');
    }

    return {
      ...task,
      queueTime: task.startedAt ? task.startedAt.getTime() - task.queuedAt.getTime() : null,
      totalTime: task.completedAt ? task.completedAt.getTime() - task.queuedAt.getTime() : null,
      executionTime: task.duration,
      cacheHit: task.cached,
    };
  }

  /**
   * Get task execution statistics for a node type
   */
  async getNodeTypeStats(
    nodeType: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<object> {
    const whereClause: any = { nodeType };

    if (timeRange) {
      whereClause.queuedAt = {
        gte: timeRange.start,
        lte: timeRange.end,
      };
    }

    const [totalTasks, statusCounts, avgMetrics] = await Promise.all([
      this.model.count({ where: whereClause }),

      this.model.groupBy({
        by: ['status'],
        where: whereClause,
        _count: { id: true },
      }),

      this.model.aggregate({
        where: {
          ...whereClause,
          status: 'COMPLETED',
          duration: { not: null },
        },
        _avg: {
          duration: true,
          tokensUsed: true,
          cost: true,
          memoryUsage: true,
          retryCount: true,
        },
      }),
    ]);

    const statusMap = statusCounts.reduce(
      (acc, { status, _count }) => {
        acc[status] = _count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      nodeType,
      totalTasks,
      statusCounts: statusMap,
      successRate: totalTasks > 0 ? ((statusMap.COMPLETED || 0) / totalTasks) * 100 : 0,
      averageMetrics: avgMetrics,
      timeRange,
    };
  }

  /**
   * Find tasks by execution status and run
   */
  async findByStatus(runId: string, status: ExecutionStatus): Promise<TaskExecution[]> {
    return await this.model.findMany({
      where: {
        runId,
        status,
      },
      orderBy: {
        executionOrder: 'asc',
      },
    });
  }

  /**
   * Update task inputs (for dynamic pipeline modifications)
   */
  async updateInputs(id: string, inputs: object): Promise<TaskExecution> {
    return await this.model.update({
      where: { id },
      data: {
        inputs: JSON.stringify(inputs),
        lastUpdateAt: new Date(),
      },
    });
  }

  /**
   * Get execution timeline for a run
   */
  async getExecutionTimeline(runId: string): Promise<
    Array<{
      taskId: string;
      nodeId: string;
      nodeName: string;
      status: ExecutionStatus;
      queuedAt: Date;
      startedAt: Date | null;
      completedAt: Date | null;
      duration: number | null;
      executionOrder: number;
    }>
  > {
    return await this.model
      .findMany({
        where: { runId },
        select: {
          id: true,
          nodeId: true,
          nodeName: true,
          status: true,
          queuedAt: true,
          startedAt: true,
          completedAt: true,
          duration: true,
          executionOrder: true,
        },
        orderBy: {
          executionOrder: 'asc',
        },
      })
      .then(tasks =>
        tasks.map(task => ({
          taskId: task.id,
          nodeId: task.nodeId,
          nodeName: task.nodeName,
          status: task.status,
          queuedAt: task.queuedAt,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
          duration: task.duration,
          executionOrder: task.executionOrder,
        }))
      );
  }
}
