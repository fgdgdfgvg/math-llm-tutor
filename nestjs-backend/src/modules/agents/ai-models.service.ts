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
  AIModelService,
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
    // DeepSeek 官方 API（api.deepseek.com）。model 名由环境变量覆盖，
    // 默认 deepseek-chat（官方通用对话），可改 deepseek-reasoner（推理）或
    // SiliconFlow 命名（deepseek-ai/DeepSeek-V3）以适配第三方网关。
    const deepSeekConfig: AIModelConfig = {
      provider: AIModelProvider.DEEPSEEK,
      apiKey:
        this.configService.get<string>('AI_DEEPSEEK_API_KEY') ||
        this.configService.get<string>('DEEPSEEK_API_KEY') ||
        '',
      baseUrl:
        this.configService.get<string>('AI_DEEPSEEK_BASE_URL') ||
        this.configService.get<string>('DEEPSEEK_BASE_URL') ||
        'https://api.deepseek.com/v1',
      model:
        this.configService.get<string>('AI_DEEPSEEK_MODEL') ||
        this.configService.get<string>('DEEPSEEK_MODEL') ||
        'deepseek-chat',
      timeout: 60000,
      maxRetries: 2,
    };
    this.modelConfigs.set(AIModelProvider.DEEPSEEK, deepSeekConfig);

    // GPT → SiliconFlow Qwen2.5-72B（实测可用，复杂问题分析）
    const gptConfig: AIModelConfig = {
      provider: AIModelProvider.GPT,
      apiKey:
        this.configService.get<string>('AI_GPT_API_KEY') ||
        this.configService.get<string>('GPT_API_KEY') ||
        '',
      baseUrl:
        this.configService.get<string>('AI_GPT_BASE_URL') ||
        this.configService.get<string>('GPT_BASE_URL') ||
        '',
      model: 'Qwen/Qwen2.5-72B-Instruct',
      timeout: 30000,
      maxRetries: 2,
    };
    this.modelConfigs.set(AIModelProvider.GPT, gptConfig);

    // KatCoder → SiliconFlow DeepSeek-V3（实测可用，最强数学推理）
    const katCoderConfig: AIModelConfig = {
      provider: AIModelProvider.KATCODER,
      apiKey:
        this.configService.get<string>('AI_KATCODER_API_KEY') ||
        this.configService.get<string>('KATCODER_API_KEY') ||
        '',
      baseUrl:
        this.configService.get<string>('AI_KATCODER_BASE_URL') ||
        this.configService.get<string>('KATCODER_BASE_URL') ||
        '',
      model: 'deepseek-ai/DeepSeek-V3',
      timeout: 30000,
      maxRetries: 2,
    };
    this.modelConfigs.set(AIModelProvider.KATCODER, katCoderConfig);

    // ModelScope → SiliconFlow Qwen2.5-7B（实测可用，快速规划）
    const modelScopeConfig: AIModelConfig = {
      provider: AIModelProvider.MODELSCOPE,
      apiKey:
        this.configService.get<string>('AI_MODELSCOPE_API_KEY') ||
        this.configService.get<string>('MODELSCOPE_API_KEY') ||
        '',
      baseUrl:
        this.configService.get<string>('AI_MODELSCOPE_BASE_URL') ||
        'https://api.siliconflow.cn/v1',
      model: 'Qwen/Qwen2.5-7B-Instruct',
      timeout: 60000,
      maxRetries: 3,
    };
    this.modelConfigs.set(AIModelProvider.MODELSCOPE, modelScopeConfig);

    // Qwen → 求解智能体。独立凭据：AI_QWEN_API_KEY / QWEN_API_KEY / HF_TOKEN（SiliconFlow 通用 token）。
    // 注意：不得借用 AI_DEEPSEEK_API_KEY——DeepSeek 官方 key 只能发往 api.deepseek.com，
    // 此处 baseUrl 默认 SiliconFlow，借用会把 DeepSeek 密钥泄露给第三方网关。
    const qwenConfig: AIModelConfig = {
      provider: AIModelProvider.QWEN,
      apiKey:
        this.configService.get<string>('AI_QWEN_API_KEY') ||
        this.configService.get<string>('QWEN_API_KEY') ||
        this.configService.get<string>('HF_TOKEN') ||
        '',
      baseUrl:
        this.configService.get<string>('AI_QWEN_BASE_URL') ||
        this.configService.get<string>('QWEN_BASE_URL') ||
        'https://api.siliconflow.cn/v1',
      model:
        this.configService.get<string>('AI_QWEN_MODEL') ||
        'Qwen/Qwen2.5-32B-Instruct',
      timeout: 45000,
      maxRetries: 3,
    };
    this.modelConfigs.set(AIModelProvider.QWEN, qwenConfig);

    // GLM → SiliconFlow GLM-4-9B（实测可用，超快速诊断+反馈）
    const glmConfig: AIModelConfig = {
      provider: AIModelProvider.GLM,
      apiKey:
        this.configService.get<string>('AI_GLM_API_KEY') ||
        this.configService.get<string>('GLM_API_KEY') ||
        '',
      baseUrl:
        this.configService.get<string>('AI_GLM_BASE_URL') ||
        'https://api.siliconflow.cn/v1',
      model: 'THUDM/GLM-4-9B-0414',
      timeout: 20000,
      maxRetries: 3,
    };
    this.modelConfigs.set(AIModelProvider.GLM, glmConfig);

    // 规划智能体专用槽位（历史命名为 HUGGINGFACE）。独立凭据：AI_HUGGINGFACE_API_KEY / HF_TOKEN。
    // 注意：槽位名是 HUGGINGFACE，但实际 baseUrl 走 SiliconFlow、默认模型是
    // deepseek-ai/DeepSeek-V3（规划任务的重推理模型），并非 HuggingFace 平台或模型。
    // 命名与模型错配属历史遗留，保留槽位名以保证向后兼容，语义以本注释为准。
    // 不得借用 AI_DEEPSEEK_API_KEY（同上，防 DeepSeek 官方 key 发往第三方）。
    const huggingFaceConfig: AIModelConfig = {
      provider: AIModelProvider.HUGGINGFACE,
      apiKey:
        this.configService.get<string>('AI_HUGGINGFACE_API_KEY') ||
        this.configService.get<string>('HUGGINGFACE_API_KEY') ||
        this.configService.get<string>('HF_TOKEN') ||
        '',
      baseUrl:
        this.configService.get<string>('AI_HUGGINGFACE_BASE_URL') ||
        this.configService.get<string>('HUGGINGFACE_BASE_URL') ||
        'https://api.siliconflow.cn/v1',
      model:
        this.configService.get<string>('AI_HUGGINGFACE_MODEL') ||
        'deepseek-ai/DeepSeek-V3',
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
    request: AIModelRequest,
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
          this.logger.log(
            `AI model ${provider} call success (attempt ${attempt})`,
          );
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
        const errorMessage =
          error.response?.data?.error?.message || error.message;

        this.logger.warn(
          `AI model ${provider} call failed (attempt ${attempt}/${config.maxRetries || 3}): ${errorMessage} (status: ${statusCode})`,
        );

        // 对于 429 限流错误，等待后重试
        if (statusCode === 429) {
          const delay = Math.pow(2, attempt) * 1000; // 指数退避
          this.logger.log(`Rate limited, waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else if (statusCode === 404 || statusCode === 401) {
          // 404 或 401 错误直接失败，不再重试
          break;
        } else {
          // 其他错误短暂延迟后重试
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    this.logger.error(
      `AI model ${provider} call failed after ${config.maxRetries || 3} attempts`,
      lastError,
    );
    throw new Error(
      `AI model ${provider} call failed: ${lastError?.message || 'Unknown error'}`,
    );
  }

  getModelConfig(provider: AIModelProvider): AIModelConfig | undefined {
    return this.modelConfigs.get(provider);
  }

  isModelAvailable(provider: AIModelProvider): boolean {
    const config = this.modelConfigs.get(provider);
    return !!(config && config.apiKey && config.baseUrl);
  }
}
