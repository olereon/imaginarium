/**
 * Type definitions for factory functions
 */

import { User, Pipeline, PipelineRun, TaskExecution, FileUpload, Artifact, PipelineTemplate } from '@prisma/client'

// User factory types
export interface UserCreateInput {
  email: string
  passwordHash: string
  name?: string
  firstName?: string
  lastName?: string
  avatar?: string
  bio?: string
  company?: string
  location?: string
  website?: string
  timezone?: string
  role?: 'ADMIN' | 'EDITOR' | 'VIEWER'
  isActive?: boolean
  emailVerified?: boolean
  emailOnPipelineComplete?: boolean
  emailOnPipelineError?: boolean
  emailOnWeeklyReport?: boolean
  maxPipelines?: number
  maxExecutionsPerMonth?: number
  twoFactorEnabled?: boolean
  twoFactorSecret?: string
  passwordResetToken?: string
  passwordResetExpires?: Date
  emailVerificationToken?: string
  emailVerificationExpires?: Date
  deletedAt?: Date
  deletedBy?: string
  lastLoginAt?: Date
}

// Pipeline factory types
export interface PipelineCreateInput {
  userId: string
  name: string
  description?: string
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  isPublic?: boolean
  configuration: string
  metadata?: string
  version?: number
  parentId?: string
  deletedAt?: Date
  deletedBy?: string
  publishedAt?: Date
  archivedAt?: Date
}

// Pipeline Run factory types
export interface ExecutionCreateInput {
  pipelineId: string
  userId: string
  status?: 'QUEUED' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  inputs?: string
  outputs?: string
  configuration: string
  context?: string
  duration?: number
  tokensUsed?: number
  estimatedCost?: number
  actualCost?: number
  memoryUsage?: number
  cpuTime?: number
  error?: string
  retryCount?: number
  maxRetries?: number
  retryStrategy?: string
  failureReason?: string
  progress?: number
  currentTaskId?: string
  totalTasks?: number
  completedTasks?: number
  priority?: number
  scheduledFor?: Date
  timeoutAt?: Date
  executorId?: string
  environment?: string
  version?: string
  startedAt?: Date
  completedAt?: Date
  lastUpdateAt?: Date
}

// File factory types
export interface FileCreateInput {
  userId: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  storageProvider?: string
  storageKey: string
  s3Bucket?: string
  s3Key?: string
  s3Region?: string
  s3Etag?: string
  storageClass?: string
  checksum?: string
  checksumType?: string
  encoding?: string
  contentType?: string
  metadata?: string
  dimensions?: string
  duration?: number
  quality?: string
  compression?: string
  status?: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'
  processingError?: string
  processingStage?: string
  processingProgress?: number
  isPublic?: boolean
  accessLevel?: string
  encryptionKey?: string
  isEncrypted?: boolean
  expiresAt?: Date
  lastAccessedAt?: Date
  downloadCount?: number
  virusScanned?: boolean
  virusScanResult?: string
  virusScanAt?: Date
  deletedAt?: Date
  deletedBy?: string
}

// Template factory types
export interface TemplateCreateInput {
  pipelineId?: string
  name: string
  description?: string
  category: string
  configuration: string
  parameters: string
  isPublic?: boolean
  usageCount?: number
}

// Task execution factory types
export interface TaskExecutionCreateInput {
  runId: string
  nodeId: string
  nodeName: string
  nodeType: string
  status?: 'QUEUED' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  inputs?: string
  outputs?: string
  configuration: string
  executionOrder: number
  dependencies?: string
  dependents?: string
  duration?: number
  tokensUsed?: number
  cost?: number
  memoryUsage?: number
  cpuTime?: number
  error?: string
  retryCount?: number
  maxRetries?: number
  retryDelay?: number
  failureReason?: string
  progress?: number
  state?: string
  checkpoint?: string
  executorId?: string
  workerId?: string
  startedAt?: Date
  completedAt?: Date
  timeoutAt?: Date
  lastUpdateAt?: Date
  cacheKey?: string
  cached?: boolean
}

// Artifact factory types
export interface ArtifactCreateInput {
  runId: string
  taskId?: string
  fileId?: string
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'TEXT' | 'JSON' | 'CSV' | 'XML' | 'PDF' | 'ARCHIVE' | 'BINARY' | 'OTHER'
  name: string
  description?: string
  version?: number
  parentId?: string
  isLatest?: boolean
  versionNotes?: string
  storageKey: string
  size: number
  mimeType?: string
  checksum?: string
  checksumType?: string
  s3Bucket?: string
  s3Key?: string
  s3Region?: string
  s3Etag?: string
  s3VersionId?: string
  metadata?: string
  dimensions?: string
  duration?: number
  quality?: string
  format?: string
  category?: string
  tags?: string
  importance?: string
  status?: 'ACTIVE' | 'ARCHIVED' | 'EXPIRED' | 'DELETED' | 'CORRUPTED'
  expiresAt?: Date
  retentionDays?: number
  isPublic?: boolean
  accessLevel?: string
  downloadCount?: number
  lastAccessedAt?: Date
  nodeId?: string
  nodeName?: string
  nodeType?: string
  pipelineVersion?: string
  processingTime?: number
  processingCost?: number
  deletedAt?: Date
  deletedBy?: string
}

// Execution log factory types
export interface ExecutionLogCreateInput {
  runId: string
  taskId?: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  message: string
  metadata?: string
  category?: string
  source?: string
  correlationId?: string
  sequenceNumber?: number
  streamId?: string
  errorCode?: string
  stackTrace?: string
  duration?: number
  memorySnapshot?: number
  timestamp?: Date
}

// Session factory types
export interface SessionCreateInput {
  userId: string
  token: string
  refreshToken: string
  expiresAt: Date
  userAgent?: string
  ipAddress?: string
  deviceType?: string
  browser?: string
  os?: string
  country?: string
  city?: string
  isRevoked?: boolean
  revokedAt?: Date
  revokedReason?: string
  sessionType?: 'WEB' | 'MOBILE' | 'API' | 'CLI' | 'INTEGRATION'
  fingerprint?: string
  deletedAt?: Date
  lastUsedAt?: Date
}

// API Key factory types
export interface ApiKeyCreateInput {
  userId: string
  name: string
  description?: string
  key: string
  keyPrefix: string
  permissions: string
  scopes?: string
  allowedIps?: string
  allowedDomains?: string
  rateLimit?: number
  rateLimitWindow?: string
  totalRequests?: number
  lastUsedAt?: Date
  lastUsedIp?: string
  expiresAt?: Date
  isActive?: boolean
  isRevoked?: boolean
  revokedAt?: Date
  revokedReason?: string
  deletedAt?: Date
}

// Provider credential factory types
export interface ProviderCredentialCreateInput {
  name: string
  provider: string
  credentials: string
  isActive?: boolean
  isDefault?: boolean
  lastUsedAt?: Date
  usageCount?: number
  deletedAt?: Date
}

// Factory result types
export interface FactoryResult<T> {
  data: T
  dependencies: string[]
  metadata?: Record<string, any>
}

// Batch factory types
export interface BatchFactoryOptions {
  count: number
  batchSize?: number
  parallel?: boolean
  onProgress?: (completed: number, total: number) => void
}

// Performance testing types
export interface PerformanceDatasetConfig {
  users: number
  pipelines: number
  executions: number
  files: number
  artifacts: number
  logs: number
  sessions: number
  apiKeys: number
  templates: number
}

// Relationship configuration
export interface RelationshipConfig {
  userToPipelines: number
  pipelineToExecutions: number
  executionToTasks: number
  executionToLogs: number
  taskToArtifacts: number
  userToSessions: number
  userToApiKeys: number
  userToFiles: number
}

// Seeding configuration
export interface SeedingConfig {
  environment: 'development' | 'testing' | 'performance'
  clearDatabase: boolean
  datasets: PerformanceDatasetConfig
  relationships: RelationshipConfig
  fixtures: {
    users: boolean
    pipelines: boolean
    templates: boolean
    credentials: boolean
  }
  options: {
    seed: number
    locale: string
    timezone: string
    verbose: boolean
  }
}