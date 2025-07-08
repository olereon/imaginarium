export interface APIProvider {
  id: string;
  name: string;
  type: string;
  generateImage?(params: ImageGenerationParams): Promise<ImageGenerationResult>;
  generateText?(params: TextGenerationParams): Promise<TextGenerationResult>;
  validateCredentials(): Promise<boolean>;
}

export interface ImageGenerationParams {
  prompt: string;
  model?: string;
  size?: string;
  quality?: string;
  style?: string;
  n?: number;
}

export interface ImageGenerationResult {
  images: Array<{
    url: string;
    metadata?: Record<string, unknown>;
  }>;
  cost?: number;
  duration?: number;
}

export interface TextGenerationParams {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface TextGenerationResult {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;
}

export abstract class BaseProvider implements APIProvider {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly type: string,
    protected credentials: Record<string, string>
  ) {}

  abstract validateCredentials(): Promise<boolean>;
}

export class ProviderRegistry {
  private providers = new Map<string, APIProvider>();

  register(provider: APIProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): APIProvider | undefined {
    return this.providers.get(id);
  }

  getAll(): APIProvider[] {
    return Array.from(this.providers.values());
  }

  getByType(type: string): APIProvider[] {
    return this.getAll().filter(p => p.type === type);
  }
}