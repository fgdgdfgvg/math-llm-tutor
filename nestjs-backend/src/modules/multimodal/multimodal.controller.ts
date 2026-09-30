import { Controller, Post, Get, Body, UploadedFile, UseInterceptors, UseGuards, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MultimodalService } from './multimodal.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { Public } from '../../core/auth/guards/global-auth.guard';

@Controller('multimodal')
export class MultimodalController {
  constructor(private readonly multimodalService: MultimodalService) {}

  @Public()
  @Post('speech/recognize')
  @UseInterceptors(FileInterceptor('audio'))
  async recognizeSpeech(@UploadedFile() file: any) {
    if (!file?.buffer) {
      throw new BadRequestException('未接收到音频文件（字段名应为 audio）');
    }
    return this.multimodalService.recognizeSpeech(file.buffer);
  }

  @Public()
  @Post('handwriting/recognize')
  @UseInterceptors(FileInterceptor('image'))
  async recognizeHandwriting(@UploadedFile() file: any) {
    if (!file?.buffer) {
      throw new BadRequestException('未接收到图片文件（字段名应为 image）');
    }
    return this.multimodalService.recognizeHandwriting(file.buffer);
  }

  @Public()
  @Post('image')
  @UseInterceptors(FileInterceptor('image'))
  async recognizeImage(@UploadedFile() file: any) {
    if (!file?.buffer) {
      throw new BadRequestException('未接收到图片文件（字段名应为 image）');
    }
    return this.multimodalService.recognizeImage(file.buffer);
  }

  @Public()
  @Post('voice/generate')
  async generateVoiceResponse(@Body('text') text: string) {
    return this.multimodalService.generateVoiceResponse(text);
  }

  @Public()
  @Post('process')
  async processMultimodalInput(@Body() input: {
    type: 'speech' | 'handwriting' | 'text';
    data: string;
  }) {
    let processedData: Buffer | string;
    
    if (input.type === 'speech' || input.type === 'handwriting') {
      processedData = Buffer.from(input.data, 'base64');
    } else {
      processedData = input.data;
    }
    
    return this.multimodalService.processMultimodalInput({
      type: input.type,
      data: processedData
    });
  }

  @Public()
  @Get('visual/explanation')
  async generateVisualExplanation(@Body('concept') concept: string) {
    return this.multimodalService.generateVisualExplanation(concept);
  }

  @Public()
  @Post('image/generate')
  async generateImage(@Body('prompt') prompt: string, @Body('model') model: string = 'stabilityai/stable-diffusion-xl-base-1.0') {
    const imageBuffer = await this.multimodalService.generateImageFromText(prompt, model);
    return {
      image: imageBuffer.toString('base64'),
      prompt: prompt,
      model: model
    };
  }
}
