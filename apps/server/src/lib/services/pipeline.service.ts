/**
 * Pipeline service for business logic and pipeline management
 */

import { PipelineRepository } from '../repositories/pipeline.repository.js';
import { PipelineVersionRepository } from '../repositories/pipeline-version.repository.js';
import type {
  Pipeline,
  PipelineVersion,
  CreatePipelineInput,
  UpdatePipelineInput,
  PipelineConfiguration,
  PipelineMetadata,
} from '@imaginarium/shared';

export interface ConfigurationDiff {
  added: Array<{ type: 'node' | 'connection'; id: string; data: any }>;
  removed: Array<{ type: 'node' | 'connection'; id: string; data: any }>;
  modified: Array<{ type: 'node' | 'connection'; id: string; before: any; after: any }>;
}

export class PipelineService {
  constructor(
    private pipelineRepository: PipelineRepository,
    private versionRepository: PipelineVersionRepository
  ) {}

  /**
   * Create a new pipeline with initial configuration
   */
  async createPipeline(input: CreatePipelineInput, createInitialVersion = true): Promise<Pipeline> {
    // Validate configuration if provided
    if (input.configuration) {
      const validation = this.pipelineRepository.validateConfiguration(input.configuration);
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }
    }

    const pipeline = await this.pipelineRepository.create({
      ...input,
      configuration: JSON.stringify(input.configuration || {}),
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    });

    // Create initial version if requested
    if (createInitialVersion && input.configuration) {
      await this.versionRepository.createVersion(
        pipeline.id,
        input.configuration,
        'Initial version',
        input.userId
      );
    }

    return pipeline;
  }

  /**
   * Update pipeline configuration with automatic versioning
   */
  async updateConfiguration(
    pipelineId: string,
    configuration: PipelineConfiguration,
    userId: string,
    changelog?: string
  ): Promise<{ pipeline: Pipeline; version: PipelineVersion }> {
    // Validate new configuration
    const validation = this.pipelineRepository.validateConfiguration(configuration);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Create version snapshot before updating
    const version = await this.versionRepository.createVersion(
      pipelineId,
      configuration,
      changelog || 'Configuration updated',
      userId
    );

    // Update pipeline
    const pipeline = await this.pipelineRepository.updateConfiguration(
      pipelineId,
      configuration,
      userId,
      false // Don't create version again
    );

    return { pipeline, version };
  }

  /**
   * Clone pipeline with optional modifications
   */
  async clonePipeline(
    sourceId: string,
    userId: string,
    options: {
      name?: string;
      description?: string;
      makePublic?: boolean;
      modifyConfiguration?: (config: PipelineConfiguration) => PipelineConfiguration;
    } = {}
  ): Promise<Pipeline> {
    const source = await this.pipelineRepository.findById(sourceId);
    if (!source) {
      throw new Error('Source pipeline not found');
    }

    const sourceConfig = JSON.parse(source.configuration) as PipelineConfiguration;
    const sourceMetadata = source.metadata ? (JSON.parse(source.metadata) as PipelineMetadata) : {};

    // Apply modifications if provided
    const finalConfig = options.modifyConfiguration
      ? options.modifyConfiguration(sourceConfig)
      : sourceConfig;

    // Create cloned pipeline
    return await this.createPipeline({
      userId,
      name: options.name || `${source.name} (Copy)`,
      description: options.description || source.description,
      configuration: finalConfig,
      metadata: {
        ...sourceMetadata,
        clonedFrom: sourceId,
        clonedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Compare two pipeline configurations
   */
  compareConfigurations(
    config1: PipelineConfiguration,
    config2: PipelineConfiguration
  ): ConfigurationDiff {
    const diff: ConfigurationDiff = {
      added: [],
      removed: [],
      modified: [],
    };

    // Compare nodes
    const nodes1Map = new Map(config1.nodes.map(node => [node.id, node]));
    const nodes2Map = new Map(config2.nodes.map(node => [node.id, node]));

    // Find added nodes (in config2 but not config1)
    for (const [id, node] of nodes2Map) {
      if (!nodes1Map.has(id)) {
        diff.added.push({ type: 'node', id, data: node });
      }
    }

    // Find removed nodes (in config1 but not config2)
    for (const [id, node] of nodes1Map) {
      if (!nodes2Map.has(id)) {
        diff.removed.push({ type: 'node', id, data: node });
      }
    }

    // Find modified nodes
    for (const [id, node1] of nodes1Map) {
      const node2 = nodes2Map.get(id);
      if (node2 && JSON.stringify(node1) !== JSON.stringify(node2)) {
        diff.modified.push({ type: 'node', id, before: node1, after: node2 });
      }
    }

    // Compare connections
    const connections1Map = new Map(config1.connections.map(conn => [conn.id, conn]));
    const connections2Map = new Map(config2.connections.map(conn => [conn.id, conn]));

    // Find added connections
    for (const [id, conn] of connections2Map) {
      if (!connections1Map.has(id)) {
        diff.added.push({ type: 'connection', id, data: conn });
      }
    }

    // Find removed connections
    for (const [id, conn] of connections1Map) {
      if (!connections2Map.has(id)) {
        diff.removed.push({ type: 'connection', id, data: conn });
      }
    }

    // Find modified connections
    for (const [id, conn1] of connections1Map) {
      const conn2 = connections2Map.get(id);
      if (conn2 && JSON.stringify(conn1) !== JSON.stringify(conn2)) {
        diff.modified.push({ type: 'connection', id, before: conn1, after: conn2 });
      }
    }

    return diff;
  }

  /**
   * Get pipeline configuration analysis
   */
  async analyzeConfiguration(pipelineId: string): Promise<{
    nodeCount: number;
    connectionCount: number;
    nodeTypes: Record<string, number>;
    complexity: 'simple' | 'moderate' | 'complex';
    hasLoops: boolean;
    orphanNodes: string[];
  }> {
    const config = (await this.pipelineRepository.getConfiguration(
      pipelineId
    )) as PipelineConfiguration;
    if (!config) {
      throw new Error('Pipeline configuration not found');
    }

    const nodeCount = config.nodes.length;
    const connectionCount = config.connections.length;

    // Count node types
    const nodeTypes = config.nodes.reduce(
      (acc, node) => {
        acc[node.type] = (acc[node.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Determine complexity
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    if (nodeCount > 10 || connectionCount > 15) {
      complexity = 'complex';
    } else if (nodeCount > 5 || connectionCount > 8) {
      complexity = 'moderate';
    }

    // Check for loops (basic cycle detection)
    const hasLoops = this.detectCycles(config);

    // Find orphan nodes (nodes with no connections)
    const connectedNodes = new Set([
      ...config.connections.map(c => c.source),
      ...config.connections.map(c => c.target),
    ]);
    const orphanNodes = config.nodes
      .filter(node => !connectedNodes.has(node.id))
      .map(node => node.id);

    return {
      nodeCount,
      connectionCount,
      nodeTypes,
      complexity,
      hasLoops,
      orphanNodes,
    };
  }

  /**
   * Basic cycle detection in pipeline graph
   */
  private detectCycles(config: PipelineConfiguration): boolean {
    const adjacencyList = new Map<string, string[]>();

    // Build adjacency list
    config.nodes.forEach(node => {
      adjacencyList.set(node.id, []);
    });

    config.connections.forEach(conn => {
      const sourceNodes = adjacencyList.get(conn.source) || [];
      sourceNodes.push(conn.target);
      adjacencyList.set(conn.source, sourceNodes);
    });

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true; // Cycle found
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    // Check each node for cycles
    for (const node of config.nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) return true;
      }
    }

    return false;
  }

  /**
   * Export pipeline configuration for sharing
   */
  async exportPipeline(pipelineId: string): Promise<{
    pipeline: Omit<Pipeline, 'userId' | 'createdAt' | 'updatedAt'>;
    configuration: PipelineConfiguration;
    metadata: PipelineMetadata;
    exportedAt: string;
  }> {
    const pipeline = await this.pipelineRepository.findById(pipelineId);
    if (!pipeline) {
      throw new Error('Pipeline not found');
    }

    const configuration = JSON.parse(pipeline.configuration) as PipelineConfiguration;
    const metadata = pipeline.metadata ? (JSON.parse(pipeline.metadata) as PipelineMetadata) : {};

    const { userId, createdAt, updatedAt, ...exportablePipeline } = pipeline;

    return {
      pipeline: exportablePipeline,
      configuration,
      metadata,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Import pipeline configuration
   */
  async importPipeline(exportData: any, userId: string, name?: string): Promise<Pipeline> {
    if (!exportData.configuration) {
      throw new Error('Invalid export data: missing configuration');
    }

    return await this.createPipeline({
      userId,
      name: name || exportData.pipeline.name || 'Imported Pipeline',
      description: exportData.pipeline.description,
      configuration: exportData.configuration,
      metadata: {
        ...exportData.metadata,
        importedAt: new Date().toISOString(),
        originalId: exportData.pipeline.id,
      },
    });
  }

  /**
   * Optimize pipeline configuration
   */
  async optimizeConfiguration(pipelineId: string): Promise<{
    optimizedConfig: PipelineConfiguration;
    optimizations: string[];
  }> {
    const config = (await this.pipelineRepository.getConfiguration(
      pipelineId
    )) as PipelineConfiguration;
    if (!config) {
      throw new Error('Pipeline configuration not found');
    }

    const optimizations: string[] = [];
    const optimizedConfig = { ...config };

    // Remove orphan nodes
    const connectedNodes = new Set([
      ...config.connections.map(c => c.source),
      ...config.connections.map(c => c.target),
    ]);

    const originalNodeCount = optimizedConfig.nodes.length;
    optimizedConfig.nodes = optimizedConfig.nodes.filter(node => connectedNodes.has(node.id));

    if (optimizedConfig.nodes.length < originalNodeCount) {
      optimizations.push(
        `Removed ${originalNodeCount - optimizedConfig.nodes.length} orphan nodes`
      );
    }

    // Remove duplicate connections
    const connectionMap = new Map<string, any>();
    optimizedConfig.connections.forEach(conn => {
      const key = `${conn.source}-${conn.target}-${conn.sourceHandle || ''}-${conn.targetHandle || ''}`;
      connectionMap.set(key, conn);
    });

    const originalConnectionCount = optimizedConfig.connections.length;
    optimizedConfig.connections = Array.from(connectionMap.values());

    if (optimizedConfig.connections.length < originalConnectionCount) {
      optimizations.push(
        `Removed ${originalConnectionCount - optimizedConfig.connections.length} duplicate connections`
      );
    }

    return { optimizedConfig, optimizations };
  }
}
