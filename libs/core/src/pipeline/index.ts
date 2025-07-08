import type { PipelineGraph } from '@imaginarium/shared';

export class PipelineEngine {
  private pipelines = new Map<string, PipelineGraph>();

  async createPipeline(
    pipeline: Omit<PipelineGraph, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<PipelineGraph> {
    const now = new Date();
    const newPipeline: PipelineGraph = {
      ...pipeline,
      id: `pipe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    };

    this.pipelines.set(newPipeline.id, newPipeline);
    return newPipeline;
  }

  async getPipeline(id: string): Promise<PipelineGraph | null> {
    return this.pipelines.get(id) ?? null;
  }

  async updatePipeline(id: string, updates: Partial<PipelineGraph>): Promise<PipelineGraph | null> {
    const pipeline = this.pipelines.get(id);
    if (!pipeline) return null;

    const updated = {
      ...pipeline,
      ...updates,
      id: pipeline.id,
      createdAt: pipeline.createdAt,
      updatedAt: new Date(),
    };

    this.pipelines.set(id, updated);
    return updated;
  }

  async deletePipeline(id: string): Promise<boolean> {
    return this.pipelines.delete(id);
  }

  validatePipeline(pipeline: PipelineGraph): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for cycles
    if (this.hasCycles(pipeline)) {
      errors.push('Pipeline contains cycles');
    }

    // Validate connections
    const nodeMap = new Map(pipeline.nodes.map(n => [n.id, n]));
    for (const connection of pipeline.connections) {
      if (!nodeMap.has(connection.source)) {
        errors.push(`Connection source node '${connection.source}' not found`);
      }
      if (!nodeMap.has(connection.target)) {
        errors.push(`Connection target node '${connection.target}' not found`);
      }
    }

    // Check for orphaned nodes (nodes not connected to anything)
    const connectedNodes = new Set<string>();
    for (const connection of pipeline.connections) {
      connectedNodes.add(connection.source);
      connectedNodes.add(connection.target);
    }

    for (const node of pipeline.nodes) {
      if (!connectedNodes.has(node.id)) {
        errors.push(`Node ${node.id} is not connected to any other nodes`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private hasCycles(pipeline: PipelineGraph): boolean {
    const adjacencyList = new Map<string, string[]>();

    // Build adjacency list
    for (const node of pipeline.nodes) {
      adjacencyList.set(node.id, []);
    }

    for (const connection of pipeline.connections) {
      const neighbors = adjacencyList.get(connection.source) ?? [];
      neighbors.push(connection.target);
      adjacencyList.set(connection.source, neighbors);
    }

    // DFS to detect cycles
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycleDFS = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = adjacencyList.get(nodeId) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycleDFS(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of pipeline.nodes) {
      if (!visited.has(node.id)) {
        if (hasCycleDFS(node.id)) return true;
      }
    }

    return false;
  }
}
