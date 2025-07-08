/**
 * Pipeline repository for database operations
 */

import { SoftDeleteRepository } from './soft-delete.repository.js'
import { prisma } from '../prisma.js'
import type { 
  Pipeline, 
  PipelineStatus,
  CreatePipelineInput, 
  UpdatePipelineInput 
} from '@imaginarium/shared'

export interface IPipelineRepository {
  findByUserId(userId: string, status?: PipelineStatus): Promise<Pipeline[]>
  findPublic(): Promise<Pipeline[]>
  findWithVersions(id: string): Promise<Pipeline & { versions: any[] } | null>
  findWithRuns(id: string): Promise<Pipeline & { runs: any[] } | null>
  duplicate(id: string, userId: string, name?: string): Promise<Pipeline>
  publish(id: string): Promise<Pipeline>
  archive(id: string): Promise<Pipeline>
  search(query: string, userId?: string): Promise<Pipeline[]>
  getPopular(limit?: number): Promise<Pipeline[]>
  incrementVersion(id: string): Promise<Pipeline>
}

export class PipelineRepository 
  extends SoftDeleteRepository<Pipeline, CreatePipelineInput, UpdatePipelineInput> 
  implements IPipelineRepository {
  
  protected model = prisma.pipeline
  
  async findByUserId(userId: string, status?: PipelineStatus): Promise<Pipeline[]> {
    return await this.findManyActive({
      where: {
        userId,
        ...(status && { status }),
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })
  }
  
  async findPublic(): Promise<Pipeline[]> {
    return await this.findManyActive({
      where: {
        isPublic: true,
        status: 'PUBLISHED',
      },
      orderBy: {
        publishedAt: 'desc',
      },
    })
  }
  
  async findWithVersions(id: string): Promise<Pipeline & { versions: any[] } | null> {
    return await this.model.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: {
            version: 'desc',
          },
        },
      },
    })
  }
  
  async findWithRuns(id: string): Promise<Pipeline & { runs: any[] } | null> {
    return await this.model.findUnique({
      where: { id },
      include: {
        runs: {
          orderBy: {
            queuedAt: 'desc',
          },
          take: 10, // Last 10 runs
        },
      },
    })
  }
  
  async duplicate(id: string, userId: string, name?: string): Promise<Pipeline> {
    const original = await this.model.findUnique({ where: { id } })
    if (!original) {
      throw new Error('Pipeline not found')
    }
    
    return await this.model.create({
      data: {
        userId,
        name: name || `${original.name} (Copy)`,
        description: original.description,
        configuration: original.configuration,
        metadata: original.metadata,
        parentId: id,
        status: 'DRAFT',
      },
    })
  }
  
  async publish(id: string): Promise<Pipeline> {
    return await this.model.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })
  }
  
  async archive(id: string): Promise<Pipeline> {
    return await this.model.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
      },
    })
  }
  
  async search(query: string, userId?: string): Promise<Pipeline[]> {
    const searchFilter = {
      OR: [
        {
          name: {
            contains: query,
            mode: 'insensitive' as const,
          },
        },
        {
          description: {
            contains: query,
            mode: 'insensitive' as const,
          },
        },
      ],
    }
    
    return await this.model.findMany({
      where: {
        ...searchFilter,
        OR: [
          { isPublic: true, status: 'PUBLISHED' },
          ...(userId ? [{ userId }] : []),
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })
  }
  
  async getPopular(limit = 10): Promise<Pipeline[]> {
    // Get pipelines with most runs in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    return await prisma.$queryRaw`
      SELECT p.*, COUNT(pr.id) as run_count
      FROM pipelines p
      LEFT JOIN pipeline_runs pr ON p.id = pr.pipeline_id 
        AND pr.queued_at > ${thirtyDaysAgo}
      WHERE p.is_public = true AND p.status = 'PUBLISHED'
      GROUP BY p.id
      ORDER BY run_count DESC, p.published_at DESC
      LIMIT ${limit}
    `
  }
  
  async incrementVersion(id: string): Promise<Pipeline> {
    return await this.model.update({
      where: { id },
      data: {
        version: {
          increment: 1,
        },
      },
    })
  }
  
  async createVersion(pipelineId: string, createdBy: string, changelog?: string) {
    const pipeline = await this.model.findUnique({ where: { id: pipelineId } })
    if (!pipeline) {
      throw new Error('Pipeline not found')
    }
    
    return await prisma.pipelineVersion.create({
      data: {
        pipelineId,
        version: pipeline.version,
        configuration: pipeline.configuration,
        changelog,
        createdBy,
      },
    })
  }
  
  async getPipelineStats(id: string) {
    const [totalRuns, successfulRuns, avgDuration] = await Promise.all([
      prisma.pipelineRun.count({ where: { pipelineId: id } }),
      prisma.pipelineRun.count({ 
        where: { pipelineId: id, status: 'COMPLETED' } 
      }),
      prisma.pipelineRun.aggregate({
        where: { 
          pipelineId: id, 
          status: 'COMPLETED',
          duration: { not: null }
        },
        _avg: { duration: true },
      }),
    ])
    
    return {
      totalRuns,
      successfulRuns,
      successRate: totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0,
      avgDuration: avgDuration._avg.duration || 0,
    }
  }

  /**
   * Update pipeline configuration with validation
   */
  async updateConfiguration(
    id: string, 
    configuration: object, 
    userId: string, 
    createVersion = true,
    changelog?: string
  ): Promise<Pipeline> {
    const pipeline = await this.model.findUnique({ where: { id } })
    if (!pipeline) {
      throw new Error('Pipeline not found')
    }

    // Create version snapshot before updating if requested
    if (createVersion) {
      await this.createVersion(id, userId, changelog)
    }

    // Update pipeline with new configuration
    return await this.model.update({
      where: { id },
      data: {
        configuration: JSON.stringify(configuration),
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    })
  }

  /**
   * Validate pipeline configuration structure
   */
  validateConfiguration(configuration: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check required fields
    if (!configuration.nodes || !Array.isArray(configuration.nodes)) {
      errors.push('Configuration must have nodes array')
    }

    if (!configuration.connections || !Array.isArray(configuration.connections)) {
      errors.push('Configuration must have connections array')
    }

    // Validate nodes
    if (configuration.nodes) {
      configuration.nodes.forEach((node: any, index: number) => {
        if (!node.id) errors.push(`Node ${index} missing id`)
        if (!node.type) errors.push(`Node ${index} missing type`)
        if (!node.position) errors.push(`Node ${index} missing position`)
      })
    }

    // Validate connections
    if (configuration.connections) {
      configuration.connections.forEach((connection: any, index: number) => {
        if (!connection.source) errors.push(`Connection ${index} missing source`)
        if (!connection.target) errors.push(`Connection ${index} missing target`)
      })
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Get pipeline configuration as parsed object
   */
  async getConfiguration(id: string): Promise<object | null> {
    const pipeline = await this.model.findUnique({
      where: { id },
      select: { configuration: true },
    })

    if (!pipeline) {
      return null
    }

    try {
      return JSON.parse(pipeline.configuration)
    } catch (error) {
      throw new Error('Invalid pipeline configuration JSON')
    }
  }

  /**
   * Get pipeline metadata as parsed object
   */
  async getMetadata(id: string): Promise<object | null> {
    const pipeline = await this.model.findUnique({
      where: { id },
      select: { metadata: true },
    })

    if (!pipeline?.metadata) {
      return null
    }

    try {
      return JSON.parse(pipeline.metadata)
    } catch (error) {
      throw new Error('Invalid pipeline metadata JSON')
    }
  }

  /**
   * Update pipeline metadata
   */
  async updateMetadata(id: string, metadata: object): Promise<Pipeline> {
    return await this.model.update({
      where: { id },
      data: {
        metadata: JSON.stringify(metadata),
        updatedAt: new Date(),
      },
    })
  }

  /**
   * Clone pipeline configuration to new pipeline
   */
  async cloneConfiguration(sourceId: string, targetId: string): Promise<Pipeline> {
    const source = await this.model.findUnique({
      where: { id: sourceId },
      select: { configuration: true, metadata: true },
    })

    if (!source) {
      throw new Error('Source pipeline not found')
    }

    return await this.model.update({
      where: { id: targetId },
      data: {
        configuration: source.configuration,
        metadata: source.metadata,
        updatedAt: new Date(),
      },
    })
  }

  /**
   * Find pipelines by configuration patterns (e.g., specific node types)
   */
  async findByConfigurationPattern(pattern: {
    nodeType?: string
    hasConnections?: boolean
    minNodes?: number
    maxNodes?: number
  }): Promise<Pipeline[]> {
    const pipelines = await this.findManyActive({})
    
    return pipelines.filter(pipeline => {
      try {
        const config = JSON.parse(pipeline.configuration)
        
        if (pattern.nodeType) {
          const hasNodeType = config.nodes?.some((node: any) => node.type === pattern.nodeType)
          if (!hasNodeType) return false
        }
        
        if (pattern.hasConnections !== undefined) {
          const hasConnections = config.connections?.length > 0
          if (pattern.hasConnections !== hasConnections) return false
        }
        
        if (pattern.minNodes !== undefined) {
          if ((config.nodes?.length || 0) < pattern.minNodes) return false
        }
        
        if (pattern.maxNodes !== undefined) {
          if ((config.nodes?.length || 0) > pattern.maxNodes) return false
        }
        
        return true
      } catch {
        return false
      }
    })
  }
}