// ai-models.types.ts
export enum AIModelProvider {
  DEEPSEEK = 'deepseek',
  GPT = 'gpt',
  KATCODER = 'katcoder',
  MODELSCOPE = 'modelscope',
  QWEN = 'qwen',
  GLM = 'glm',
  HUGGINGFACE = 'huggingface',
}

export interface AIModelConfig {
  provider: AIModelProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  timeout?: number;
  maxRetries?: number;
}

export interface AIModelRequest {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

export interface AIModelResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

export interface AIModelService {
  chat(request: AIModelRequest): Promise<AIModelResponse>;
  getModelInfo(): { provider: string; model: string };
}