import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FormulaRendererService } from './formula-renderer.service';
import { Public } from '../../core/auth/guards/global-auth.guard';

@ApiTags('formula-renderer')
@Controller('formula-renderer')
export class FormulaRendererController {
  constructor(
    private readonly formulaRendererService: FormulaRendererService,
  ) {}

  @Public()
  @Post('render')
  @ApiOperation({
    summary: '渲染单个公式',
    description: '将LaTeX公式转换为图片',
  })
  @ApiResponse({ status: 200, description: '渲染成功，返回图片URL' })
  @ApiResponse({ status: 400, description: '公式格式错误或渲染失败' })
  async renderFormula(
    @Body()
    body: {
      formula?: string;
      latex?: string;
      options?: {
        width?: number;
        height?: number;
        color?: string;
        background?: string;
      };
    },
  ) {
    const formula = body.formula || body.latex;
    if (!formula || typeof formula !== 'string' || !formula.trim()) {
      throw new BadRequestException('缺少公式参数 formula 或 latex');
    }
    const imageUrl = await this.formulaRendererService.renderFormulaToImage(
      formula.trim(),
      body.options,
    );
    return { imageUrl };
  }

  @Public()
  @Post('batch-render')
  @ApiOperation({
    summary: '批量渲染公式',
    description: '将多个LaTeX公式转换为图片',
  })
  @ApiResponse({ status: 200, description: '渲染成功，返回图片URL数组' })
  @ApiResponse({ status: 400, description: '公式格式错误或渲染失败' })
  async batchRenderFormulas(
    @Body()
    body: {
      formulas?: string[];
      latex?: string[];
      options?: {
        width?: number;
        height?: number;
        color?: string;
        background?: string;
      };
    },
  ) {
    const formulas = body.formulas || body.latex;
    if (
      !Array.isArray(formulas) ||
      formulas.length === 0 ||
      formulas.some((formula) => typeof formula !== 'string' || !formula.trim())
    ) {
      throw new BadRequestException('缺少公式数组 formulas 或 latex');
    }
    const imageUrls = await this.formulaRendererService.batchRenderFormulas(
      formulas.map((formula) => formula.trim()),
      body.options,
    );
    return { imageUrls };
  }

  @Public()
  @Get('check-complex')
  @ApiOperation({
    summary: '检查公式复杂度',
    description: '检查LaTeX公式是否为复杂公式',
  })
  @ApiResponse({ status: 200, description: '检查成功，返回是否为复杂公式' })
  async checkComplexFormula(@Query('formula') formula: string) {
    if (!formula || typeof formula !== 'string') {
      throw new BadRequestException('缺少参数 formula');
    }
    const isComplex = this.formulaRendererService.isComplexFormula(formula);
    return { isComplex };
  }
}
