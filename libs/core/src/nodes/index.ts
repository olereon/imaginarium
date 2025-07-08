export interface NodeDefinition {
  type: string;
  name: string;
  description: string;
  category: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  config: ConfigDefinition[];
}

export interface PortDefinition {
  id: string;
  name: string;
  type: string;
  required?: boolean;
}

export interface ConfigDefinition {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'file';
  required?: boolean;
  default?: unknown;
  options?: Array<{ label: string; value: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export abstract class BaseNode {
  constructor(
    public readonly id: string,
    public readonly type: string,
    public readonly config: Record<string, unknown>
  ) {}

  abstract execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>>;

  abstract validate(): { valid: boolean; errors: string[] };
}

export class TextInputNode extends BaseNode {
  async execute(_inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    return {
      text: this.config['text'] ?? '',
    };
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!this.config['text']) {
      errors.push('Text input is required');
    }
    return { valid: errors.length === 0, errors };
  }
}

export class ImageGeneratorNode extends BaseNode {
  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Mock implementation
    const prompt = (inputs['prompt'] as string) ?? '';
    return {
      image: `generated-image-for-${prompt}`,
    };
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!this.config['model']) {
      errors.push('Model selection is required');
    }
    return { valid: errors.length === 0, errors };
  }
}

export class NodeRegistry {
  private nodes = new Map<string, typeof BaseNode>();
  private definitions = new Map<string, NodeDefinition>();

  register(definition: NodeDefinition, nodeClass: typeof BaseNode): void {
    this.nodes.set(definition.type, nodeClass);
    this.definitions.set(definition.type, definition);
  }

  getDefinition(type: string): NodeDefinition | undefined {
    return this.definitions.get(type);
  }

  createNode(type: string, id: string, config: Record<string, unknown>): BaseNode | null {
    const NodeClass = this.nodes.get(type);
    if (!NodeClass) return null;

    // We need to cast here because TypeScript doesn't know these are concrete classes
    return new (NodeClass as any)(id, type, config) as BaseNode;
  }

  getAllDefinitions(): NodeDefinition[] {
    return Array.from(this.definitions.values());
  }
}
