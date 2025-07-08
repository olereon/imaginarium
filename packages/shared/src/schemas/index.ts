import { z } from 'zod';

export const PipelineNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.record(z.unknown()),
  inputs: z.array(z.string()),
  outputs: z.array(z.string()),
});

export const PipelineConnectionSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourceHandle: z.string().optional(),
  target: z.string(),
  targetHandle: z.string().optional(),
});

export const PipelineSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  nodes: z.array(PipelineNodeSchema),
  connections: z.array(PipelineConnectionSchema),
  version: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ExecutionStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

export const ExecutionOutputSchema = z.object({
  nodeId: z.string(),
  type: z.enum(['image', 'video', 'text', 'file']),
  url: z.string().optional(),
  data: z.unknown().optional(),
  metadata: z.record(z.unknown()),
});

export const ExecutionSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  status: ExecutionStatusSchema,
  startedAt: z.date(),
  completedAt: z.date().optional(),
  error: z.string().optional(),
  outputs: z.array(ExecutionOutputSchema),
});