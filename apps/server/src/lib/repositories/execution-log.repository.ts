/**
 * Execution Log repository for managing streaming logs and execution output
 */

import { ExecutionLog, LogLevel, type CreateExecutionLogInput } from '@imaginarium/shared';
import { BaseRepository } from './base.repository.js';
import { prisma } from '../database.js';

export interface IExecutionLogRepository {
  findByRunId(runId: string, limit?: number, offset?: number): Promise<ExecutionLog[]>;
  findByTaskId(taskId: string, limit?: number): Promise<ExecutionLog[]>;
  findByLevel(runId: string, level: LogLevel): Promise<ExecutionLog[]>;
  findByCategory(runId: string, category: string): Promise<ExecutionLog[]>;
  findStreaming(streamId: string): Promise<ExecutionLog[]>;
  createBatch(logs: CreateExecutionLogInput[]): Promise<ExecutionLog[]>;
  getLogStream(runId: string, fromSequence?: number): Promise<ExecutionLog[]>;
  searchLogs(runId: string, query: string): Promise<ExecutionLog[]>;
  getLogStats(runId: string): Promise<object>;
  getErrorLogs(runId: string): Promise<ExecutionLog[]>;
  cleanup(olderThan: Date): Promise<number>;
}

export class ExecutionLogRepository
  extends BaseRepository<ExecutionLog, CreateExecutionLogInput, CreateExecutionLogInput>
  implements IExecutionLogRepository
{
  protected model = prisma.executionLog;

  async create(data: CreateExecutionLogInput): Promise<ExecutionLog> {
    return await this.model.create({
      data: {
        ...data,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    });
  }

  async findByRunId(runId: string, limit = 100, offset = 0): Promise<ExecutionLog[]> {
    return await this.model.findMany({
      where: { runId },
      orderBy: {
        sequenceNumber: 'asc',
      },
      take: limit,
      skip: offset,
    });
  }

  async findByTaskId(taskId: string, limit = 100): Promise<ExecutionLog[]> {
    return await this.model.findMany({
      where: { taskId },
      orderBy: {
        sequenceNumber: 'asc',
      },
      take: limit,
    });
  }

  async findByLevel(runId: string, level: LogLevel): Promise<ExecutionLog[]> {
    return await this.model.findMany({
      where: {
        runId,
        level,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  async findByCategory(runId: string, category: string): Promise<ExecutionLog[]> {
    return await this.model.findMany({
      where: {
        runId,
        category,
      },
      orderBy: {
        sequenceNumber: 'asc',
      },
    });
  }

  async findStreaming(streamId: string): Promise<ExecutionLog[]> {
    return await this.model.findMany({
      where: { streamId },
      orderBy: {
        sequenceNumber: 'asc',
      },
    });
  }

  async createBatch(logs: CreateExecutionLogInput[]): Promise<ExecutionLog[]> {
    const createData = logs.map(log => ({
      ...log,
      metadata: log.metadata ? JSON.stringify(log.metadata) : null,
    }));

    await this.model.createMany({
      data: createData,
    });

    // Return the created logs (Prisma createMany doesn't return data)
    const runIds = [...new Set(logs.map(log => log.runId))];
    const maxSequence = Math.max(...logs.map(log => log.sequenceNumber));
    const minSequence = Math.min(...logs.map(log => log.sequenceNumber));

    return await this.model.findMany({
      where: {
        runId: { in: runIds },
        sequenceNumber: {
          gte: minSequence,
          lte: maxSequence,
        },
      },
      orderBy: {
        sequenceNumber: 'asc',
      },
    });
  }

  async getLogStream(runId: string, fromSequence = 0): Promise<ExecutionLog[]> {
    return await this.model.findMany({
      where: {
        runId,
        sequenceNumber: {
          gt: fromSequence,
        },
      },
      orderBy: {
        sequenceNumber: 'asc',
      },
    });
  }

  async searchLogs(runId: string, query: string): Promise<ExecutionLog[]> {
    return await this.model.findMany({
      where: {
        runId,
        message: {
          contains: query,
          mode: 'insensitive',
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  async getLogStats(runId: string): Promise<object> {
    const [totalLogs, levelCounts, categoryCounts, errorDetails] = await Promise.all([
      this.model.count({ where: { runId } }),

      this.model.groupBy({
        by: ['level'],
        where: { runId },
        _count: { id: true },
      }),

      this.model.groupBy({
        by: ['category'],
        where: { runId, category: { not: null } },
        _count: { id: true },
      }),

      this.model.findMany({
        where: {
          runId,
          level: 'ERROR',
        },
        select: {
          errorCode: true,
          message: true,
          timestamp: true,
          taskId: true,
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: 10,
      }),
    ]);

    const levelMap = levelCounts.reduce(
      (acc, { level, _count }) => {
        acc[level] = _count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    const categoryMap = categoryCounts.reduce(
      (acc, { category, _count }) => {
        if (category) acc[category] = _count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalLogs,
      levelCounts: levelMap,
      categoryCounts: categoryMap,
      errorCount: levelMap.ERROR || 0,
      warningCount: levelMap.WARN || 0,
      recentErrors: errorDetails,
    };
  }

  async getErrorLogs(runId: string): Promise<ExecutionLog[]> {
    return await this.model.findMany({
      where: {
        runId,
        level: 'ERROR',
      },
      orderBy: {
        timestamp: 'desc',
      },
      include: {
        task: {
          select: {
            id: true,
            nodeId: true,
            nodeName: true,
            nodeType: true,
          },
        },
      },
    });
  }

  async cleanup(olderThan: Date): Promise<number> {
    const result = await this.model.deleteMany({
      where: {
        timestamp: {
          lt: olderThan,
        },
        level: {
          in: ['DEBUG', 'INFO'], // Keep WARNING and ERROR logs longer
        },
      },
    });

    return result.count;
  }

  /**
   * Get logs for real-time streaming
   */
  async getRealtimeLogs(
    runId: string,
    lastSequence: number,
    levels?: LogLevel[]
  ): Promise<ExecutionLog[]> {
    const whereClause: any = {
      runId,
      sequenceNumber: { gt: lastSequence },
    };

    if (levels && levels.length > 0) {
      whereClause.level = { in: levels };
    }

    return await this.model.findMany({
      where: whereClause,
      orderBy: {
        sequenceNumber: 'asc',
      },
      take: 100, // Limit for real-time streaming
    });
  }

  /**
   * Create performance timing log
   */
  async logTiming(
    runId: string,
    taskId: string | undefined,
    operation: string,
    duration: number,
    metadata?: object
  ): Promise<ExecutionLog> {
    const sequenceNumber = await this.getNextSequenceNumber(runId);

    return await this.create({
      runId,
      taskId,
      level: 'INFO',
      message: `${operation} completed in ${duration}ms`,
      category: 'performance',
      source: 'timing',
      sequenceNumber,
      duration,
      metadata: {
        operation,
        duration,
        ...metadata,
      },
    });
  }

  /**
   * Create error log with stack trace
   */
  async logError(
    runId: string,
    taskId: string | undefined,
    error: Error,
    errorCode?: string,
    metadata?: object
  ): Promise<ExecutionLog> {
    const sequenceNumber = await this.getNextSequenceNumber(runId);

    return await this.create({
      runId,
      taskId,
      level: 'ERROR',
      message: error.message,
      category: 'error',
      source: 'exception',
      sequenceNumber,
      errorCode,
      stackTrace: error.stack,
      metadata: {
        errorName: error.name,
        ...metadata,
      },
    });
  }

  /**
   * Create progress log
   */
  async logProgress(
    runId: string,
    taskId: string,
    progress: number,
    message: string,
    metadata?: object
  ): Promise<ExecutionLog> {
    const sequenceNumber = await this.getNextSequenceNumber(runId);

    return await this.create({
      runId,
      taskId,
      level: 'INFO',
      message,
      category: 'progress',
      source: 'execution',
      sequenceNumber,
      metadata: {
        progress,
        ...metadata,
      },
    });
  }

  /**
   * Get next sequence number for a run
   */
  private async getNextSequenceNumber(runId: string): Promise<number> {
    const lastLog = await this.model.findFirst({
      where: { runId },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    });

    return (lastLog?.sequenceNumber || 0) + 1;
  }

  /**
   * Get log context around a specific sequence number
   */
  async getLogContext(
    runId: string,
    sequenceNumber: number,
    contextSize = 10
  ): Promise<ExecutionLog[]> {
    const start = Math.max(0, sequenceNumber - contextSize);
    const end = sequenceNumber + contextSize;

    return await this.model.findMany({
      where: {
        runId,
        sequenceNumber: {
          gte: start,
          lte: end,
        },
      },
      orderBy: {
        sequenceNumber: 'asc',
      },
    });
  }

  /**
   * Export logs to external format
   */
  async exportLogs(runId: string, format: 'json' | 'csv' | 'text' = 'json'): Promise<string> {
    const logs = await this.model.findMany({
      where: { runId },
      orderBy: { sequenceNumber: 'asc' },
      include: {
        task: {
          select: {
            nodeId: true,
            nodeName: true,
            nodeType: true,
          },
        },
      },
    });

    switch (format) {
      case 'json':
        return JSON.stringify(logs, null, 2);

      case 'csv':
        const headers = 'Timestamp,Level,Category,Source,Task,Message,ErrorCode\n';
        const rows = logs
          .map(log => {
            const task = log.task ? `${log.task.nodeName} (${log.task.nodeId})` : '';
            return [
              log.timestamp.toISOString(),
              log.level,
              log.category || '',
              log.source || '',
              task,
              `"${log.message.replace(/"/g, '""')}"`,
              log.errorCode || '',
            ].join(',');
          })
          .join('\n');
        return headers + rows;

      case 'text':
        return logs
          .map(log => {
            const task = log.task ? ` [${log.task.nodeName}]` : '';
            return `${log.timestamp.toISOString()} ${log.level}${task}: ${log.message}`;
          })
          .join('\n');

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Get log aggregations for analytics
   */
  async getLogAggregations(
    runId: string,
    timeWindow: 'minute' | 'hour' = 'minute'
  ): Promise<
    Array<{
      timeWindow: string;
      totalLogs: number;
      errorCount: number;
      warningCount: number;
    }>
  > {
    const timeFormat =
      timeWindow === 'minute'
        ? "strftime('%Y-%m-%d %H:%M', timestamp)"
        : "strftime('%Y-%m-%d %H', timestamp)";

    const result = (await prisma.$queryRaw`
      SELECT 
        ${timeFormat} as timeWindow,
        COUNT(*) as totalLogs,
        SUM(CASE WHEN level = 'ERROR' THEN 1 ELSE 0 END) as errorCount,
        SUM(CASE WHEN level = 'WARN' THEN 1 ELSE 0 END) as warningCount
      FROM execution_logs 
      WHERE run_id = ${runId}
      GROUP BY ${timeFormat}
      ORDER BY timeWindow ASC
    `) as Array<{
      timeWindow: string;
      totalLogs: bigint;
      errorCount: bigint;
      warningCount: bigint;
    }>;

    return result.map(row => ({
      timeWindow: row.timeWindow,
      totalLogs: Number(row.totalLogs),
      errorCount: Number(row.errorCount),
      warningCount: Number(row.warningCount),
    }));
  }
}
