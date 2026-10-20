import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { describeErrorForLog } from '../../common/utils/redact';

@Injectable()
export class FormulaRendererService {
  private readonly logger = new Logger(FormulaRendererService.name);
  private readonly selfHostedServiceUrl =
    process.env.FORMULA_RENDERER_URL || '';
  private readonly codecogsUrl = 'https://latex.codecogs.com/png.latex';
  private readonly mathpixUrl = 'https://api.mathpix.com/v3/latex'; // 商业API选项

  constructor(private readonly httpService: HttpService) {}

  /**
   * 预处理LaTeX公式，确保函数名称正确渲染为斜体
   * @param formula LaTeX公式
   * @returns 处理后的LaTeX公式
   */
  private preprocessFormula(formula: string): string {
    // 定义需要渲染为斜体的函数名称
    const functions = [
      'sum',
      'cos',
      'sin',
      'tan',
      'cot',
      'sec',
      'csc',
      'log',
      'ln',
      'exp',
      'sqrt',
      'abs',
      'max',
      'min',
      'lim',
      'liminf',
      'limsup',
      'sup',
      'inf',
      'arg',
      'det',
      'tr',
      'rank',
      'dim',
      'gcd',
      'lcm',
    ];

    // 正则表达式匹配函数名称，确保它们被正确的LaTeX命令包裹
    let processedFormula = formula;
    functions.forEach((func) => {
      // 匹配函数名称，确保它不是其他单词的一部分，并且后面可以跟着括号或其他符号
      const regex = new RegExp(
        `(^|\\s|\\(|\\[|\\{|\\+|\\-|\\*|\\/|=|,|;|:|\\()${func}(?=\\s|\\(|\\[|\\{|\\)|\\]|\\}|\\+|\\-|\\*|\\/|=|,|;|:|$)`,
        'g',
      );
      processedFormula = processedFormula.replace(regex, `$1\\${func}`);
    });

    return processedFormula;
  }

  /**
   * 将LaTeX公式转换为图片
   * @param formula LaTeX公式
   * @param options 渲染选项
   * @returns 图片URL
   */
  async renderFormulaToImage(
    formula: string,
    options: {
      width?: number;
      height?: number;
      color?: string;
      background?: string;
    } = {},
  ): Promise<string> {
    try {
      // 预处理公式，确保函数名称正确渲染
      const processedFormula = this.preprocessFormula(formula);

      // 先尝试使用自托管服务（仅在显式配置时启用）
      if (this.selfHostedServiceUrl) {
        try {
          const result = await this.renderWithSelfHostedService(
            processedFormula,
            options,
          );
          this.logger.log('使用自托管服务渲染公式成功');
          return result;
        } catch (selfHostedError) {
          this.logger.warn(
            '自托管服务渲染失败，切换到CodeCogs API',
            selfHostedError.message,
          );
        }
      }

      // CodeCogs 是客户端加载的公开 SVG/PNG 地址，不在后端预先 HEAD。
      // 这样即使运行环境禁止出网，也不会把一个可用的公式地址误判成 400。
      return this.renderWithCodecogs(processedFormula, options);
    } catch (error) {
      this.logger.error('公式渲染失败:', describeErrorForLog(error));
      throw new BadRequestException('公式渲染失败，请检查公式格式');
    }
  }

  /**
   * 使用自托管服务渲染公式
   */
  private async renderWithSelfHostedService(
    formula: string,
    options: {
      width?: number;
      height?: number;
      color?: string;
      background?: string;
    },
  ): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          this.selfHostedServiceUrl,
          {
            formula,
            options,
          },
          {
            timeout: 2000, // 自托管服务响应时间控制在200ms以内
          },
        ),
      );

      if (response.status === 200 && response.data.imageUrl) {
        return response.data.imageUrl;
      } else {
        throw new Error('自托管服务返回无效响应');
      }
    } catch (error) {
      throw new Error('自托管服务渲染失败');
    }
  }

  /**
   * 使用CodeCogs API渲染公式
   */
  private async renderWithCodecogs(
    formula: string,
    options: {
      width?: number;
      height?: number;
      color?: string;
      background?: string;
    },
  ): Promise<string> {
    const encodedFormula = encodeURIComponent(formula);
    const color = options.color || '000000'; // 黑色
    const background = options.background || 'ffffff'; // 白色

    // 构建API URL，添加更多参数以支持长公式
    // 使用\displaystyle确保公式正确显示
    // 使用\nowrap防止公式自动换行
    // 使用较大的dpi以提高清晰度
    const params =
      '\\dpi{180}\\bg{' +
      background +
      '}\\color{' +
      color +
      '}\\displaystyle\\nowrap';
    const apiUrl = this.codecogsUrl + '?' + params + encodedFormula;

    return apiUrl;
  }

  /**
   * 批量渲染多个公式
   * @param formulas LaTeX公式数组
   * @param options 渲染选项
   * @returns 图片URL数组
   */
  async batchRenderFormulas(
    formulas: string[],
    options: {
      width?: number;
      height?: number;
      color?: string;
      background?: string;
    } = {},
  ): Promise<string[]> {
    const promises = formulas.map((formula) =>
      this.renderFormulaToImage(formula, options),
    );

    return Promise.all(promises);
  }

  /**
   * 检查公式是否为复杂公式
   * @param formula LaTeX公式
   * @returns 是否为复杂公式
   */
  isComplexFormula(formula: string): boolean {
    // 参数缺失时不能直接 .includes（会抛 TypeError 变成 500）
    if (!formula || typeof formula !== 'string') {
      return false;
    }

    const complexPatterns = [
      '\\begin{matrix}',
      '\\begin{bmatrix}',
      '\\begin{align}',
      '\\begin{aligned}',
      '\\begin{gather}',
      '\\begin{cases}',
      '\\begin{array}',
      '\\begin{tabular}',
      '\\begin{tikzpicture}',
    ];

    return complexPatterns.some((pattern) => formula.includes(pattern));
  }
}
