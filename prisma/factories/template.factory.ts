/**
 * Template factory for generating pipeline templates
 */

import { PipelineTemplate } from '@prisma/client'
import { BaseFactory, generateId, generateLoremText } from './index'
import type { TemplateCreateInput, FactoryConfig } from './types'

export class TemplateFactory extends BaseFactory<PipelineTemplate> {
  constructor(config: FactoryConfig) {
    super(config)
  }

  build(overrides: Partial<TemplateCreateInput> = {}): PipelineTemplate {
    const sequence = this.getSequence('template')
    const templateType = this.getRandomTemplateType()
    
    const defaultData: TemplateCreateInput = {
      pipelineId: overrides.pipelineId || (this.randomBoolean(0.7) ? `pipeline_${this.randomInt(1, 100)}` : null),
      name: overrides.name || templateType.name,
      description: overrides.description || templateType.description,
      category: overrides.category || templateType.category,
      configuration: overrides.configuration || JSON.stringify(templateType.configuration),
      parameters: overrides.parameters || JSON.stringify(templateType.parameters),
      isPublic: overrides.isPublic !== undefined ? overrides.isPublic : this.randomBoolean(0.6),
      usageCount: overrides.usageCount || this.randomInt(0, 1000),
    }

    const template = {
      id: generateId('template'),
      ...defaultData,
      ...overrides,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as PipelineTemplate

    return template
  }

  buildMany(count: number, overrides: Partial<TemplateCreateInput> = {}): PipelineTemplate[] {
    return Array.from({ length: count }, () => this.build(overrides))
  }

  async create(overrides: Partial<TemplateCreateInput> = {}): Promise<PipelineTemplate> {
    const templateData = this.build(overrides)
    
    return await this.config.prisma.pipelineTemplate.create({
      data: templateData
    })
  }

  async createMany(count: number, overrides: Partial<TemplateCreateInput> = {}): Promise<PipelineTemplate[]> {
    const templates: PipelineTemplate[] = []
    
    for (let i = 0; i < count; i++) {
      const template = await this.create(overrides)
      templates.push(template)
    }
    
    return templates
  }

  // Specialized factory methods for different template types
  async createContentCreationTemplate(overrides: Partial<TemplateCreateInput> = {}): Promise<PipelineTemplate> {
    return await this.create({
      name: 'Content Creation Template',
      description: 'Template for creating various types of content with AI assistance',
      category: 'content-creation',
      configuration: JSON.stringify(this.getContentCreationConfig()),
      parameters: JSON.stringify(this.getContentCreationParameters()),
      isPublic: true,
      ...overrides
    })
  }

  async createDataAnalysisTemplate(overrides: Partial<TemplateCreateInput> = {}): Promise<PipelineTemplate> {
    return await this.create({
      name: 'Data Analysis Template',
      description: 'Template for analyzing and visualizing data with automated insights',
      category: 'data-analysis',
      configuration: JSON.stringify(this.getDataAnalysisConfig()),
      parameters: JSON.stringify(this.getDataAnalysisParameters()),
      isPublic: true,
      ...overrides
    })
  }

  async createWorkflowAutomationTemplate(overrides: Partial<TemplateCreateInput> = {}): Promise<PipelineTemplate> {
    return await this.create({
      name: 'Workflow Automation Template',
      description: 'Template for automating complex business workflows',
      category: 'automation',
      configuration: JSON.stringify(this.getWorkflowAutomationConfig()),
      parameters: JSON.stringify(this.getWorkflowAutomationParameters()),
      isPublic: true,
      ...overrides
    })
  }

  async createImageProcessingTemplate(overrides: Partial<TemplateCreateInput> = {}): Promise<PipelineTemplate> {
    return await this.create({
      name: 'Image Processing Template',
      description: 'Template for advanced image processing and enhancement',
      category: 'image-processing',
      configuration: JSON.stringify(this.getImageProcessingConfig()),
      parameters: JSON.stringify(this.getImageProcessingParameters()),
      isPublic: true,
      ...overrides
    })
  }

  async createTextProcessingTemplate(overrides: Partial<TemplateCreateInput> = {}): Promise<PipelineTemplate> {
    return await this.create({
      name: 'Text Processing Template',
      description: 'Template for natural language processing and text analysis',
      category: 'text-processing',
      configuration: JSON.stringify(this.getTextProcessingConfig()),
      parameters: JSON.stringify(this.getTextProcessingParameters()),
      isPublic: true,
      ...overrides
    })
  }

  async createAPIIntegrationTemplate(overrides: Partial<TemplateCreateInput> = {}): Promise<PipelineTemplate> {
    return await this.create({
      name: 'API Integration Template',
      description: 'Template for integrating with external APIs and services',
      category: 'integration',
      configuration: JSON.stringify(this.getAPIIntegrationConfig()),
      parameters: JSON.stringify(this.getAPIIntegrationParameters()),
      isPublic: true,
      ...overrides
    })
  }

  // Template configuration generators
  private getRandomTemplateType() {
    const types = [
      {
        name: 'AI Image Generator',
        description: 'Generate images using AI models',
        category: 'content-creation',
        configuration: this.getContentCreationConfig(),
        parameters: this.getContentCreationParameters()
      },
      {
        name: 'Data Analytics Dashboard',
        description: 'Analyze data and create visualizations',
        category: 'data-analysis',
        configuration: this.getDataAnalysisConfig(),
        parameters: this.getDataAnalysisParameters()
      },
      {
        name: 'Workflow Automation',
        description: 'Automate business processes',
        category: 'automation',
        configuration: this.getWorkflowAutomationConfig(),
        parameters: this.getWorkflowAutomationParameters()
      },
      {
        name: 'Image Processor',
        description: 'Process and enhance images',
        category: 'image-processing',
        configuration: this.getImageProcessingConfig(),
        parameters: this.getImageProcessingParameters()
      },
      {
        name: 'Text Analyzer',
        description: 'Analyze and process text content',
        category: 'text-processing',
        configuration: this.getTextProcessingConfig(),
        parameters: this.getTextProcessingParameters()
      },
      {
        name: 'API Connector',
        description: 'Connect to external APIs',
        category: 'integration',
        configuration: this.getAPIIntegrationConfig(),
        parameters: this.getAPIIntegrationParameters()
      }
    ]
    
    return this.randomElement(types)
  }

  private getContentCreationConfig() {
    return {
      nodes: [
        {
          id: 'input-{{uuid}}',
          type: 'text-input',
          position: { x: 100, y: 100 },
          config: {
            label: '{{inputLabel}}',
            placeholder: '{{inputPlaceholder}}',
            required: true
          }
        },
        {
          id: 'ai-{{uuid}}',
          type: '{{aiProvider}}-{{contentType}}',
          position: { x: 400, y: 100 },
          config: {
            model: '{{model}}',
            temperature: '{{temperature}}',
            maxTokens: '{{maxTokens}}',
            style: '{{style}}'
          }
        },
        {
          id: 'output-{{uuid}}',
          type: '{{contentType}}-output',
          position: { x: 700, y: 100 },
          config: {
            format: '{{outputFormat}}',
            quality: '{{quality}}'
          }
        }
      ],
      connections: [
        {
          id: 'conn-{{uuid}}',
          source: 'input-{{uuid}}',
          target: 'ai-{{uuid}}',
          sourceHandle: 'output',
          targetHandle: 'prompt'
        },
        {
          id: 'conn-{{uuid}}-2',
          source: 'ai-{{uuid}}',
          target: 'output-{{uuid}}',
          sourceHandle: 'result',
          targetHandle: 'input'
        }
      ]
    }
  }

  private getContentCreationParameters() {
    return {
      inputLabel: {
        type: 'string',
        default: 'Enter your prompt',
        description: 'Label for the input field'
      },
      inputPlaceholder: {
        type: 'string',
        default: 'Describe what you want to create...',
        description: 'Placeholder text for the input field'
      },
      aiProvider: {
        type: 'select',
        options: ['openai', 'anthropic', 'google', 'stability'],
        default: 'openai',
        description: 'AI provider to use'
      },
      contentType: {
        type: 'select',
        options: ['text', 'image', 'audio', 'video'],
        default: 'text',
        description: 'Type of content to generate'
      },
      model: {
        type: 'string',
        default: 'gpt-4',
        description: 'Model to use for generation'
      },
      temperature: {
        type: 'number',
        min: 0,
        max: 2,
        default: 0.7,
        description: 'Creativity level (0-2)'
      },
      maxTokens: {
        type: 'number',
        min: 1,
        max: 4000,
        default: 1000,
        description: 'Maximum tokens to generate'
      },
      style: {
        type: 'string',
        default: 'natural',
        description: 'Style of the generated content'
      },
      outputFormat: {
        type: 'select',
        options: ['json', 'text', 'html', 'markdown'],
        default: 'text',
        description: 'Output format'
      },
      quality: {
        type: 'select',
        options: ['draft', 'standard', 'high', 'premium'],
        default: 'standard',
        description: 'Output quality level'
      }
    }
  }

  private getDataAnalysisConfig() {
    return {
      nodes: [
        {
          id: 'input-{{uuid}}',
          type: 'file-input',
          position: { x: 100, y: 100 },
          config: {
            acceptedTypes: ['{{dataTypes}}'],
            maxSize: '{{maxFileSize}}',
            label: '{{inputLabel}}'
          }
        },
        {
          id: 'transform-{{uuid}}',
          type: 'data-transform',
          position: { x: 300, y: 100 },
          config: {
            operations: ['{{transformOperations}}'],
            validation: '{{enableValidation}}'
          }
        },
        {
          id: 'analysis-{{uuid}}',
          type: 'data-analysis',
          position: { x: 500, y: 100 },
          config: {
            analysisType: '{{analysisType}}',
            metrics: ['{{metrics}}'],
            confidence: '{{confidenceLevel}}'
          }
        },
        {
          id: 'viz-{{uuid}}',
          type: 'visualization',
          position: { x: 500, y: 200 },
          config: {
            chartType: '{{chartType}}',
            theme: '{{theme}}',
            interactive: '{{interactive}}'
          }
        },
        {
          id: 'output-{{uuid}}',
          type: 'report-output',
          position: { x: 700, y: 150 },
          config: {
            format: '{{reportFormat}}',
            includeData: '{{includeRawData}}',
            template: '{{reportTemplate}}'
          }
        }
      ],
      connections: [
        {
          id: 'conn-{{uuid}}-1',
          source: 'input-{{uuid}}',
          target: 'transform-{{uuid}}',
          sourceHandle: 'data',
          targetHandle: 'input'
        },
        {
          id: 'conn-{{uuid}}-2',
          source: 'transform-{{uuid}}',
          target: 'analysis-{{uuid}}',
          sourceHandle: 'output',
          targetHandle: 'data'
        },
        {
          id: 'conn-{{uuid}}-3',
          source: 'transform-{{uuid}}',
          target: 'viz-{{uuid}}',
          sourceHandle: 'output',
          targetHandle: 'data'
        },
        {
          id: 'conn-{{uuid}}-4',
          source: 'analysis-{{uuid}}',
          target: 'output-{{uuid}}',
          sourceHandle: 'results',
          targetHandle: 'analysis'
        },
        {
          id: 'conn-{{uuid}}-5',
          source: 'viz-{{uuid}}',
          target: 'output-{{uuid}}',
          sourceHandle: 'chart',
          targetHandle: 'visualization'
        }
      ]
    }
  }

  private getDataAnalysisParameters() {
    return {
      inputLabel: {
        type: 'string',
        default: 'Upload data file',
        description: 'Label for the file input'
      },
      dataTypes: {
        type: 'multiselect',
        options: ['csv', 'json', 'xlsx', 'parquet', 'sql'],
        default: ['csv', 'json', 'xlsx'],
        description: 'Accepted data file types'
      },
      maxFileSize: {
        type: 'number',
        default: 100,
        description: 'Maximum file size in MB'
      },
      transformOperations: {
        type: 'multiselect',
        options: ['clean', 'normalize', 'validate', 'deduplicate', 'aggregate'],
        default: ['clean', 'normalize', 'validate'],
        description: 'Data transformation operations'
      },
      enableValidation: {
        type: 'boolean',
        default: true,
        description: 'Enable data validation'
      },
      analysisType: {
        type: 'select',
        options: ['descriptive', 'predictive', 'prescriptive', 'diagnostic'],
        default: 'descriptive',
        description: 'Type of analysis to perform'
      },
      metrics: {
        type: 'multiselect',
        options: ['mean', 'median', 'mode', 'std', 'correlation', 'regression'],
        default: ['mean', 'median', 'std'],
        description: 'Statistical metrics to calculate'
      },
      confidenceLevel: {
        type: 'number',
        min: 0.8,
        max: 0.99,
        default: 0.95,
        description: 'Statistical confidence level'
      },
      chartType: {
        type: 'select',
        options: ['auto', 'bar', 'line', 'scatter', 'pie', 'heatmap'],
        default: 'auto',
        description: 'Type of chart to generate'
      },
      theme: {
        type: 'select',
        options: ['default', 'dark', 'light', 'colorful', 'minimal'],
        default: 'default',
        description: 'Chart theme'
      },
      interactive: {
        type: 'boolean',
        default: true,
        description: 'Make charts interactive'
      },
      reportFormat: {
        type: 'select',
        options: ['pdf', 'html', 'docx', 'pptx'],
        default: 'pdf',
        description: 'Report output format'
      },
      includeRawData: {
        type: 'boolean',
        default: false,
        description: 'Include raw data in report'
      },
      reportTemplate: {
        type: 'select',
        options: ['standard', 'executive', 'detailed', 'minimal'],
        default: 'standard',
        description: 'Report template style'
      }
    }
  }

  private getWorkflowAutomationConfig() {
    return {
      nodes: [
        {
          id: 'trigger-{{uuid}}',
          type: '{{triggerType}}',
          position: { x: 100, y: 100 },
          config: {
            schedule: '{{schedule}}',
            condition: '{{triggerCondition}}'
          }
        },
        {
          id: 'condition-{{uuid}}',
          type: 'condition',
          position: { x: 300, y: 100 },
          config: {
            expression: '{{conditionExpression}}',
            trueLabel: '{{trueLabel}}',
            falseLabel: '{{falseLabel}}'
          }
        },
        {
          id: 'action-true-{{uuid}}',
          type: '{{trueAction}}',
          position: { x: 500, y: 50 },
          config: {
            parameters: '{{trueActionParams}}'
          }
        },
        {
          id: 'action-false-{{uuid}}',
          type: '{{falseAction}}',
          position: { x: 500, y: 150 },
          config: {
            parameters: '{{falseActionParams}}'
          }
        },
        {
          id: 'notify-{{uuid}}',
          type: 'notification',
          position: { x: 700, y: 100 },
          config: {
            channels: ['{{notificationChannels}}'],
            template: '{{notificationTemplate}}'
          }
        }
      ],
      connections: [
        {
          id: 'conn-{{uuid}}-1',
          source: 'trigger-{{uuid}}',
          target: 'condition-{{uuid}}',
          sourceHandle: 'output',
          targetHandle: 'input'
        },
        {
          id: 'conn-{{uuid}}-2',
          source: 'condition-{{uuid}}',
          target: 'action-true-{{uuid}}',
          sourceHandle: 'true',
          targetHandle: 'input'
        },
        {
          id: 'conn-{{uuid}}-3',
          source: 'condition-{{uuid}}',
          target: 'action-false-{{uuid}}',
          sourceHandle: 'false',
          targetHandle: 'input'
        },
        {
          id: 'conn-{{uuid}}-4',
          source: 'action-true-{{uuid}}',
          target: 'notify-{{uuid}}',
          sourceHandle: 'result',
          targetHandle: 'input'
        },
        {
          id: 'conn-{{uuid}}-5',
          source: 'action-false-{{uuid}}',
          target: 'notify-{{uuid}}',
          sourceHandle: 'result',
          targetHandle: 'input'
        }
      ]
    }
  }

  private getWorkflowAutomationParameters() {
    return {
      triggerType: {
        type: 'select',
        options: ['schedule', 'webhook', 'file-watch', 'email', 'database'],
        default: 'schedule',
        description: 'Type of trigger to use'
      },
      schedule: {
        type: 'string',
        default: '0 9 * * *',
        description: 'Cron schedule expression'
      },
      triggerCondition: {
        type: 'string',
        default: 'true',
        description: 'Condition for trigger activation'
      },
      conditionExpression: {
        type: 'string',
        default: 'input.priority === "high"',
        description: 'JavaScript expression for condition'
      },
      trueLabel: {
        type: 'string',
        default: 'High Priority',
        description: 'Label for true condition'
      },
      falseLabel: {
        type: 'string',
        default: 'Normal Priority',
        description: 'Label for false condition'
      },
      trueAction: {
        type: 'select',
        options: ['email', 'slack', 'webhook', 'database', 'api-call'],
        default: 'email',
        description: 'Action for true condition'
      },
      falseAction: {
        type: 'select',
        options: ['email', 'slack', 'webhook', 'database', 'api-call'],
        default: 'database',
        description: 'Action for false condition'
      },
      trueActionParams: {
        type: 'json',
        default: '{"to": "admin@company.com", "subject": "High Priority Alert"}',
        description: 'Parameters for true action'
      },
      falseActionParams: {
        type: 'json',
        default: '{"table": "tasks", "operation": "insert"}',
        description: 'Parameters for false action'
      },
      notificationChannels: {
        type: 'multiselect',
        options: ['email', 'slack', 'teams', 'webhook', 'sms'],
        default: ['email'],
        description: 'Notification channels'
      },
      notificationTemplate: {
        type: 'select',
        options: ['default', 'minimal', 'detailed', 'custom'],
        default: 'default',
        description: 'Notification template'
      }
    }
  }

  private getImageProcessingConfig() {
    return {
      nodes: [
        {
          id: 'input-{{uuid}}',
          type: 'image-input',
          position: { x: 100, y: 100 },
          config: {
            acceptedFormats: ['{{imageFormats}}'],
            maxSize: '{{maxImageSize}}'
          }
        },
        {
          id: 'resize-{{uuid}}',
          type: 'image-resize',
          position: { x: 300, y: 100 },
          config: {
            width: '{{targetWidth}}',
            height: '{{targetHeight}}',
            maintainAspectRatio: '{{maintainAspectRatio}}'
          }
        },
        {
          id: 'filter-{{uuid}}',
          type: 'image-filter',
          position: { x: 500, y: 100 },
          config: {
            filters: ['{{imageFilters}}'],
            intensity: '{{filterIntensity}}'
          }
        },
        {
          id: 'output-{{uuid}}',
          type: 'image-output',
          position: { x: 700, y: 100 },
          config: {
            format: '{{outputFormat}}',
            quality: '{{outputQuality}}',
            compression: '{{compressionLevel}}'
          }
        }
      ],
      connections: [
        {
          id: 'conn-{{uuid}}-1',
          source: 'input-{{uuid}}',
          target: 'resize-{{uuid}}',
          sourceHandle: 'image',
          targetHandle: 'input'
        },
        {
          id: 'conn-{{uuid}}-2',
          source: 'resize-{{uuid}}',
          target: 'filter-{{uuid}}',
          sourceHandle: 'output',
          targetHandle: 'input'
        },
        {
          id: 'conn-{{uuid}}-3',
          source: 'filter-{{uuid}}',
          target: 'output-{{uuid}}',
          sourceHandle: 'output',
          targetHandle: 'input'
        }
      ]
    }
  }

  private getImageProcessingParameters() {
    return {
      imageFormats: {
        type: 'multiselect',
        options: ['jpg', 'png', 'webp', 'gif', 'bmp', 'tiff'],
        default: ['jpg', 'png', 'webp'],
        description: 'Accepted image formats'
      },
      maxImageSize: {
        type: 'number',
        default: 50,
        description: 'Maximum image size in MB'
      },
      targetWidth: {
        type: 'number',
        default: 1920,
        description: 'Target width in pixels'
      },
      targetHeight: {
        type: 'number',
        default: 1080,
        description: 'Target height in pixels'
      },
      maintainAspectRatio: {
        type: 'boolean',
        default: true,
        description: 'Maintain original aspect ratio'
      },
      imageFilters: {
        type: 'multiselect',
        options: ['blur', 'sharpen', 'brighten', 'contrast', 'saturate', 'grayscale', 'sepia'],
        default: ['brighten', 'contrast'],
        description: 'Image filters to apply'
      },
      filterIntensity: {
        type: 'number',
        min: 0,
        max: 100,
        default: 50,
        description: 'Filter intensity (0-100)'
      },
      outputFormat: {
        type: 'select',
        options: ['jpg', 'png', 'webp', 'avif'],
        default: 'webp',
        description: 'Output image format'
      },
      outputQuality: {
        type: 'number',
        min: 1,
        max: 100,
        default: 85,
        description: 'Output quality (1-100)'
      },
      compressionLevel: {
        type: 'select',
        options: ['none', 'low', 'medium', 'high', 'maximum'],
        default: 'medium',
        description: 'Compression level'
      }
    }
  }

  private getTextProcessingConfig() {
    return {
      nodes: [
        {
          id: 'input-{{uuid}}',
          type: 'text-input',
          position: { x: 100, y: 100 },
          config: {
            multiline: true,
            maxLength: '{{maxTextLength}}',
            language: '{{inputLanguage}}'
          }
        },
        {
          id: 'preprocess-{{uuid}}',
          type: 'text-preprocess',
          position: { x: 300, y: 100 },
          config: {
            operations: ['{{preprocessOperations}}'],
            normalize: '{{normalizeText}}'
          }
        },
        {
          id: 'analyze-{{uuid}}',
          type: 'text-analyze',
          position: { x: 500, y: 100 },
          config: {
            analysisTypes: ['{{analysisTypes}}'],
            model: '{{analysisModel}}'
          }
        },
        {
          id: 'output-{{uuid}}',
          type: 'analysis-output',
          position: { x: 700, y: 100 },
          config: {
            format: '{{outputFormat}}',
            includeMetrics: '{{includeMetrics}}'
          }
        }
      ],
      connections: [
        {
          id: 'conn-{{uuid}}-1',
          source: 'input-{{uuid}}',
          target: 'preprocess-{{uuid}}',
          sourceHandle: 'text',
          targetHandle: 'input'
        },
        {
          id: 'conn-{{uuid}}-2',
          source: 'preprocess-{{uuid}}',
          target: 'analyze-{{uuid}}',
          sourceHandle: 'output',
          targetHandle: 'text'
        },
        {
          id: 'conn-{{uuid}}-3',
          source: 'analyze-{{uuid}}',
          target: 'output-{{uuid}}',
          sourceHandle: 'results',
          targetHandle: 'input'
        }
      ]
    }
  }

  private getTextProcessingParameters() {
    return {
      maxTextLength: {
        type: 'number',
        default: 10000,
        description: 'Maximum text length in characters'
      },
      inputLanguage: {
        type: 'select',
        options: ['auto', 'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja'],
        default: 'auto',
        description: 'Input text language'
      },
      preprocessOperations: {
        type: 'multiselect',
        options: ['tokenize', 'lemmatize', 'remove_stopwords', 'remove_punctuation', 'lowercase'],
        default: ['tokenize', 'remove_stopwords', 'lowercase'],
        description: 'Text preprocessing operations'
      },
      normalizeText: {
        type: 'boolean',
        default: true,
        description: 'Normalize text encoding and formatting'
      },
      analysisTypes: {
        type: 'multiselect',
        options: ['sentiment', 'entities', 'keywords', 'topics', 'summary', 'classification'],
        default: ['sentiment', 'entities', 'keywords'],
        description: 'Types of analysis to perform'
      },
      analysisModel: {
        type: 'select',
        options: ['spacy', 'nltk', 'transformers', 'openai', 'anthropic'],
        default: 'transformers',
        description: 'Model to use for analysis'
      },
      outputFormat: {
        type: 'select',
        options: ['json', 'csv', 'html', 'markdown'],
        default: 'json',
        description: 'Output format'
      },
      includeMetrics: {
        type: 'boolean',
        default: true,
        description: 'Include analysis metrics in output'
      }
    }
  }

  private getAPIIntegrationConfig() {
    return {
      nodes: [
        {
          id: 'trigger-{{uuid}}',
          type: 'api-trigger',
          position: { x: 100, y: 100 },
          config: {
            method: '{{httpMethod}}',
            path: '{{apiPath}}',
            authentication: '{{authType}}'
          }
        },
        {
          id: 'transform-{{uuid}}',
          type: 'data-transform',
          position: { x: 300, y: 100 },
          config: {
            inputSchema: '{{inputSchema}}',
            outputSchema: '{{outputSchema}}',
            validation: '{{enableValidation}}'
          }
        },
        {
          id: 'external-{{uuid}}',
          type: 'external-api',
          position: { x: 500, y: 100 },
          config: {
            url: '{{externalApiUrl}}',
            method: '{{externalMethod}}',
            headers: '{{apiHeaders}}',
            timeout: '{{requestTimeout}}'
          }
        },
        {
          id: 'response-{{uuid}}',
          type: 'api-response',
          position: { x: 700, y: 100 },
          config: {
            statusCode: '{{responseStatus}}',
            format: '{{responseFormat}}',
            headers: '{{responseHeaders}}'
          }
        }
      ],
      connections: [
        {
          id: 'conn-{{uuid}}-1',
          source: 'trigger-{{uuid}}',
          target: 'transform-{{uuid}}',
          sourceHandle: 'request',
          targetHandle: 'input'
        },
        {
          id: 'conn-{{uuid}}-2',
          source: 'transform-{{uuid}}',
          target: 'external-{{uuid}}',
          sourceHandle: 'output',
          targetHandle: 'input'
        },
        {
          id: 'conn-{{uuid}}-3',
          source: 'external-{{uuid}}',
          target: 'response-{{uuid}}',
          sourceHandle: 'response',
          targetHandle: 'input'
        }
      ]
    }
  }

  private getAPIIntegrationParameters() {
    return {
      httpMethod: {
        type: 'select',
        options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        default: 'POST',
        description: 'HTTP method for the API endpoint'
      },
      apiPath: {
        type: 'string',
        default: '/webhook',
        description: 'API endpoint path'
      },
      authType: {
        type: 'select',
        options: ['none', 'api-key', 'bearer', 'basic', 'oauth2'],
        default: 'api-key',
        description: 'Authentication type'
      },
      inputSchema: {
        type: 'json',
        default: '{"type": "object", "properties": {"message": {"type": "string"}}}',
        description: 'JSON schema for input validation'
      },
      outputSchema: {
        type: 'json',
        default: '{"type": "object", "properties": {"result": {"type": "string"}}}',
        description: 'JSON schema for output transformation'
      },
      enableValidation: {
        type: 'boolean',
        default: true,
        description: 'Enable request/response validation'
      },
      externalApiUrl: {
        type: 'string',
        default: 'https://api.example.com/process',
        description: 'External API URL'
      },
      externalMethod: {
        type: 'select',
        options: ['GET', 'POST', 'PUT', 'DELETE'],
        default: 'POST',
        description: 'HTTP method for external API'
      },
      apiHeaders: {
        type: 'json',
        default: '{"Content-Type": "application/json", "Authorization": "Bearer {{token}}"}',
        description: 'HTTP headers for external API'
      },
      requestTimeout: {
        type: 'number',
        default: 30000,
        description: 'Request timeout in milliseconds'
      },
      responseStatus: {
        type: 'number',
        default: 200,
        description: 'HTTP status code for response'
      },
      responseFormat: {
        type: 'select',
        options: ['json', 'xml', 'text', 'binary'],
        default: 'json',
        description: 'Response format'
      },
      responseHeaders: {
        type: 'json',
        default: '{"Content-Type": "application/json"}',
        description: 'HTTP headers for response'
      }
    }
  }

  // Performance testing
  async createPerformanceTemplates(count: number): Promise<PipelineTemplate[]> {
    const batchSize = 50
    const templates: PipelineTemplate[] = []
    
    for (let i = 0; i < count; i += batchSize) {
      const currentBatchSize = Math.min(batchSize, count - i)
      const batch = this.buildMany(currentBatchSize)
      
      const createdTemplates = await this.config.prisma.pipelineTemplate.createMany({
        data: batch.map(template => ({
          ...template,
          id: undefined // Let Prisma generate IDs
        }))
      })
      
      // Fetch the created templates
      const fetchedTemplates = await this.config.prisma.pipelineTemplate.findMany({
        orderBy: { createdAt: 'desc' },
        take: currentBatchSize
      })
      
      templates.push(...fetchedTemplates)
    }
    
    return templates
  }

  // Utility methods
  generateTemplateStats(templates: PipelineTemplate[]): Record<string, any> {
    const stats = {
      total: templates.length,
      byCategory: templates.reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      public: templates.filter(t => t.isPublic).length,
      totalUsage: templates.reduce((sum, t) => sum + t.usageCount, 0),
      averageUsage: templates.reduce((sum, t) => sum + t.usageCount, 0) / templates.length,
      mostUsed: templates.sort((a, b) => b.usageCount - a.usageCount).slice(0, 5)
    }
    
    return stats
  }
}