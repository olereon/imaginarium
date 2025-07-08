/**
 * Authentication and user management exports
 */

export * from './user.service.js';
export * from './apikey.service.js';

// Repository exports
export * from '../repositories/user.repository.js';
export * from '../repositories/pipeline.repository.js';
export * from '../repositories/pipeline-version.repository.js';
export * from '../repositories/pipeline-run.repository.js';
export * from '../repositories/task-execution.repository.js';
export * from '../repositories/execution-log.repository.js';
export * from '../repositories/soft-delete.repository.js';

// Service exports
export * from '../services/pipeline.service.js';
export * from '../services/execution.service.js';

// Service instances for dependency injection
import { UserRepository } from '../repositories/user.repository.js';
import { PipelineRepository } from '../repositories/pipeline.repository.js';
import { PipelineVersionRepository } from '../repositories/pipeline-version.repository.js';
import { PipelineRunRepository } from '../repositories/pipeline-run.repository.js';
import { TaskExecutionRepository } from '../repositories/task-execution.repository.js';
import { ExecutionLogRepository } from '../repositories/execution-log.repository.js';
import { UserService } from './user.service.js';
import { ApiKeyService } from './apikey.service.js';
import { PipelineService } from '../services/pipeline.service.js';
import { ExecutionService } from '../services/execution.service.js';

// Create repository instances
export const userRepository = new UserRepository();
export const pipelineRepository = new PipelineRepository();
export const pipelineVersionRepository = new PipelineVersionRepository();
export const pipelineRunRepository = new PipelineRunRepository();
export const taskExecutionRepository = new TaskExecutionRepository();
export const executionLogRepository = new ExecutionLogRepository();

// Create service instances
export const userService = new UserService(userRepository);
export const apiKeyService = new ApiKeyService();
export const pipelineService = new PipelineService(pipelineRepository, pipelineVersionRepository);
export const executionService = new ExecutionService(
  pipelineRunRepository,
  taskExecutionRepository,
  executionLogRepository,
  pipelineRepository
);

// Database connection and utilities
export { prisma, checkDatabaseConnection, getDatabaseStats } from '../database.js';
