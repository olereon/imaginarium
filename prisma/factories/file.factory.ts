/**
 * File factory for generating test files and artifacts
 */

import { FileUpload, Artifact, FileStatus, ArtifactType, ArtifactStatus } from '@prisma/client'
import { BaseFactory, generateId } from './index'
import type { FileCreateInput, ArtifactCreateInput, FactoryConfig } from './types'

export class FileFactory extends BaseFactory<FileUpload> {
  constructor(config: FactoryConfig) {
    super(config)
  }

  build(overrides: Partial<FileCreateInput> = {}): FileUpload {
    const sequence = this.getSequence('file')
    const fileType = this.getRandomFileType()
    const storageProvider = overrides.storageProvider || this.randomElement(['local', 's3', 'gcs', 'azure'])
    
    const defaultData: FileCreateInput = {
      userId: overrides.userId || 'user_placeholder',
      filename: overrides.filename || `${fileType.name}_${sequence}.${fileType.extension}`,
      originalName: overrides.originalName || `original_${fileType.name}_${sequence}.${fileType.extension}`,
      mimeType: overrides.mimeType || fileType.mimeType,
      size: overrides.size || this.randomInt(1024, 50 * 1024 * 1024), // 1KB to 50MB
      storageProvider,
      storageKey: overrides.storageKey || this.generateStorageKey(storageProvider, sequence),
      s3Bucket: overrides.s3Bucket || (storageProvider === 's3' ? 'imaginarium-files' : null),
      s3Key: overrides.s3Key || (storageProvider === 's3' ? `files/${sequence}/${fileType.name}.${fileType.extension}` : null),
      s3Region: overrides.s3Region || (storageProvider === 's3' ? 'us-east-1' : null),
      s3Etag: overrides.s3Etag || (storageProvider === 's3' ? `"${this.generateETag()}"` : null),
      storageClass: overrides.storageClass || (storageProvider === 's3' ? 'STANDARD' : null),
      checksum: overrides.checksum || this.generateChecksum(),
      checksumType: overrides.checksumType || 'md5',
      encoding: overrides.encoding || (fileType.category === 'text' ? 'utf-8' : null),
      contentType: overrides.contentType || `${fileType.mimeType}; charset=utf-8`,
      metadata: overrides.metadata || JSON.stringify(this.generateFileMetadata(fileType)),
      dimensions: overrides.dimensions || (fileType.category === 'image' ? JSON.stringify({ width: this.randomInt(100, 4000), height: this.randomInt(100, 4000) }) : null),
      duration: overrides.duration || (fileType.category === 'video' || fileType.category === 'audio' ? this.randomInt(1, 3600) : null),
      quality: overrides.quality || (fileType.category === 'image' || fileType.category === 'video' ? this.randomElement(['low', 'medium', 'high', 'ultra']) : null),
      compression: overrides.compression || (fileType.category === 'image' ? this.randomElement(['none', 'lossless', 'lossy']) : null),
      status: overrides.status || this.randomElement<FileStatus>(['PENDING', 'PROCESSING', 'READY', 'FAILED']),
      processingError: overrides.processingError || (this.randomBoolean(0.1) ? 'Processing failed due to invalid format' : null),
      processingStage: overrides.processingStage || (this.randomBoolean(0.3) ? this.randomElement(['upload', 'scan', 'process', 'optimize']) : null),
      processingProgress: overrides.processingProgress || this.randomInt(0, 100) / 100,
      isPublic: overrides.isPublic !== undefined ? overrides.isPublic : this.randomBoolean(0.2),
      accessLevel: overrides.accessLevel || this.randomElement(['public', 'private', 'restricted']),
      encryptionKey: overrides.encryptionKey || (this.randomBoolean(0.3) ? this.generateEncryptionKey() : null),
      isEncrypted: overrides.isEncrypted !== undefined ? overrides.isEncrypted : this.randomBoolean(0.3),
      expiresAt: overrides.expiresAt || (this.randomBoolean(0.4) ? this.randomDate(-30) : null), // 30 days from now
      lastAccessedAt: overrides.lastAccessedAt || (this.randomBoolean(0.8) ? this.randomDate(7) : null),
      downloadCount: overrides.downloadCount || this.randomInt(0, 1000),
      virusScanned: overrides.virusScanned !== undefined ? overrides.virusScanned : this.randomBoolean(0.9),
      virusScanResult: overrides.virusScanResult || (this.randomBoolean(0.95) ? 'clean' : 'infected'),
      virusScanAt: overrides.virusScanAt || (this.randomBoolean(0.9) ? this.randomDate(1) : null),
      deletedAt: overrides.deletedAt || (this.randomBoolean(0.05) ? this.randomDate(7) : null),
      deletedBy: overrides.deletedBy || (this.randomBoolean(0.05) ? 'user_admin' : null),
    }

    const file = {
      id: generateId('file'),
      ...defaultData,
      ...overrides,
      uploadedAt: new Date(),
    } as FileUpload

    return file
  }

  buildMany(count: number, overrides: Partial<FileCreateInput> = {}): FileUpload[] {
    return Array.from({ length: count }, () => this.build(overrides))
  }

  async create(overrides: Partial<FileCreateInput> = {}): Promise<FileUpload> {
    const fileData = this.build(overrides)
    
    return await this.config.prisma.fileUpload.create({
      data: fileData
    })
  }

  async createMany(count: number, overrides: Partial<FileCreateInput> = {}): Promise<FileUpload[]> {
    const files: FileUpload[] = []
    
    for (let i = 0; i < count; i++) {
      const file = await this.create(overrides)
      files.push(file)
    }
    
    return files
  }

  // Specialized factory methods
  async createImageFile(overrides: Partial<FileCreateInput> = {}): Promise<FileUpload> {
    const imageTypes = ['jpg', 'png', 'gif', 'webp', 'svg']
    const imageType = this.randomElement(imageTypes)
    
    return await this.create({
      filename: `image_${Date.now()}.${imageType}`,
      mimeType: `image/${imageType}`,
      dimensions: JSON.stringify({ width: this.randomInt(800, 4000), height: this.randomInt(600, 3000) }),
      size: this.randomInt(100 * 1024, 10 * 1024 * 1024), // 100KB to 10MB
      quality: this.randomElement(['low', 'medium', 'high', 'ultra']),
      compression: this.randomElement(['none', 'lossless', 'lossy']),
      ...overrides
    })
  }

  async createVideoFile(overrides: Partial<FileCreateInput> = {}): Promise<FileUpload> {
    const videoTypes = ['mp4', 'avi', 'mov', 'mkv', 'webm']
    const videoType = this.randomElement(videoTypes)
    
    return await this.create({
      filename: `video_${Date.now()}.${videoType}`,
      mimeType: `video/${videoType}`,
      dimensions: JSON.stringify({ width: this.randomInt(1280, 3840), height: this.randomInt(720, 2160) }),
      duration: this.randomInt(30, 3600), // 30 seconds to 1 hour
      size: this.randomInt(10 * 1024 * 1024, 1000 * 1024 * 1024), // 10MB to 1GB
      quality: this.randomElement(['720p', '1080p', '4K']),
      ...overrides
    })
  }

  async createAudioFile(overrides: Partial<FileCreateInput> = {}): Promise<FileUpload> {
    const audioTypes = ['mp3', 'wav', 'flac', 'aac', 'ogg']
    const audioType = this.randomElement(audioTypes)
    
    return await this.create({
      filename: `audio_${Date.now()}.${audioType}`,
      mimeType: `audio/${audioType}`,
      duration: this.randomInt(10, 3600), // 10 seconds to 1 hour
      size: this.randomInt(1024 * 1024, 100 * 1024 * 1024), // 1MB to 100MB
      quality: this.randomElement(['low', 'medium', 'high', 'lossless']),
      ...overrides
    })
  }

  async createDocumentFile(overrides: Partial<FileCreateInput> = {}): Promise<FileUpload> {
    const docTypes = ['pdf', 'docx', 'txt', 'csv', 'json', 'xml']
    const docType = this.randomElement(docTypes)
    
    return await this.create({
      filename: `document_${Date.now()}.${docType}`,
      mimeType: this.getDocumentMimeType(docType),
      size: this.randomInt(1024, 10 * 1024 * 1024), // 1KB to 10MB
      encoding: 'utf-8',
      ...overrides
    })
  }

  // Artifact factory methods
  async createArtifact(runId: string, overrides: Partial<ArtifactCreateInput> = {}): Promise<Artifact> {
    const sequence = this.getSequence('artifact')
    const artifactType = overrides.type || this.randomElement<ArtifactType>(['IMAGE', 'VIDEO', 'AUDIO', 'TEXT', 'JSON', 'CSV', 'XML', 'PDF', 'ARCHIVE', 'BINARY', 'OTHER'])
    
    const artifactData: ArtifactCreateInput = {
      runId,
      taskId: overrides.taskId || (this.randomBoolean(0.7) ? `task_${this.randomInt(1, 10)}` : null),
      fileId: overrides.fileId || (this.randomBoolean(0.5) ? `file_${this.randomInt(1, 100)}` : null),
      type: artifactType,
      name: overrides.name || `artifact_${sequence}`,
      description: overrides.description || `Generated artifact from pipeline execution`,
      version: overrides.version || 1,
      parentId: overrides.parentId || (this.randomBoolean(0.2) ? `artifact_${this.randomInt(1, 100)}` : null),
      isLatest: overrides.isLatest !== undefined ? overrides.isLatest : true,
      versionNotes: overrides.versionNotes || (this.randomBoolean(0.3) ? 'Updated with improvements' : null),
      storageKey: overrides.storageKey || `artifacts/${runId}/${sequence}`,
      size: overrides.size || this.randomInt(1024, 100 * 1024 * 1024),
      mimeType: overrides.mimeType || this.getArtifactMimeType(artifactType),
      checksum: overrides.checksum || this.generateChecksum(),
      checksumType: overrides.checksumType || 'md5',
      s3Bucket: overrides.s3Bucket || 'imaginarium-artifacts',
      s3Key: overrides.s3Key || `artifacts/${runId}/${sequence}`,
      s3Region: overrides.s3Region || 'us-east-1',
      s3Etag: overrides.s3Etag || `"${this.generateETag()}"`,
      s3VersionId: overrides.s3VersionId || generateId('version'),
      metadata: overrides.metadata || JSON.stringify(this.generateArtifactMetadata(artifactType)),
      dimensions: overrides.dimensions || (artifactType === 'IMAGE' || artifactType === 'VIDEO' ? JSON.stringify({ width: this.randomInt(100, 2000), height: this.randomInt(100, 2000) }) : null),
      duration: overrides.duration || (artifactType === 'VIDEO' || artifactType === 'AUDIO' ? this.randomInt(1, 3600) : null),
      quality: overrides.quality || (artifactType === 'IMAGE' || artifactType === 'VIDEO' ? this.randomElement(['low', 'medium', 'high']) : null),
      format: overrides.format || this.getArtifactFormat(artifactType),
      category: overrides.category || this.randomElement(['input', 'output', 'intermediate', 'debug']),
      tags: overrides.tags || JSON.stringify(this.generateArtifactTags(artifactType)),
      importance: overrides.importance || this.randomElement(['critical', 'important', 'normal', 'debug']),
      status: overrides.status || this.randomElement<ArtifactStatus>(['ACTIVE', 'ARCHIVED', 'EXPIRED', 'DELETED', 'CORRUPTED']),
      expiresAt: overrides.expiresAt || (this.randomBoolean(0.3) ? this.randomDate(-90) : null),
      retentionDays: overrides.retentionDays || this.randomInt(30, 365),
      isPublic: overrides.isPublic !== undefined ? overrides.isPublic : this.randomBoolean(0.1),
      accessLevel: overrides.accessLevel || this.randomElement(['public', 'private', 'restricted']),
      downloadCount: overrides.downloadCount || this.randomInt(0, 100),
      lastAccessedAt: overrides.lastAccessedAt || (this.randomBoolean(0.6) ? this.randomDate(30) : null),
      nodeId: overrides.nodeId || `node_${this.randomInt(1, 10)}`,
      nodeName: overrides.nodeName || `Node ${this.randomInt(1, 10)}`,
      nodeType: overrides.nodeType || this.randomElement(['input', 'process', 'output', 'ai']),
      pipelineVersion: overrides.pipelineVersion || `v${this.randomInt(1, 3)}.${this.randomInt(0, 9)}`,
      processingTime: overrides.processingTime || this.randomInt(100, 30000),
      processingCost: overrides.processingCost || this.randomInt(1, 100) / 100,
      deletedAt: overrides.deletedAt || (this.randomBoolean(0.02) ? this.randomDate(7) : null),
      deletedBy: overrides.deletedBy || (this.randomBoolean(0.02) ? 'user_admin' : null),
      ...overrides
    }

    return await this.config.prisma.artifact.create({
      data: {
        ...artifactData,
        id: generateId('artifact'),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })
  }

  async createArtifacts(runId: string, count: number): Promise<Artifact[]> {
    const artifacts: Artifact[] = []
    
    for (let i = 0; i < count; i++) {
      const artifact = await this.createArtifact(runId)
      artifacts.push(artifact)
    }
    
    return artifacts
  }

  // Helper methods
  private getRandomFileType() {
    const fileTypes = [
      { name: 'document', extension: 'pdf', mimeType: 'application/pdf', category: 'document' },
      { name: 'image', extension: 'jpg', mimeType: 'image/jpeg', category: 'image' },
      { name: 'image', extension: 'png', mimeType: 'image/png', category: 'image' },
      { name: 'video', extension: 'mp4', mimeType: 'video/mp4', category: 'video' },
      { name: 'audio', extension: 'mp3', mimeType: 'audio/mpeg', category: 'audio' },
      { name: 'text', extension: 'txt', mimeType: 'text/plain', category: 'text' },
      { name: 'data', extension: 'json', mimeType: 'application/json', category: 'data' },
      { name: 'data', extension: 'csv', mimeType: 'text/csv', category: 'data' },
      { name: 'archive', extension: 'zip', mimeType: 'application/zip', category: 'archive' },
      { name: 'code', extension: 'js', mimeType: 'text/javascript', category: 'code' }
    ]
    
    return this.randomElement(fileTypes)
  }

  private generateStorageKey(provider: string, sequence: number): string {
    switch (provider) {
      case 's3':
        return `files/${sequence}/file_${sequence}`
      case 'gcs':
        return `imaginarium-files/files/${sequence}/file_${sequence}`
      case 'azure':
        return `files/file_${sequence}`
      default:
        return `uploads/file_${sequence}`
    }
  }

  private generateETag(): string {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  }

  private generateChecksum(): string {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  }

  private generateEncryptionKey(): string {
    return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  }

  private generateFileMetadata(fileType: any): Record<string, any> {
    const baseMetadata = {
      uploadedBy: 'system',
      originalSize: this.randomInt(1024, 10 * 1024 * 1024),
      uploadMethod: this.randomElement(['direct', 'multipart', 'resumable']),
      clientInfo: {
        userAgent: 'Mozilla/5.0 (compatible; Imaginarium/1.0)',
        ip: `192.168.1.${this.randomInt(1, 255)}`,
        country: this.randomElement(['US', 'UK', 'CA', 'DE', 'FR'])
      }
    }

    switch (fileType.category) {
      case 'image':
        return {
          ...baseMetadata,
          camera: this.randomElement(['iPhone 12', 'Canon EOS', 'Sony A7', 'Nikon D850']),
          iso: this.randomInt(100, 6400),
          aperture: `f/${this.randomInt(14, 80) / 10}`,
          shutterSpeed: `1/${this.randomInt(60, 4000)}`,
          colorSpace: this.randomElement(['sRGB', 'Adobe RGB', 'ProPhoto RGB'])
        }
      case 'video':
        return {
          ...baseMetadata,
          codec: this.randomElement(['H.264', 'H.265', 'VP9', 'AV1']),
          bitrate: this.randomInt(1000, 50000),
          framerate: this.randomInt(24, 120),
          resolution: this.randomElement(['1920x1080', '3840x2160', '1280x720'])
        }
      case 'audio':
        return {
          ...baseMetadata,
          bitrate: this.randomInt(128, 320),
          sampleRate: this.randomInt(44100, 192000),
          channels: this.randomInt(1, 8),
          format: this.randomElement(['MP3', 'FLAC', 'WAV', 'AAC'])
        }
      default:
        return baseMetadata
    }
  }

  private getDocumentMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain',
      csv: 'text/csv',
      json: 'application/json',
      xml: 'application/xml'
    }
    
    return mimeTypes[extension] || 'application/octet-stream'
  }

  private getArtifactMimeType(type: ArtifactType): string {
    const mimeTypes: Record<ArtifactType, string> = {
      IMAGE: 'image/png',
      VIDEO: 'video/mp4',
      AUDIO: 'audio/mpeg',
      TEXT: 'text/plain',
      JSON: 'application/json',
      CSV: 'text/csv',
      XML: 'application/xml',
      PDF: 'application/pdf',
      ARCHIVE: 'application/zip',
      BINARY: 'application/octet-stream',
      OTHER: 'application/octet-stream'
    }
    
    return mimeTypes[type]
  }

  private getArtifactFormat(type: ArtifactType): string {
    const formats: Record<ArtifactType, string> = {
      IMAGE: this.randomElement(['png', 'jpg', 'webp', 'svg']),
      VIDEO: this.randomElement(['mp4', 'avi', 'mov', 'webm']),
      AUDIO: this.randomElement(['mp3', 'wav', 'flac', 'aac']),
      TEXT: 'txt',
      JSON: 'json',
      CSV: 'csv',
      XML: 'xml',
      PDF: 'pdf',
      ARCHIVE: this.randomElement(['zip', 'tar', 'gz']),
      BINARY: 'bin',
      OTHER: 'unknown'
    }
    
    return formats[type]
  }

  private generateArtifactMetadata(type: ArtifactType): Record<string, any> {
    const baseMetadata = {
      generator: 'Imaginarium Pipeline',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      processingTime: this.randomInt(100, 30000),
      quality: this.randomElement(['draft', 'standard', 'high', 'premium'])
    }

    switch (type) {
      case 'IMAGE':
        return {
          ...baseMetadata,
          algorithm: this.randomElement(['DALL-E', 'Stable Diffusion', 'Midjourney']),
          prompt: 'A beautiful landscape with mountains and lakes',
          seed: this.randomInt(1, 1000000),
          steps: this.randomInt(20, 100),
          guidance: this.randomInt(5, 20) / 10
        }
      case 'TEXT':
        return {
          ...baseMetadata,
          model: this.randomElement(['GPT-4', 'GPT-3.5', 'Claude', 'Gemini']),
          tokens: this.randomInt(100, 4000),
          temperature: this.randomInt(0, 20) / 10,
          maxTokens: this.randomInt(500, 4000)
        }
      case 'JSON':
        return {
          ...baseMetadata,
          schema: 'https://schema.org/Dataset',
          records: this.randomInt(1, 10000),
          fields: this.randomInt(5, 50)
        }
      default:
        return baseMetadata
    }
  }

  private generateArtifactTags(type: ArtifactType): string[] {
    const baseTags = ['generated', 'artifact', 'pipeline']
    
    const typeTags: Record<ArtifactType, string[]> = {
      IMAGE: ['image', 'visual', 'ai-generated'],
      VIDEO: ['video', 'media', 'animation'],
      AUDIO: ['audio', 'sound', 'music'],
      TEXT: ['text', 'content', 'document'],
      JSON: ['data', 'structured', 'json'],
      CSV: ['data', 'tabular', 'csv'],
      XML: ['data', 'structured', 'xml'],
      PDF: ['document', 'pdf', 'report'],
      ARCHIVE: ['archive', 'compressed', 'bundle'],
      BINARY: ['binary', 'executable', 'compiled'],
      OTHER: ['misc', 'unknown', 'other']
    }
    
    return [...baseTags, ...typeTags[type]]
  }

  // Performance testing
  async createPerformanceFiles(userId: string, count: number): Promise<FileUpload[]> {
    const batchSize = 100
    const files: FileUpload[] = []
    
    for (let i = 0; i < count; i += batchSize) {
      const currentBatchSize = Math.min(batchSize, count - i)
      const batch = this.buildMany(currentBatchSize, { userId })
      
      const createdFiles = await this.config.prisma.fileUpload.createMany({
        data: batch.map(file => ({
          ...file,
          id: undefined // Let Prisma generate IDs
        }))
      })
      
      // Fetch the created files
      const fetchedFiles = await this.config.prisma.fileUpload.findMany({
        where: { userId },
        orderBy: { uploadedAt: 'desc' },
        take: currentBatchSize
      })
      
      files.push(...fetchedFiles)
    }
    
    return files
  }

  // Utility methods
  generateFileStats(files: FileUpload[]): Record<string, any> {
    const stats = {
      total: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      averageSize: files.reduce((sum, f) => sum + f.size, 0) / files.length,
      byStatus: {
        PENDING: files.filter(f => f.status === 'PENDING').length,
        PROCESSING: files.filter(f => f.status === 'PROCESSING').length,
        READY: files.filter(f => f.status === 'READY').length,
        FAILED: files.filter(f => f.status === 'FAILED').length
      },
      byType: files.reduce((acc, f) => {
        const type = f.mimeType.split('/')[0]
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      public: files.filter(f => f.isPublic).length,
      encrypted: files.filter(f => f.isEncrypted).length,
      totalDownloads: files.reduce((sum, f) => sum + f.downloadCount, 0)
    }
    
    return stats
  }
}