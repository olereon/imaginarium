export interface PipelineGraph {
  id: string;
  name: string;
  description?: string;
  nodes: PipelineNode[];
  connections: PipelineConnection[];
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  inputs: string[];
  outputs: string[];
}

export interface PipelineConnection {
  id: string;
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
}

export interface PipelineExecution {
  id: string;
  pipelineId: string;
  status: PipelineExecutionStatus;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  outputs: ExecutionOutput[];
}

export type PipelineExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ExecutionOutput {
  nodeId: string;
  type: 'image' | 'video' | 'text' | 'file';
  url?: string;
  data?: unknown;
  metadata: Record<string, unknown>;
}
