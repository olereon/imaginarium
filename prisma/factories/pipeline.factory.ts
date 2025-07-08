/**
 * Pipeline factory for generating test pipelines
 */

import { Pipeline, PipelineStatus } from '@prisma/client';
import { BaseFactory, generateId, generateLoremText } from './index';
import type { PipelineCreateInput, FactoryConfig } from './types';

export class PipelineFactory extends BaseFactory<Pipeline> {
  constructor(config: FactoryConfig) {
    super(config);
  }

  build(overrides: Partial<PipelineCreateInput> = {}): Pipeline {
    const sequence = this.getSequence('pipeline');
    const pipelineTypes = this.getPipelineTypes();
    const selectedType = this.randomElement(pipelineTypes);

    const defaultData: PipelineCreateInput = {
      userId: overrides.userId || 'user_placeholder',
      name: overrides.name || `${selectedType.name} Pipeline ${sequence}`,
      description: overrides.description || `${selectedType.description} ${generateLoremText(20)}`,
      status:
        overrides.status || this.randomElement<PipelineStatus>(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
      isPublic: overrides.isPublic !== undefined ? overrides.isPublic : this.randomBoolean(0.3),
      configuration: overrides.configuration || JSON.stringify(selectedType.configuration),
      metadata: overrides.metadata || JSON.stringify(selectedType.metadata),
      version: overrides.version || 1,
      parentId:
        overrides.parentId ||
        (this.randomBoolean(0.2) ? `pipeline_${this.randomInt(1, 100)}` : null),
      publishedAt: overrides.publishedAt || (this.randomBoolean(0.6) ? this.randomDate(30) : null),
      archivedAt: overrides.archivedAt || (this.randomBoolean(0.1) ? this.randomDate(7) : null),
    };

    const pipeline = {
      id: generateId('pipeline'),
      ...defaultData,
      ...overrides,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      deletedBy: null,
    } as Pipeline;

    return pipeline;
  }

  buildMany(count: number, overrides: Partial<PipelineCreateInput> = {}): Pipeline[] {
    return Array.from({ length: count }, () => this.build(overrides));
  }

  async create(overrides: Partial<PipelineCreateInput> = {}): Promise<Pipeline> {
    const pipelineData = this.build(overrides);

    return await this.config.prisma.pipeline.create({
      data: pipelineData,
    });
  }

  async createMany(
    count: number,
    overrides: Partial<PipelineCreateInput> = {}
  ): Promise<Pipeline[]> {
    const pipelines: Pipeline[] = [];

    for (let i = 0; i < count; i++) {
      const pipeline = await this.create(overrides);
      pipelines.push(pipeline);
    }

    return pipelines;
  }

  // Specialized factory methods
  async createImageGenerationPipeline(
    overrides: Partial<PipelineCreateInput> = {}
  ): Promise<Pipeline> {
    const config = this.getImageGenerationConfig();

    return await this.create({
      name: 'AI Image Generator',
      description: 'Generate high-quality images from text prompts using AI',
      configuration: JSON.stringify(config.configuration),
      metadata: JSON.stringify(config.metadata),
      status: 'PUBLISHED',
      isPublic: true,
      ...overrides,
    });
  }

  async createTextProcessingPipeline(
    overrides: Partial<PipelineCreateInput> = {}
  ): Promise<Pipeline> {
    const config = this.getTextProcessingConfig();

    return await this.create({
      name: 'Text Content Processor',
      description: 'Process and analyze text content with various AI models',
      configuration: JSON.stringify(config.configuration),
      metadata: JSON.stringify(config.metadata),
      status: 'PUBLISHED',
      isPublic: false,
      ...overrides,
    });
  }

  async createDataAnalysisPipeline(
    overrides: Partial<PipelineCreateInput> = {}
  ): Promise<Pipeline> {
    const config = this.getDataAnalysisConfig();

    return await this.create({
      name: 'Data Analysis Pipeline',
      description: 'Analyze and visualize data with automated insights',
      configuration: JSON.stringify(config.configuration),
      metadata: JSON.stringify(config.metadata),
      status: 'PUBLISHED',
      isPublic: false,
      ...overrides,
    });
  }

  async createWorkflowPipeline(overrides: Partial<PipelineCreateInput> = {}): Promise<Pipeline> {
    const config = this.getWorkflowConfig();

    return await this.create({
      name: 'Automated Workflow',
      description: 'Multi-step workflow automation with conditional logic',
      configuration: JSON.stringify(config.configuration),
      metadata: JSON.stringify(config.metadata),
      status: 'DRAFT',
      isPublic: false,
      ...overrides,
    });
  }

  async createComplexPipeline(overrides: Partial<PipelineCreateInput> = {}): Promise<Pipeline> {
    const config = this.getComplexPipelineConfig();

    return await this.create({
      name: 'Complex Multi-Modal Pipeline',
      description: 'Advanced pipeline with multiple AI models and processing steps',
      configuration: JSON.stringify(config.configuration),
      metadata: JSON.stringify(config.metadata),
      status: 'PUBLISHED',
      isPublic: false,
      ...overrides,
    });
  }

  // Pipeline configuration generators
  private getPipelineTypes() {
    return [
      {
        name: 'Image Generation',
        description: 'Create images from text prompts',
        configuration: this.getImageGenerationConfig().configuration,
        metadata: this.getImageGenerationConfig().metadata,
      },
      {
        name: 'Text Processing',
        description: 'Process and analyze text content',
        configuration: this.getTextProcessingConfig().configuration,
        metadata: this.getTextProcessingConfig().metadata,
      },
      {
        name: 'Data Analysis',
        description: 'Analyze and visualize data',
        configuration: this.getDataAnalysisConfig().configuration,
        metadata: this.getDataAnalysisConfig().metadata,
      },
      {
        name: 'Workflow Automation',
        description: 'Automate complex workflows',
        configuration: this.getWorkflowConfig().configuration,
        metadata: this.getWorkflowConfig().metadata,
      },
    ];
  }

  private getImageGenerationConfig() {
    return {
      configuration: {
        nodes: [
          {
            id: 'input-1',
            type: 'text-input',
            position: { x: 100, y: 100 },
            config: {
              label: 'Enter your prompt',
              placeholder: 'Describe the image you want to generate...',
              required: true,
            },
          },
          {
            id: 'ai-1',
            type: 'openai-image',
            position: { x: 400, y: 100 },
            config: {
              model: 'dall-e-3',
              size: '1024x1024',
              quality: 'standard',
              style: 'vivid',
            },
          },
          {
            id: 'output-1',
            type: 'image-output',
            position: { x: 700, y: 100 },
            config: {
              format: 'png',
              quality: 90,
            },
          },
        ],
        connections: [
          {
            id: 'conn-1',
            source: 'input-1',
            target: 'ai-1',
            sourceHandle: 'output',
            targetHandle: 'prompt',
          },
          {
            id: 'conn-2',
            source: 'ai-1',
            target: 'output-1',
            sourceHandle: 'image',
            targetHandle: 'input',
          },
        ],
      },
      metadata: {
        tags: ['ai', 'image-generation', 'openai', 'dall-e'],
        category: 'content-creation',
        difficulty: 'beginner',
        estimatedTime: '30-60 seconds',
        cost: 'low',
      },
    };
  }

  private getTextProcessingConfig() {
    return {
      configuration: {
        nodes: [
          {
            id: 'input-1',
            type: 'text-input',
            position: { x: 100, y: 100 },
            config: {
              label: 'Input text',
              placeholder: 'Enter text to process...',
              multiline: true,
            },
          },
          {
            id: 'ai-1',
            type: 'openai-text',
            position: { x: 400, y: 50 },
            config: {
              model: 'gpt-4',
              task: 'summarize',
              maxTokens: 500,
            },
          },
          {
            id: 'ai-2',
            type: 'openai-text',
            position: { x: 400, y: 150 },
            config: {
              model: 'gpt-4',
              task: 'analyze-sentiment',
              maxTokens: 100,
            },
          },
          {
            id: 'output-1',
            type: 'text-output',
            position: { x: 700, y: 100 },
            config: {
              format: 'json',
              structure: 'combined',
            },
          },
        ],
        connections: [
          {
            id: 'conn-1',
            source: 'input-1',
            target: 'ai-1',
            sourceHandle: 'output',
            targetHandle: 'prompt',
          },
          {
            id: 'conn-2',
            source: 'input-1',
            target: 'ai-2',
            sourceHandle: 'output',
            targetHandle: 'prompt',
          },
          {
            id: 'conn-3',
            source: 'ai-1',
            target: 'output-1',
            sourceHandle: 'result',
            targetHandle: 'summary',
          },
          {
            id: 'conn-4',
            source: 'ai-2',
            target: 'output-1',
            sourceHandle: 'result',
            targetHandle: 'sentiment',
          },
        ],
      },
      metadata: {
        tags: ['ai', 'text-processing', 'nlp', 'sentiment-analysis'],
        category: 'analysis',
        difficulty: 'intermediate',
        estimatedTime: '1-2 minutes',
        cost: 'medium',
      },
    };
  }

  private getDataAnalysisConfig() {
    return {
      configuration: {
        nodes: [
          {
            id: 'input-1',
            type: 'file-input',
            position: { x: 100, y: 100 },
            config: {
              acceptedTypes: ['csv', 'json', 'xlsx'],
              label: 'Upload data file',
            },
          },
          {
            id: 'transform-1',
            type: 'data-transform',
            position: { x: 300, y: 100 },
            config: {
              operations: ['clean', 'normalize', 'validate'],
            },
          },
          {
            id: 'analysis-1',
            type: 'data-analysis',
            position: { x: 500, y: 50 },
            config: {
              type: 'statistical',
              metrics: ['mean', 'median', 'std', 'correlation'],
            },
          },
          {
            id: 'viz-1',
            type: 'visualization',
            position: { x: 500, y: 150 },
            config: {
              type: 'chart',
              chartType: 'auto',
              theme: 'default',
            },
          },
          {
            id: 'output-1',
            type: 'report-output',
            position: { x: 700, y: 100 },
            config: {
              format: 'pdf',
              includeCharts: true,
              includeStats: true,
            },
          },
        ],
        connections: [
          {
            id: 'conn-1',
            source: 'input-1',
            target: 'transform-1',
            sourceHandle: 'data',
            targetHandle: 'input',
          },
          {
            id: 'conn-2',
            source: 'transform-1',
            target: 'analysis-1',
            sourceHandle: 'output',
            targetHandle: 'data',
          },
          {
            id: 'conn-3',
            source: 'transform-1',
            target: 'viz-1',
            sourceHandle: 'output',
            targetHandle: 'data',
          },
          {
            id: 'conn-4',
            source: 'analysis-1',
            target: 'output-1',
            sourceHandle: 'results',
            targetHandle: 'stats',
          },
          {
            id: 'conn-5',
            source: 'viz-1',
            target: 'output-1',
            sourceHandle: 'chart',
            targetHandle: 'visualizations',
          },
        ],
      },
      metadata: {
        tags: ['data-analysis', 'statistics', 'visualization', 'reporting'],
        category: 'analytics',
        difficulty: 'advanced',
        estimatedTime: '2-5 minutes',
        cost: 'medium',
      },
    };
  }

  private getWorkflowConfig() {
    return {
      configuration: {
        nodes: [
          {
            id: 'trigger-1',
            type: 'webhook-trigger',
            position: { x: 100, y: 100 },
            config: {
              method: 'POST',
              authentication: 'api-key',
            },
          },
          {
            id: 'condition-1',
            type: 'condition',
            position: { x: 300, y: 100 },
            config: {
              expression: 'input.priority === "high"',
              trueLabel: 'High Priority',
              falseLabel: 'Normal Priority',
            },
          },
          {
            id: 'action-1',
            type: 'email-send',
            position: { x: 500, y: 50 },
            config: {
              template: 'urgent-notification',
              recipients: ['admin@company.com'],
            },
          },
          {
            id: 'action-2',
            type: 'database-insert',
            position: { x: 500, y: 150 },
            config: {
              table: 'tasks',
              mapping: 'auto',
            },
          },
          {
            id: 'output-1',
            type: 'json-response',
            position: { x: 700, y: 100 },
            config: {
              statusCode: 200,
              message: 'Task processed successfully',
            },
          },
        ],
        connections: [
          {
            id: 'conn-1',
            source: 'trigger-1',
            target: 'condition-1',
            sourceHandle: 'payload',
            targetHandle: 'input',
          },
          {
            id: 'conn-2',
            source: 'condition-1',
            target: 'action-1',
            sourceHandle: 'true',
            targetHandle: 'input',
          },
          {
            id: 'conn-3',
            source: 'condition-1',
            target: 'action-2',
            sourceHandle: 'false',
            targetHandle: 'input',
          },
          {
            id: 'conn-4',
            source: 'action-1',
            target: 'output-1',
            sourceHandle: 'result',
            targetHandle: 'input',
          },
          {
            id: 'conn-5',
            source: 'action-2',
            target: 'output-1',
            sourceHandle: 'result',
            targetHandle: 'input',
          },
        ],
      },
      metadata: {
        tags: ['workflow', 'automation', 'webhook', 'conditional'],
        category: 'automation',
        difficulty: 'advanced',
        estimatedTime: '500ms - 2 seconds',
        cost: 'low',
      },
    };
  }

  private getComplexPipelineConfig() {
    return {
      configuration: {
        nodes: [
          {
            id: 'input-1',
            type: 'multi-input',
            position: { x: 100, y: 150 },
            config: {
              inputs: [
                { type: 'text', label: 'Description' },
                { type: 'file', label: 'Reference Image' },
                { type: 'json', label: 'Parameters' },
              ],
            },
          },
          {
            id: 'ai-1',
            type: 'openai-vision',
            position: { x: 300, y: 100 },
            config: {
              model: 'gpt-4-vision-preview',
              task: 'analyze-image',
            },
          },
          {
            id: 'ai-2',
            type: 'openai-text',
            position: { x: 300, y: 200 },
            config: {
              model: 'gpt-4',
              task: 'enhance-description',
            },
          },
          {
            id: 'merge-1',
            type: 'data-merge',
            position: { x: 500, y: 150 },
            config: {
              strategy: 'combine',
              format: 'structured',
            },
          },
          {
            id: 'ai-3',
            type: 'stability-image',
            position: { x: 700, y: 100 },
            config: {
              model: 'stable-diffusion-xl',
              steps: 50,
              guidance: 7.5,
            },
          },
          {
            id: 'ai-4',
            type: 'openai-image',
            position: { x: 700, y: 200 },
            config: {
              model: 'dall-e-3',
              size: '1024x1024',
              quality: 'hd',
            },
          },
          {
            id: 'compare-1',
            type: 'image-compare',
            position: { x: 900, y: 150 },
            config: {
              metrics: ['similarity', 'quality', 'style'],
            },
          },
          {
            id: 'output-1',
            type: 'gallery-output',
            position: { x: 1100, y: 150 },
            config: {
              layout: 'grid',
              includeMetrics: true,
              downloadable: true,
            },
          },
        ],
        connections: [
          {
            id: 'conn-1',
            source: 'input-1',
            target: 'ai-1',
            sourceHandle: 'image',
            targetHandle: 'image',
          },
          {
            id: 'conn-2',
            source: 'input-1',
            target: 'ai-2',
            sourceHandle: 'text',
            targetHandle: 'prompt',
          },
          {
            id: 'conn-3',
            source: 'ai-1',
            target: 'merge-1',
            sourceHandle: 'analysis',
            targetHandle: 'input1',
          },
          {
            id: 'conn-4',
            source: 'ai-2',
            target: 'merge-1',
            sourceHandle: 'enhanced',
            targetHandle: 'input2',
          },
          {
            id: 'conn-5',
            source: 'merge-1',
            target: 'ai-3',
            sourceHandle: 'output',
            targetHandle: 'prompt',
          },
          {
            id: 'conn-6',
            source: 'merge-1',
            target: 'ai-4',
            sourceHandle: 'output',
            targetHandle: 'prompt',
          },
          {
            id: 'conn-7',
            source: 'ai-3',
            target: 'compare-1',
            sourceHandle: 'image',
            targetHandle: 'image1',
          },
          {
            id: 'conn-8',
            source: 'ai-4',
            target: 'compare-1',
            sourceHandle: 'image',
            targetHandle: 'image2',
          },
          {
            id: 'conn-9',
            source: 'compare-1',
            target: 'output-1',
            sourceHandle: 'results',
            targetHandle: 'input',
          },
        ],
      },
      metadata: {
        tags: ['ai', 'multi-modal', 'image-generation', 'comparison', 'advanced'],
        category: 'advanced-ai',
        difficulty: 'expert',
        estimatedTime: '2-5 minutes',
        cost: 'high',
      },
    };
  }

  // Performance testing
  async createPerformancePipelines(count: number, userId: string): Promise<Pipeline[]> {
    const batchSize = 100;
    const pipelines: Pipeline[] = [];

    for (let i = 0; i < count; i += batchSize) {
      const currentBatchSize = Math.min(batchSize, count - i);
      const batch = this.buildMany(currentBatchSize, { userId });

      const createdPipelines = await this.config.prisma.pipeline.createMany({
        data: batch.map(pipeline => ({
          ...pipeline,
          id: undefined, // Let Prisma generate IDs
        })),
      });

      // Fetch the created pipelines
      const fetchedPipelines = await this.config.prisma.pipeline.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: currentBatchSize,
      });

      pipelines.push(...fetchedPipelines);
    }

    return pipelines;
  }

  // Utility methods
  generatePipelineStats(pipelines: Pipeline[]): Record<string, any> {
    const stats = {
      total: pipelines.length,
      byStatus: {
        DRAFT: pipelines.filter(p => p.status === 'DRAFT').length,
        PUBLISHED: pipelines.filter(p => p.status === 'PUBLISHED').length,
        ARCHIVED: pipelines.filter(p => p.status === 'ARCHIVED').length,
      },
      public: pipelines.filter(p => p.isPublic).length,
      hasParent: pipelines.filter(p => p.parentId).length,
      published: pipelines.filter(p => p.publishedAt).length,
      archived: pipelines.filter(p => p.archivedAt).length,
    };

    return stats;
  }
}
