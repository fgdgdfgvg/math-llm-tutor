import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import {
  SpeechRecognitionResult,
  HandwritingRecognitionResult,
  ImageRecognitionResult,
  VoiceResponse,
} from './types';
import * as crypto from 'crypto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MultimodalService {
  private readonly logger = new Logger(MultimodalService.name);
  private simpleTexApiUrl: string;
  private simpleTexAppId: string;
  private simpleTexAppSecret: string;
  private hfToken: string;

  constructor(
    private configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.simpleTexApiUrl =
      this.configService.get<string>('SIMPLETEX_API_URL') ||
      'https://server.simpletex.cn/api/simpletex_ocr';
    this.simpleTexAppId =
      this.configService.get<string>('SIMPLETEX_APP_ID') || '';
    this.simpleTexAppSecret =
      this.configService.get<string>('SIMPLETEX_APP_SECRET') || '';
    this.hfToken = this.configService.get<string>('HF_TOKEN') || '';
  }

  private generateRandomStr(length = 16): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private generateSignature(
    params: Record<string, string>,
  ): Record<string, string> {
    const randomStr = this.generateRandomStr();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const appId = this.simpleTexAppId;

    const allParams: Record<string, string> = {
      ...params,
      'random-str': randomStr,
      timestamp: timestamp,
      'app-id': appId,
    };

    const sortedKeys = Object.keys(allParams).sort();
    let signStr = '';
    for (const key of sortedKeys) {
      if (signStr) signStr += '&';
      signStr += `${key}=${allParams[key]}`;
    }
    signStr += `&secret=${this.simpleTexAppSecret}`;

    const sign = crypto.createHash('md5').update(signStr).digest('hex');

    return {
      'app-id': appId,
      'random-str': randomStr,
      timestamp: timestamp,
      sign: sign,
    };
  }

  async recognizeSpeech(audioData: Buffer): Promise<SpeechRecognitionResult> {
    return {
      text: '求解x的平方等于4的解',
      confidence: 0.95,
      language: 'zh-CN',
    };
  }

  async recognizeHandwriting(
    imageData: Buffer,
  ): Promise<HandwritingRecognitionResult> {
    if (!this.simpleTexAppId || !this.simpleTexAppSecret) {
      return {
        text: '∫x²dx = x³/3 + C',
        latex: '\\int x^2 dx = \\frac{x^3}{3} + C',
        confidence: 0.92,
        boundingBox: { x: 10, y: 10, width: 200, height: 50 },
      };
    }

    try {
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([new Uint8Array(imageData)]),
        'image.png',
      );
      formData.append('rec_mode', 'formula');

      const headers = this.generateSignature({ rec_mode: 'formula' });

      const response = await fetch(this.simpleTexApiUrl, {
        method: 'POST',
        headers: headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`SimpleTex API error: ${response.status}`);
      }

      const data = (await response.json()) as any;

      if (!data.status) {
        throw new Error(data.res?.message || 'SimpleTex API failed');
      }

      return {
        text: data.res?.text || data.res?.result || '',
        latex: data.res?.latex || data.res?.formula || data.res?.markdown || '',
        confidence: data.res?.confidence || 0.9,
        boundingBox: { x: 0, y: 0, width: 100, height: 50 },
      };
    } catch (error) {
      this.logger.error(
        'SimpleTex handwriting recognition failed',
        error.message,
      );
      throw error;
    }
  }

  async recognizeImage(imageData: Buffer): Promise<ImageRecognitionResult> {
    if (!this.simpleTexAppId || !this.simpleTexAppSecret) {
      return {
        text: '求解方程 2x + 3 = 7',
        latex: '2x + 3 = 7',
        confidence: 0.95,
        boundingBox: { x: 5, y: 5, width: 250, height: 60 },
      };
    }

    try {
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([new Uint8Array(imageData)]),
        'image.png',
      );
      formData.append('rec_mode', 'auto');

      const headers = this.generateSignature({ rec_mode: 'auto' });

      const response = await fetch(this.simpleTexApiUrl, {
        method: 'POST',
        headers: headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`SimpleTex API error: ${response.status}`);
      }

      const data = (await response.json()) as any;

      if (!data.status) {
        throw new Error(data.res?.message || 'SimpleTex API failed');
      }

      return {
        text: data.res?.text || data.res?.result || '',
        latex: data.res?.latex || data.res?.formula || data.res?.markdown || '',
        confidence: data.res?.confidence || 0.9,
        boundingBox: { x: 0, y: 0, width: 100, height: 50 },
      };
    } catch (error) {
      this.logger.error('SimpleTex image recognition failed', error.message);
      throw error;
    }
  }

  async generateVoiceResponse(text: string): Promise<VoiceResponse> {
    return {
      text: text,
      audioUrl: 'https://example.com/audio/response.mp3',
      duration: 5,
    };
  }

  async processMultimodalInput(input: {
    type: 'speech' | 'handwriting' | 'text';
    data: Buffer | string;
  }): Promise<any> {
    switch (input.type) {
      case 'speech':
        return this.recognizeSpeech(input.data as Buffer);
      case 'handwriting':
        return this.recognizeHandwriting(input.data as Buffer);
      case 'text':
        return { text: input.data as string };
      default:
        throw new Error('Unsupported input type');
    }
  }

  async generateVisualExplanation(concept: string): Promise<string> {
    // 生成概念的可视化解释
    // 实际应用中应集成3D动画生成工具
    const visualizations: Record<string, string> = {
      vector_field:
        'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=vector%20field%20visualization%20of%20mathematical%20functions&image_size=landscape_16_9',
      differential_equation:
        'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=phase%20diagram%20of%20differential%20equations&image_size=landscape_16_9',
      matrix_transformation:
        'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=matrix%20transformation%20visualization&image_size=landscape_16_9',
      calculus:
        'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=calculus%20concept%20visualization&image_size=landscape_16_9',
    };

    return (
      visualizations[concept] ||
      'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=mathematical%20concept%20visualization&image_size=landscape_16_9'
    );
  }

  async generateImageFromText(
    prompt: string,
    model: string = 'runwayml/stable-diffusion-v1-5',
  ): Promise<Buffer> {
    if (!this.hfToken) {
      throw new Error(
        'Hugging Face token not configured. Please set HF_TOKEN in environment variables.',
      );
    }

    try {
      this.logger.log(
        `Generating image with model: ${model}, prompt: ${prompt}`,
      );

      // 使用Hugging Face Serverless Inference API
      const response = await firstValueFrom(
        this.httpService.post(
          `https://api-inference.huggingface.co/models/${model}`,
          { inputs: prompt },
          {
            headers: {
              Authorization: `Bearer ${this.hfToken}`,
              'Content-Type': 'application/json',
            },
            responseType: 'arraybuffer',
            timeout: 60000,
          },
        ),
      );

      // 将ArrayBuffer转换为Buffer
      return Buffer.from(response.data);
    } catch (error: any) {
      const statusCode = error.response?.status;
      const errorMessage = error.response?.data?.error || error.message;
      this.logger.error(
        `Hugging Face text-to-image generation failed: ${statusCode} - ${errorMessage}`,
      );
      throw new Error(`图像生成失败: ${errorMessage}`);
    }
  }
}
