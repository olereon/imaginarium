/**
 * Pipeline repository interface with pipeline-specific operations
 */

import type { Pipeline, PipelineStatus, PipelineVersion, PipelineTemplate, PipelineRun } from '@prisma/client'
import type { 
  ISoftDeleteRepository, 
  FilterOptions, 
  PaginatedResult, 
  TransactionContext,
  BulkOperationResult 
} from './base.interface.js'

// Pipeline-specific types
export interface CreatePipelineInput {
  userId: string
  name: string
  description?: string
  configuration: string | object
  metadata?: string | object
  isPublic?: boolean
  status?: PipelineStatus
  parentId?: string
}

export interface UpdatePipelineInput {
  name?: string
  description?: string
  configuration?: string | object
  metadata?: string | object
  isPublic?: boolean
  status?: PipelineStatus
  version?: number
  publishedAt?: Date
  archivedAt?: Date
}

export interface PipelineWithRelations extends Pipeline {
  user?: any
  versions?: PipelineVersion[]
  runs?: PipelineRun[]
  templates?: PipelineTemplate[]
  parent?: Pipeline
  children?: Pipeline[]
}

export interface PipelineStats {
  totalRuns: number
  successfulRuns: number
  failedRuns: number
  successRate: number
  avgDuration: number
  totalCost: number
  avgCost: number
  lastRunAt: Date | null
  popularityScore: number
  usageCount: number
}

export interface PipelineConfiguration {
  nodes: Array<{
    id: string
    type: string
    position: { x: number; y: number }
    data: Record<string, any>
    inputs?: Record<string, any>
    outputs?: Record<string, any>
  }>
  connections: Array<{
    id: string
    source: string
    target: string
    sourceHandle?: string
    targetHandle?: string
    animated?: boolean
    style?: Record<string, any>
  }>
  settings?: {
    name?: string
    description?: string
    timeout?: number
    retryPolicy?: {
      maxRetries: number
      backoffStrategy: 'exponential' | 'linear' | 'fixed'
      baseDelay: number
    }
    environment?: Record<string, any>
    variables?: Record<string, any>
  }
}

export interface PipelineTemplate {
  id: string
  name: string
  description?: string
  category: string
  configuration: PipelineConfiguration
  parameters: Record<string, any>
  tags: string[]
  isPublic: boolean
  usageCount: number
  createdAt: Date
  updatedAt: Date
}

export interface PipelineSearchOptions {
  query?: string
  userId?: string
  status?: PipelineStatus[]
  isPublic?: boolean
  tags?: string[]
  categories?: string[]
  nodeTypes?: string[]
  complexity?: 'simple' | 'medium' | 'complex'
  popularity?: 'low' | 'medium' | 'high'
  dateRange?: {
    from?: Date
    to?: Date
  }
}

// Pipeline repository interface
export interface IPipelineRepository extends ISoftDeleteRepository<Pipeline, CreatePipelineInput, UpdatePipelineInput> {
  // Basic pipeline operations
  findByUserId(userId: string, status?: PipelineStatus, context?: TransactionContext): Promise<Pipeline[]>
  findPublic(options?: FilterOptions<Pipeline>, context?: TransactionContext): Promise<Pipeline[]>
  findByStatus(status: PipelineStatus, context?: TransactionContext): Promise<Pipeline[]>
  
  // Version management
  findWithVersions(id: string, context?: TransactionContext): Promise<PipelineWithRelations | null>
  createVersion(
    pipelineId: string, 
    createdBy: string, 
    changelog?: string,
    context?: TransactionContext
  ): Promise<PipelineVersion>
  getVersions(pipelineId: string, context?: TransactionContext): Promise<PipelineVersion[]>
  restoreVersion(pipelineId: string, version: number, context?: TransactionContext): Promise<Pipeline>
  compareVersions(
    pipelineId: string, 
    version1: number, 
    version2: number,
    context?: TransactionContext
  ): Promise<any>
  
  // Configuration management
  getConfiguration(id: string, context?: TransactionContext): Promise<PipelineConfiguration | null>
  updateConfiguration(
    id: string, 
    configuration: PipelineConfiguration, 
    userId: string,
    createVersion?: boolean,
    changelog?: string,
    context?: TransactionContext
  ): Promise<Pipeline>
  validateConfiguration(configuration: PipelineConfiguration): Promise<{ isValid: boolean; errors: string[] }>
  optimizeConfiguration(configuration: PipelineConfiguration): Promise<PipelineConfiguration>
  
  // Metadata management
  getMetadata(id: string, context?: TransactionContext): Promise<any>
  updateMetadata(id: string, metadata: any, context?: TransactionContext): Promise<Pipeline>
  addTag(id: string, tag: string, context?: TransactionContext): Promise<Pipeline>
  removeTag(id: string, tag: string, context?: TransactionContext): Promise<Pipeline>
  setTags(id: string, tags: string[], context?: TransactionContext): Promise<Pipeline>
  
  // Execution relationships
  findWithRuns(id: string, limit?: number, context?: TransactionContext): Promise<PipelineWithRelations | null>
  getRecentRuns(id: string, limit?: number, context?: TransactionContext): Promise<PipelineRun[]>
  getRunStats(id: string, context?: TransactionContext): Promise<PipelineStats>
  
  // Pipeline operations
  duplicate(id: string, userId: string, name?: string, context?: TransactionContext): Promise<Pipeline>
  clone(id: string, userId: string, options?: { name?: string; includeVersions?: boolean }, context?: TransactionContext): Promise<Pipeline>
  publish(id: string, context?: TransactionContext): Promise<Pipeline>
  unpublish(id: string, context?: TransactionContext): Promise<Pipeline>
  archive(id: string, context?: TransactionContext): Promise<Pipeline>
  unarchive(id: string, context?: TransactionContext): Promise<Pipeline>
  
  // Search and discovery
  search(options: PipelineSearchOptions, context?: TransactionContext): Promise<Pipeline[]>
  searchAdvanced(
    query: string,
    filters: {
      userId?: string
      status?: PipelineStatus[]
      isPublic?: boolean
      tags?: string[]
      nodeTypes?: string[]
      complexity?: string
      dateRange?: { from?: Date; to?: Date }
    },
    context?: TransactionContext
  ): Promise<Pipeline[]>
  
  // Analytics and statistics
  getPopular(limit?: number, timeRange?: { from?: Date; to?: Date }, context?: TransactionContext): Promise<Pipeline[]>
  getTrending(limit?: number, context?: TransactionContext): Promise<Pipeline[]>
  getRecommended(userId: string, limit?: number, context?: TransactionContext): Promise<Pipeline[]>
  getPipelineStats(id: string, context?: TransactionContext): Promise<PipelineStats>
  getUsageAnalytics(
    id: string,
    options?: {
      timeRange?: { from?: Date; to?: Date }
      granularity?: 'hour' | 'day' | 'week' | 'month'
    },
    context?: TransactionContext
  ): Promise<any[]>
  
  // Templates
  createTemplate(
    pipelineId: string,
    templateData: {
      name: string
      description?: string
      category: string
      parameters: Record<string, any>
      tags?: string[]
      isPublic?: boolean
    },
    context?: TransactionContext
  ): Promise<PipelineTemplate>
  findTemplates(
    options?: {
      category?: string
      tags?: string[]
      isPublic?: boolean
      limit?: number
    },
    context?: TransactionContext
  ): Promise<PipelineTemplate[]>
  createFromTemplate(
    templateId: string,
    userId: string,
    parameters: Record<string, any>,
    context?: TransactionContext
  ): Promise<Pipeline>
  
  // Validation and analysis
  validatePipeline(id: string, context?: TransactionContext): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }>
  analyzePipeline(id: string, context?: TransactionContext): Promise<{
    complexity: number
    estimatedCost: number
    estimatedDuration: number
    nodeCount: number
    connectionCount: number
    cycleDetection: boolean
    suggestions: string[]
  }>
  
  // Bulk operations
  bulkPublish(pipelineIds: string[], context?: TransactionContext): Promise<BulkOperationResult>
  bulkArchive(pipelineIds: string[], context?: TransactionContext): Promise<BulkOperationResult>
  bulkUpdateStatus(pipelineIds: string[], status: PipelineStatus, context?: TransactionContext): Promise<BulkOperationResult>
  bulkUpdateTags(pipelineIds: string[], tags: string[], context?: TransactionContext): Promise<BulkOperationResult>
  
  // Dependencies and relationships
  findDependencies(id: string, context?: TransactionContext): Promise<Pipeline[]>
  findDependents(id: string, context?: TransactionContext): Promise<Pipeline[]>
  findSimilar(id: string, limit?: number, context?: TransactionContext): Promise<Pipeline[]>
  
  // Import and export
  exportPipeline(id: string, options?: { includeVersions?: boolean; includeRuns?: boolean }, context?: TransactionContext): Promise<any>
  importPipeline(data: any, userId: string, context?: TransactionContext): Promise<Pipeline>
  
  // Collaboration
  shareWithUser(pipelineId: string, userId: string, permissions: string[], context?: TransactionContext): Promise<void>
  unshareWithUser(pipelineId: string, userId: string, context?: TransactionContext): Promise<void>
  getSharedUsers(pipelineId: string, context?: TransactionContext): Promise<any[]>
  
  // Performance optimization
  findByConfigurationPattern(pattern: {
    nodeType?: string
    hasConnections?: boolean
    minNodes?: number
    maxNodes?: number
    complexity?: string
  }, context?: TransactionContext): Promise<Pipeline[]>
  
  // Maintenance and cleanup
  cleanupVersions(pipelineId: string, keepCount: number, context?: TransactionContext): Promise<number>
  optimizeStorage(context?: TransactionContext): Promise<number>
  
  // Monitoring and alerts
  getHealthStatus(id: string, context?: TransactionContext): Promise<{
    status: 'healthy' | 'warning' | 'critical'
    issues: string[]
    lastCheck: Date
  }>
}