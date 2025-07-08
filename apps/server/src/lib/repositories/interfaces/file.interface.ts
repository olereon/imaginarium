/**
 * File repository interface with file-specific operations
 */

import type { 
  FileUpload, 
  Artifact, 
  FileReference, 
  Thumbnail,
  FileStatus,
  ArtifactType,
  ArtifactStatus,
  FileReferenceType
} from '@prisma/client'
import type { 
  IBaseRepository, 
  FilterOptions, 
  PaginatedResult, 
  TransactionContext,
  BulkOperationResult 
} from './base.interface.js'

// File-specific types
export interface CreateFileUploadInput {
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
  metadata?: string | object
  dimensions?: string | object
  duration?: number
  quality?: string
  compression?: string
  isPublic?: boolean
  accessLevel?: string
  encryptionKey?: string
  isEncrypted?: boolean
  expiresAt?: Date
}

export interface UpdateFileUploadInput {
  filename?: string
  mimeType?: string
  size?: number
  storageProvider?: string
  storageKey?: string
  s3Bucket?: string
  s3Key?: string
  s3Region?: string
  s3Etag?: string
  storageClass?: string
  checksum?: string
  checksumType?: string
  encoding?: string
  contentType?: string
  metadata?: string | object
  dimensions?: string | object
  duration?: number
  quality?: string
  compression?: string
  status?: FileStatus
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
}

export interface CreateArtifactInput {
  runId: string
  taskId?: string
  fileId?: string
  type: ArtifactType
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
  metadata?: string | object
  dimensions?: string | object
  duration?: number
  quality?: string
  format?: string
  category?: string
  tags?: string | object
  importance?: string
  status?: ArtifactStatus
  expiresAt?: Date
  retentionDays?: number
  isPublic?: boolean
  accessLevel?: string
  nodeId?: string
  nodeName?: string
  nodeType?: string
  pipelineVersion?: string
  processingTime?: number
  processingCost?: number
}

export interface UpdateArtifactInput {
  name?: string
  description?: string
  version?: number
  parentId?: string
  isLatest?: boolean
  versionNotes?: string
  storageKey?: string
  size?: number
  mimeType?: string
  checksum?: string
  checksumType?: string
  s3Bucket?: string
  s3Key?: string
  s3Region?: string
  s3Etag?: string
  s3VersionId?: string
  metadata?: string | object
  dimensions?: string | object
  duration?: number
  quality?: string
  format?: string
  category?: string
  tags?: string | object
  importance?: string
  status?: ArtifactStatus
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
}

export interface CreateFileReferenceInput {
  fileId?: string
  artifactId?: string
  runId: string
  taskId?: string
  referenceType: FileReferenceType
  purpose?: string
  contextPath?: string
  metadata?: string | object
  usage?: string | object
  accessedAt?: Date
  modifiedAt?: Date
  processingTime?: number
  checksumAtUse?: string
  sizeAtUse?: number
  isActive?: boolean
  notes?: string
}

export interface UpdateFileReferenceInput {
  referenceType?: FileReferenceType
  purpose?: string
  contextPath?: string
  metadata?: string | object
  usage?: string | object
  accessedAt?: Date
  modifiedAt?: Date
  processingTime?: number
  checksumAtUse?: string
  sizeAtUse?: number
  isActive?: boolean
  notes?: string
}

export interface FileWithRelations extends FileUpload {
  user?: any
  artifacts?: Artifact[]
  thumbnails?: Thumbnail[]
  references?: FileReference[]
}

export interface ArtifactWithRelations extends Artifact {
  run?: any
  task?: any
  file?: FileUpload
  parent?: Artifact
  versions?: Artifact[]
  references?: FileReference[]
}

export interface FileStats {
  totalFiles: number
  totalSize: number
  totalStorageCost: number
  filesByType: Record<string, number>
  filesByStatus: Record<string, number>
  avgFileSize: number
  uploadTrend: Array<{ date: Date; count: number; size: number }>
}

export interface StorageStats {
  totalStorage: number
  usedStorage: number
  availableStorage: number
  storageByProvider: Record<string, number>
  storageByUser: Record<string, number>
  storageByProject: Record<string, number>
  costBreakdown: Record<string, number>
}

export interface FileSearchOptions {
  userId?: string
  mimeType?: string
  minSize?: number
  maxSize?: number
  status?: FileStatus[]
  storageProvider?: string
  dateRange?: {
    from?: Date
    to?: Date
  }
  hasChecksum?: boolean
  isPublic?: boolean
  isEncrypted?: boolean
  tags?: string[]
}

export interface ArtifactSearchOptions {
  runId?: string
  taskId?: string
  type?: ArtifactType[]
  category?: string
  status?: ArtifactStatus[]
  importance?: string
  isLatest?: boolean
  nodeType?: string
  dateRange?: {
    from?: Date
    to?: Date
  }
  tags?: string[]
}

// File repository interface
export interface IFileRepository extends IBaseRepository<FileUpload, CreateFileUploadInput, UpdateFileUploadInput> {
  // File upload operations
  findByUserId(userId: string, context?: TransactionContext): Promise<FileUpload[]>
  findByStorageKey(storageKey: string, context?: TransactionContext): Promise<FileUpload | null>
  findByChecksum(checksum: string, context?: TransactionContext): Promise<FileUpload[]>
  findByMimeType(mimeType: string, context?: TransactionContext): Promise<FileUpload[]>
  findByStatus(status: FileStatus, context?: TransactionContext): Promise<FileUpload[]>
  findExpired(context?: TransactionContext): Promise<FileUpload[]>
  findPendingVirusScan(context?: TransactionContext): Promise<FileUpload[]>
  
  // File processing
  updateProcessingProgress(id: string, progress: number, stage?: string, context?: TransactionContext): Promise<FileUpload>
  markProcessingComplete(id: string, context?: TransactionContext): Promise<FileUpload>
  markProcessingFailed(id: string, error: string, context?: TransactionContext): Promise<FileUpload>
  
  // Access tracking
  recordAccess(id: string, context?: TransactionContext): Promise<FileUpload>
  updateDownloadCount(id: string, context?: TransactionContext): Promise<FileUpload>
  
  // Virus scanning
  markVirusScanned(id: string, result: string, context?: TransactionContext): Promise<FileUpload>
  findVirusInfected(context?: TransactionContext): Promise<FileUpload[]>
  
  // S3 operations
  findByS3Location(bucket: string, key: string, context?: TransactionContext): Promise<FileUpload | null>
  updateS3Metadata(id: string, etag: string, versionId?: string, context?: TransactionContext): Promise<FileUpload>
  findOrphanedS3Files(context?: TransactionContext): Promise<FileUpload[]>
  
  // Artifact operations
  createArtifact(data: CreateArtifactInput, context?: TransactionContext): Promise<Artifact>
  updateArtifact(id: string, data: UpdateArtifactInput, context?: TransactionContext): Promise<Artifact>
  findArtifactById(id: string, context?: TransactionContext): Promise<Artifact | null>
  findArtifactsByRunId(runId: string, context?: TransactionContext): Promise<Artifact[]>
  findArtifactsByTaskId(taskId: string, context?: TransactionContext): Promise<Artifact[]>
  findArtifactsByType(type: ArtifactType, context?: TransactionContext): Promise<Artifact[]>
  findArtifactsByStatus(status: ArtifactStatus, context?: TransactionContext): Promise<Artifact[]>
  
  // Artifact versioning
  createArtifactVersion(
    parentId: string,
    data: Omit<CreateArtifactInput, 'parentId'>,
    context?: TransactionContext
  ): Promise<Artifact>
  findArtifactVersions(parentId: string, context?: TransactionContext): Promise<Artifact[]>
  getLatestArtifactVersion(name: string, runId: string, context?: TransactionContext): Promise<Artifact | null>
  markAsLatestVersion(id: string, context?: TransactionContext): Promise<Artifact>
  
  // File reference operations
  createFileReference(data: CreateFileReferenceInput, context?: TransactionContext): Promise<FileReference>
  updateFileReference(id: string, data: UpdateFileReferenceInput, context?: TransactionContext): Promise<FileReference>
  findFileReferenceById(id: string, context?: TransactionContext): Promise<FileReference | null>
  findFileReferencesByRunId(runId: string, context?: TransactionContext): Promise<FileReference[]>
  findFileReferencesByTaskId(taskId: string, context?: TransactionContext): Promise<FileReference[]>
  findFileReferencesByFileId(fileId: string, context?: TransactionContext): Promise<FileReference[]>
  findFileReferencesByArtifactId(artifactId: string, context?: TransactionContext): Promise<FileReference[]>
  
  // Thumbnail operations
  createThumbnail(fileId: string, size: string, storageKey: string, context?: TransactionContext): Promise<Thumbnail>
  findThumbnailsByFileId(fileId: string, context?: TransactionContext): Promise<Thumbnail[]>
  findThumbnailBySize(fileId: string, size: string, context?: TransactionContext): Promise<Thumbnail | null>
  
  // Search and filtering
  searchFiles(options: FileSearchOptions, context?: TransactionContext): Promise<FileUpload[]>
  searchArtifacts(options: ArtifactSearchOptions, context?: TransactionContext): Promise<Artifact[]>
  findSimilarFiles(fileId: string, threshold?: number, context?: TransactionContext): Promise<FileUpload[]>
  findDuplicateFiles(context?: TransactionContext): Promise<FileUpload[][]>
  
  // Relationships
  findFileWithRelations(id: string, context?: TransactionContext): Promise<FileWithRelations | null>
  findArtifactWithRelations(id: string, context?: TransactionContext): Promise<ArtifactWithRelations | null>
  
  // Storage management
  getStorageStats(
    options?: {
      userId?: string
      storageProvider?: string
      dateRange?: { from?: Date; to?: Date }
    },
    context?: TransactionContext
  ): Promise<StorageStats>
  
  findLargeFiles(minSize: number, context?: TransactionContext): Promise<FileUpload[]>
  findUnusedFiles(daysUnused: number, context?: TransactionContext): Promise<FileUpload[]>
  
  // Cleanup and maintenance
  cleanupExpiredFiles(context?: TransactionContext): Promise<number>
  cleanupOrphanedFiles(context?: TransactionContext): Promise<number>
  cleanupOldVersions(keepVersions: number, context?: TransactionContext): Promise<number>
  moveToArchive(fileIds: string[], context?: TransactionContext): Promise<BulkOperationResult>
  
  // Analytics
  getFileStats(
    options?: {
      userId?: string
      dateRange?: { from?: Date; to?: Date }
    },
    context?: TransactionContext
  ): Promise<FileStats>
  
  getUsageAnalytics(
    options?: {
      userId?: string
      fileId?: string
      dateRange?: { from?: Date; to?: Date }
      granularity?: 'hour' | 'day' | 'week' | 'month'
    },
    context?: TransactionContext
  ): Promise<any[]>
  
  // Bulk operations
  bulkUpdateStatus(fileIds: string[], status: FileStatus, context?: TransactionContext): Promise<BulkOperationResult>
  bulkUpdateStorageClass(fileIds: string[], storageClass: string, context?: TransactionContext): Promise<BulkOperationResult>
  bulkDelete(fileIds: string[], context?: TransactionContext): Promise<BulkOperationResult>
  bulkMove(fileIds: string[], targetProvider: string, context?: TransactionContext): Promise<BulkOperationResult>
  
  // Security and compliance
  findUnencryptedFiles(context?: TransactionContext): Promise<FileUpload[]>
  findPublicFiles(context?: TransactionContext): Promise<FileUpload[]>
  auditFileAccess(
    fileId: string,
    options?: {
      from?: Date
      to?: Date
      limit?: number
    },
    context?: TransactionContext
  ): Promise<any[]>
  
  // Validation and integrity
  validateFileIntegrity(id: string, context?: TransactionContext): Promise<{ isValid: boolean; error?: string }>
  recalculateChecksum(id: string, context?: TransactionContext): Promise<FileUpload>
  findCorruptedFiles(context?: TransactionContext): Promise<FileUpload[]>
  
  // Backup and restore
  createBackup(fileIds: string[], context?: TransactionContext): Promise<BulkOperationResult>
  restoreFromBackup(backupId: string, context?: TransactionContext): Promise<BulkOperationResult>
  
  // Metadata operations
  updateMetadata(id: string, metadata: any, context?: TransactionContext): Promise<FileUpload>
  searchByMetadata(query: Record<string, any>, context?: TransactionContext): Promise<FileUpload[]>
  
  // Tag operations
  addTag(artifactId: string, tag: string, context?: TransactionContext): Promise<Artifact>
  removeTag(artifactId: string, tag: string, context?: TransactionContext): Promise<Artifact>
  findByTag(tag: string, context?: TransactionContext): Promise<Artifact[]>
  
  // Export and import
  exportFileData(
    options?: {
      userId?: string
      fileIds?: string[]
      format?: 'json' | 'csv'
      includeMetadata?: boolean
    },
    context?: TransactionContext
  ): Promise<any>
  
  // Monitoring
  getHealthStatus(context?: TransactionContext): Promise<{
    totalFiles: number
    healthyFiles: number
    corruptedFiles: number
    pendingFiles: number
    storageHealth: Record<string, any>
  }>
}