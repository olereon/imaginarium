/**
 * Database utilities and connection management
 */

import { prisma } from './prisma.js'
import type { 
  User, 
  Pipeline, 
  PipelineRun, 
  CreateUserInput,
  CreatePipelineInput,
  UpdateUserInput,
  UpdatePipelineInput
} from '@imaginarium/shared'

/**
 * Database connection health check
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('Database connection failed:', error)
    return false
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats() {
  const [
    userCount,
    pipelineCount,
    executionCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.pipeline.count(),
    prisma.pipelineRun.count(),
  ])

  return {
    users: userCount,
    pipelines: pipelineCount,
    executions: executionCount,
  }
}

/**
 * Database transaction helper
 */
export async function withTransaction<T>(
  callback: (tx: typeof prisma) => Promise<T>
): Promise<T> {
  return prisma.$transaction(callback)
}

/**
 * Cleanup old data based on retention policies
 */
export async function cleanupOldData() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  
  // Delete old execution logs
  const deletedLogs = await prisma.executionLog.deleteMany({
    where: {
      timestamp: {
        lt: thirtyDaysAgo,
      },
      run: {
        status: 'COMPLETED',
      },
    },
  })
  
  // Delete expired sessions
  const deletedSessions = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  })
  
  return {
    deletedLogs: deletedLogs.count,
    deletedSessions: deletedSessions.count,
  }
}

// Re-export prisma instance for direct access when needed
export { prisma }