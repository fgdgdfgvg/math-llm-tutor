// ai-models.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { 
  AIModelProvider, 
  AIModelConfig, 
  AIModelRequest, 
  AIModelResponse,
  AIModelService 
} from './ai-models.types';

@Injectable()
export class AIModelsService {
  private readonly logger = new Logger(AIModelsService.name);
  private readonly modelConfigs: Map<AIModelProvider, AIModelConfig>;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.modelConfigs = new Map();
    this.initializeModelConfigs();
  }

  private initializeModelConfigs(): void {
    // DeepSeek → SiliconFlow DeepSeek-V3（DeepSeek余额不足，走SiliconFlow）
    const deepSeekConfig: AIModelConfig = {
      provider: AIModelProvider.DEEPSEEK,
      apiKey: this.configService.get<string>('AI_DEEPSEEK_API_KEY') || this.configService.get<string>('DEEPSEEK_API_KEY') || '',
      baseUrl: this.configService.get<string>('AI_DEEPSEEK_BASE_URL') || this.configService.get<string>('DEEPSEEK_BASE_URL') || '',
      model: 'deepseek-ai/DeepSeek-V3',
      timeout: 30000,
      maxRetries: 2,
    };
    this.modelConfigs.set(AIModelProvider.DEEPSEEK, deepSeekConfig);

    // GPT → SiliconFlow Qwen2.5-72B（实测可用，复杂问题分析）
    const gptConfig: AIModelConfig = {
      provider: AIModelProvider.GPT,
      apiKey: this.configService.get<string>('AI_GPT_API_KEY') || this.configService.get<string>('GPT_API_KEY') || '',
      baseUrl: this.configService.get<string>('AI_GPT_BASE_URL') || this.configService.get<string>('GPT_BASE_URL') || '',
      model: 'Qwen/Qwen2.5-72B-Instruct',
      timeout: 30000,
      maxRetries: 2,
    };
    this.modelConfigs.set(AIModelProvider.GPT, gptConfig);

    // KatCoder → SiliconFlow DeepSeek-V3（实测可用，最强数学推理）
    const katCoderConfig: AIModelConfig = {
      provider: AIModelProvider.KATCODER,
      apiKey: this.configService.get<string>('AI_KATCODER_API_KEY') || this.configService.get<string>('KATCODER_API_KEY') || '',
      baseUrl: this.configService.get<string>('AI_KATCODER_BASE_URL') || this.configService.get<string>('KATCODER_BASE_URL') || '',
      model: 'deepseek-ai/DeepSeek-V3',
      timeout: 30000,
      maxRetries: 2,
    };
    this.modelConfigs.set(AIModelProvider.KATCODER, katCoderConfig);

    // ModelScope → SiliconFlow Qwen2.5-7B（实测可用，快速规划）
    const modelScopeConfig: AIModelConfig = {
      provider: AIModelProvider.MODELSCOPE,
      apiKey: this.configService.get<string>('AI_MODELSCOPE_API_KEY') || this.configService.get<string>('MODELSCOPE_API_KEY') || '',
      baseUrl: this.configService.get<string>('AI_MODELSCOPE_BASE_URL') || 'https://api.siliconflow.cn/v1',
      model: 'Qwen/Qwen2.5-7B-Instruct',
      timeout: 60000,
      maxRetries: 3,
    };
    this.modelConfigs.set(AIModelProvider.MODELSCOPE, modelScopeConfig);

    // Qwen → SiliconFlow Qwen2.5-32B（实测可用，求解智能体）
    const qwenConfig: AIModelConfig = {
      provider: AIModelProvider.QWEN,
      apiKey: this.configService.get<string>('HF_TOKEN') || this.configService.get<string>('AI_GPT_API_KEY') || '',
      baseUrl: 'https://api.siliconflow.cn/v1',
      model: 'Qwen/Qwen2.5-32B-Instruct',
      timeout: 45000,
      maxRetries: 3,
    };
    this.modelConfigs.set(AIModelProvider.QWEN, qwenConfig);

    // GLM → SiliconFlow GLM-4-9B（实测可用，超快速诊断+反馈）
    const glmConfig: AIModelConfig = {
      provider: AIModelProvider.GLM,
      apiKey: this.configService.get<string>('AI_GLM_API_KEY') || this.configService.get<string>('GLM_API_KEY') || '',
      baseUrl: this.configService.get<string>('AI_GLM_BASE_URL') || 'https://api.siliconflow.cn/v1',
      model: 'THUDM/GLM-4-9B-0414',
      timeout: 20000,
      maxRetries: 3,
    };
    this.modelConfigs.set(AIModelProvider.GLM, glmConfig);

    // HuggingFace → SiliconFlow DeepSeek-V3（实测可用，规划智能体备选）
    const huggingFaceConfig: AIModelConfig = {
      provider: AIModelProvider.HUGGINGFACE,
      apiKey: this.configService.get<string>('HF_TOKEN') || this.configService.get<string>('AI_GPT_API_KEY') || '',
      baseUrl: 'https://api.siliconflow.cn/v1',
      model: 'deepseek-ai/DeepSeek-V3',
      timeout: 60000,
      maxRetries: 3,
    };
    this.modelConfigs.set(AIModelProvider.HUGGINGFACE, huggingFaceConfig);

    // 验证配置
    this.validateConfigs();
  }

  private validateConfigs(): void {
    for (const [provider, config] of this.modelConfigs.entries()) {
      if (!config.apiKey || !config.baseUrl) {
        this.logger.warn(`AI model configuration incomplete for ${provider}`);
      }
    }
  }

  async chat(
    provider: AIModelProvider, 
    request: AIModelRequest
  ): Promise<AIModelResponse> {
    const config = this.modelConfigs.get(provider);
    if (!config) {
      throw new Error(`AI model provider ${provider} not configured`);
    }

    if (!config.apiKey || !config.baseUrl) {
      throw new Error(`AI model ${provider} configuration incomplete`);
    }

    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= (config.maxRetries || 3); attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.post(
            `${config.baseUrl}/chat/completions`,
            {
              model: config.model,
              messages: request.messages,
              temperature: request.temperature ?? 0.2,
              max_tokens: request.maxTokens,
            },
            {
              headers: {
                Authorization: `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
              },
              timeout: config.timeout,
            },
          ),
        );

        const content = response.data.choices?.[0]?.message?.content || '';
        if (content) {
          this.logger.log(`AI model ${provider} call success (attempt ${attempt})`);
          return {
            content,
            usage: response.data.usage,
            model: response.data.model,
          };
        } else {
          throw new Error('Empty response content');
        }
      } catch (error: any) {
        lastError = error;
        const statusCode = error.response?.status;
        const errorMessage = error.response?.data?.error?.message || error.message;
        
        this.logger.warn(`AI model ${provider} call failed (attempt ${attempt}/${config.maxRetries || 3}): ${errorMessage} (status: ${statusCode})`);
        
        // 对于 429 限流错误，等待后重试
        if (statusCode === 429) {
          const delay = Math.pow(2, attempt) * 1000; // 指数退避
          this.logger.log(`Rate limited, waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else if (statusCode === 404 || statusCode === 401) {
          // 404 或 401 错误直接失败，不再重试
          break;
        } else {
          // 其他错误短暂延迟后重试
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    this.logger.error(`AI model ${provider} call failed after ${config.maxRetries || 3} attempts`, lastError);
    throw new Error(`AI model ${provider} call failed: ${lastError?.message || 'Unknown error'}`);
  }

  getModelConfig(provider: AIModelProvider): AIModelConfig | undefined {
    return this.modelConfigs.get(provider);
  }

  isModelAvailable(provider: AIModelProvider): boolean {
    const config = this.modelConfigs.get(provider);
    return !!(config && config.apiKey && config.baseUrl);
  }
}