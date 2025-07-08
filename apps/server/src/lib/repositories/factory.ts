/**
 * Repository factory implementation with transaction support
 */

import { PrismaClient } from '@prisma/client'
import { prisma } from '../prisma.js'
import type { 
  IRepositoryFactory, 
  IUserRepository, 
  IPipelineRepository, 
  IExecutionRepository, 
  IFileRepository,
  TransactionContext 
} from './interfaces/index.js'

// Import repository implementations (these will need to be updated to implement the interfaces)
import { UserRepository } from './user.repository.js'
import { PipelineRepository } from './pipeline.repository.js'
// These will need to be created or updated
// import { ExecutionRepository } from './execution.repository.js'
// import { FileRepository } from './file.repository.js'

export class RepositoryFactory implements IRepositoryFactory {
  private static instance: RepositoryFactory
  private userRepository: IUserRepository
  private pipelineRepository: IPipelineRepository
  private executionRepository: IExecutionRepository
  private fileRepository: IFileRepository

  private constructor() {
    // Initialize repository instances
    this.userRepository = new UserRepository()
    this.pipelineRepository = new PipelineRepository()
    
    // TODO: Initialize these when implementations are ready
    // this.executionRepository = new ExecutionRepository()
    // this.fileRepository = new FileRepository()
    
    // Temporary placeholders
    this.executionRepository = {} as IExecutionRepository
    this.fileRepository = {} as IFileRepository
  }

  public static getInstance(): RepositoryFactory {
    if (!RepositoryFactory.instance) {
      RepositoryFactory.instance = new RepositoryFactory()
    }
    return RepositoryFactory.instance
  }

  /**
   * Execute operations within a database transaction
   */
  async withTransaction<T>(
    operation: (context: TransactionContext) => Promise<T>
  ): Promise<T> {
    return await prisma.$transaction(async (tx) => {
      const context: TransactionContext = { tx }
      return await operation(context)
    })
  }

  /**
   * Get user repository instance
   */
  getUserRepository(): IUserRepository {
    return this.userRepository
  }

  /**
   * Get pipeline repository instance
   */
  getPipelineRepository(): IPipelineRepository {
    return this.pipelineRepository
  }

  /**
   * Get execution repository instance
   */
  getExecutionRepository(): IExecutionRepository {
    return this.executionRepository
  }

  /**
   * Get file repository instance
   */
  getFileRepository(): IFileRepository {
    return this.fileRepository
  }

  /**
   * Reset repository instances (useful for testing)
   */
  reset(): void {
    this.userRepository = new UserRepository()
    this.pipelineRepository = new PipelineRepository()
    // this.executionRepository = new ExecutionRepository()
    // this.fileRepository = new FileRepository()
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    await prisma.$disconnect()
  }
}

// Export singleton instance
export const repositoryFactory = RepositoryFactory.getInstance()

// Export convenience functions
export const withTransaction = repositoryFactory.withTransaction.bind(repositoryFactory)
export const getUserRepository = repositoryFactory.getUserRepository.bind(repositoryFactory)
export const getPipelineRepository = repositoryFactory.getPipelineRepository.bind(repositoryFactory)
export const getExecutionRepository = repositoryFactory.getExecutionRepository.bind(repositoryFactory)
export const getFileRepository = repositoryFactory.getFileRepository.bind(repositoryFactory)