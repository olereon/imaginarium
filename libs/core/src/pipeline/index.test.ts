import { describe, it, expect, beforeEach } from 'vitest';
import { PipelineEngine } from './index';
import type { Pipeline, PipelineNode } from '@imaginarium/shared';

describe('PipelineEngine', () => {
  let engine: PipelineEngine;

  beforeEach(() => {
    engine = new PipelineEngine();
  });

  describe('validatePipeline', () => {
    it('should validate a simple pipeline', () => {
      const pipeline: Pipeline = {
        id: 'test-pipeline',
        name: 'Test Pipeline',
        nodes: [
          {
            id: 'node1',
            type: 'input',
            position: { x: 0, y: 0 },
            data: { label: 'Input Node' },
          },
          {
            id: 'node2',
            type: 'output',
            position: { x: 200, y: 0 },
            data: { label: 'Output Node' },
          },
        ],
        connections: [
          {
            id: 'conn1',
            source: 'node1',
            target: 'node2',
            sourceHandle: 'output',
            targetHandle: 'input',
          },
        ],
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = engine.validatePipeline(pipeline);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect cycles in pipeline', () => {
      const pipeline: Pipeline = {
        id: 'test-pipeline',
        name: 'Test Pipeline',
        nodes: [
          {
            id: 'node1',
            type: 'input',
            position: { x: 0, y: 0 },
            data: { label: 'Node 1' },
          },
          {
            id: 'node2',
            type: 'transform',
            position: { x: 200, y: 0 },
            data: { label: 'Node 2' },
          },
        ],
        connections: [
          {
            id: 'conn1',
            source: 'node1',
            target: 'node2',
            sourceHandle: 'output',
            targetHandle: 'input',
          },
          {
            id: 'conn2',
            source: 'node2',
            target: 'node1',
            sourceHandle: 'output',
            targetHandle: 'input',
          },
        ],
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = engine.validatePipeline(pipeline);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Pipeline contains cycles');
    });

    it('should detect orphaned nodes', () => {
      const pipeline: Pipeline = {
        id: 'test-pipeline',
        name: 'Test Pipeline',
        nodes: [
          {
            id: 'node1',
            type: 'input',
            position: { x: 0, y: 0 },
            data: { label: 'Connected Node' },
          },
          {
            id: 'node2',
            type: 'output',
            position: { x: 200, y: 0 },
            data: { label: 'Connected Node' },
          },
          {
            id: 'node3',
            type: 'transform',
            position: { x: 100, y: 100 },
            data: { label: 'Orphaned Node' },
          },
        ],
        connections: [
          {
            id: 'conn1',
            source: 'node1',
            target: 'node2',
            sourceHandle: 'output',
            targetHandle: 'input',
          },
        ],
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = engine.validatePipeline(pipeline);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Node node3 is not connected to any other nodes');
    });
  });

  describe('createPipeline', () => {
    it('should create a new pipeline', async () => {
      const pipelineData = {
        name: 'New Pipeline',
        description: 'A new pipeline for testing',
        nodes: [],
        connections: [],
        version: '1.0.0',
      };

      const pipeline = await engine.createPipeline(pipelineData);

      expect(pipeline.id).toBeDefined();
      expect(pipeline.name).toBe('New Pipeline');
      expect(pipeline.description).toBe('A new pipeline for testing');
      expect(pipeline.version).toBe('1.0.0');
      expect(pipeline.nodes).toHaveLength(0);
      expect(pipeline.connections).toHaveLength(0);
      expect(pipeline.createdAt).toBeInstanceOf(Date);
      expect(pipeline.updatedAt).toBeInstanceOf(Date);
    });

    it('should generate unique IDs for pipelines', async () => {
      const pipeline1 = await engine.createPipeline({
        name: 'Pipeline 1',
        nodes: [],
        connections: [],
        version: '1.0.0',
      });
      const pipeline2 = await engine.createPipeline({
        name: 'Pipeline 2',
        nodes: [],
        connections: [],
        version: '1.0.0',
      });

      expect(pipeline1.id).not.toBe(pipeline2.id);
    });
  });
});
