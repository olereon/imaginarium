/**
 * Database type exports
 *
 * Re-export Prisma generated types for use across the application
 */

export type {
  User,
  Session,
  ApiKey,
  Pipeline,
  PipelineVersion,
  PipelineTemplate,
  PipelineRun,
  TaskExecution,
  ExecutionLog,
  FileUpload,
  Artifact,
  Thumbnail,
  ProviderCredential,
  UserRole,
  PipelineStatus,
  ExecutionStatus,
  LogLevel,
  FileStatus,
  ArtifactType,
} from '@prisma/client';

// Import enum types for use in input types
import type { ExecutionStatus, LogLevel } from '@prisma/client';

// Re-export Prisma namespace for advanced types
export { Prisma } from '@prisma/client';

// Custom type utilities
export type WithTimestamps<T> = T & {
  createdAt: Date;
  updatedAt: Date;
};

export type WithOptionalTimestamps<T> = T & {
  createdAt?: Date;
  updatedAt?: Date;
};

export type OmitTimestamps<T> = Omit<T, 'createdAt' | 'updatedAt'>;

// Input types for creating/updating entities
export type CreateUserInput = {
  email: string;
  passwordHash: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  bio?: string;
  company?: string;
  location?: string;
  website?: string;
  timezone?: string;
  role?: 'ADMIN' | 'EDITOR' | 'VIEWER';
  emailOnPipelineComplete?: boolean;
  emailOnPipelineError?: boolean;
  emailOnWeeklyReport?: boolean;
  maxPipelines?: number;
  maxExecutionsPerMonth?: number;
};

export type UpdateUserInput = {
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  bio?: string;
  company?: string;
  location?: string;
  website?: string;
  timezone?: string;
  role?: 'ADMIN' | 'EDITOR' | 'VIEWER';
  isActive?: boolean;
  emailOnPipelineComplete?: boolean;
  emailOnPipelineError?: boolean;
  emailOnWeeklyReport?: boolean;
  maxPipelines?: number;
  maxExecutionsPerMonth?: number;
  twoFactorEnabled?: boolean;
};

export type CreatePipelineInput = {
  userId: string;
  name: string;
  description?: string;
  configuration: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type UpdatePipelineInput = {
  name?: string;
  description?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  configuration?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type CreatePipelineVersionInput = {
  pipelineId: string;
  version: number;
  configuration: string;
  changelog?: string;
  createdBy: string;
};

export type UpdatePipelineVersionInput = {
  changelog?: string;
};

// Execution model input types
export type CreatePipelineRunInput = {
  pipelineId: string;
  userId: string;
  inputs?: Record<string, unknown>;
  configuration: Record<string, unknown>;
  context?: Record<string, unknown>;
  priority?: number;
  scheduledFor?: Date;
  maxRetries?: number;
  retryStrategy?: Record<string, unknown>;
  timeoutAt?: Date;
};

export type UpdatePipelineRunInput = {
  status?: ExecutionStatus;
  outputs?: Record<string, unknown>;
  context?: Record<string, unknown>;
  progress?: number;
  currentTaskId?: string;
  error?: Record<string, unknown>;
  failureReason?: string;
  actualCost?: number;
  memoryUsage?: number;
  cpuTime?: number;
  environment?: Record<string, unknown>;
};

export type CreateTaskExecutionInput = {
  runId: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  configuration: Record<string, unknown>;
  executionOrder: number;
  dependencies?: string[];
  maxRetries?: number;
  retryDelay?: number;
  timeoutAt?: Date;
};

export type UpdateTaskExecutionInput = {
  status?: ExecutionStatus;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  progress?: number;
  state?: Record<string, unknown>;
  checkpoint?: Record<string, unknown>;
  error?: Record<string, unknown>;
  failureReason?: string;
  duration?: number;
  tokensUsed?: number;
  cost?: number;
  memoryUsage?: number;
  cpuTime?: number;
  cacheKey?: string;
  cached?: boolean;
};

export type CreateExecutionLogInput = {
  runId: string;
  taskId?: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
  category?: string;
  source?: string;
  correlationId?: string;
  sequenceNumber: number;
  streamId?: string;
  errorCode?: string;
  stackTrace?: string;
  duration?: number;
  memorySnapshot?: number;
};

// JSON field type helpers
export type PipelineConfiguration = {
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    config: Record<string, unknown>;
  }>;
  connections: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  }>;
  settings?: Record<string, unknown>;
};

export type PipelineMetadata = {
  tags?: string[];
  category?: string;
  version?: string;
  author?: string;
  [key: string]: unknown;
};

export type ExecutionContext = {
  variables: Record<string, unknown>;
  secrets: Record<string, string>;
  options: {
    timeout?: number;
    retryCount?: number;
    priority?: number;
  };
};

export type ExecutionError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
  nodeId?: string;
};
