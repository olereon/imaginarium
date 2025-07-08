import type { Pipeline } from '@imaginarium/shared';

export class PipelineEngine {
  private pipelines = new Map<string, Pipeline>();

  async createPipeline(
    pipeline: Omit<Pipeline, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Pipeline> {
    const now = new Date();
    const newPipeline: Pipeline = {
      ...pipeline,
      id: `pipe_${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };

    this.pipelines.set(newPipeline.id, newPipeline);
    return newPipeline;
  }

  async getPipeline(id: string): Promise<Pipeline | null> {
    return this.pipelines.get(id) ?? null;
  }

  async updatePipeline(id: string, updates: Partial<Pipeline>): Promise<Pipeline | null> {
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

  validatePipeline(pipeline: Pipeline): { valid: boolean; errors: string[] } {
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

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private hasCycles(pipeline: Pipeline): boolean {
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
