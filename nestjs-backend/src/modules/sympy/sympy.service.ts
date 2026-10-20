import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import {
  SYMPY_HTTP_TIMEOUT_MS,
  sympyRequestHeaders,
} from '../../common/utils/sympy-client.util';

export interface SympyResponse {
  success: boolean;
  result?: string;
  latex?: string;
  steps?: string[];
  error?: string;
  /** 结构化错误码：PARSE_ERROR / UNEVALUATED / LIMIT_DOES_NOT_EXIST / TIMEOUT / INTERNAL_ERROR */
  error_code?: string;
}

export interface ExpressionRequest {
  expr: string;
  variables?: string[];
}

export interface DerivativeRequest {
  expr: string;
  variable: string;
  order?: number;
}

export interface IntegralRequest {
  expr: string;
  variable: string;
  lower?: string;
  upper?: string;
}

export interface LimitRequest {
  expr: string;
  variable: string;
  approach: string;
  direction?: string;
}

export interface EquationRequest {
  equation: string;
  variable: string;
}

@Injectable()
export class SympyService {
  private readonly logger = new Logger(SympyService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private async post<T>(endpoint: string, data: any): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<T>(endpoint, data, {
          headers: sympyRequestHeaders(this.configService),
          timeout: SYMPY_HTTP_TIMEOUT_MS,
        }),
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<SympyResponse>;
      const body = axiosError.response?.data;
      const code =
        body?.error_code ||
        (axiosError.response?.status
          ? `HTTP_${axiosError.response.status}`
          : 'NETWORK');
      // 只记录错误码与 message：axios 错误对象整体序列化会把 Authorization 头写进日志。
      this.logger.error(
        `SymPy service error [${code}]: ${body?.error || axiosError.message}`,
      );
      if (code === 'PARSE_ERROR') {
        throw new BadRequestException(body?.error || '表达式无法解析');
      }
      throw new ServiceUnavailableException(
        body?.error || `符号计算服务不可用: ${axiosError.message}`,
      );
    }
  }

  async simplify(expr: string): Promise<SympyResponse> {
    this.logger.log(`Simplifying expression: ${expr}`);
    return this.post<SympyResponse>('/simplify', { expr });
  }

  async expand(expr: string): Promise<SympyResponse> {
    this.logger.log(`Expanding expression: ${expr}`);
    return this.post<SympyResponse>('/expand', { expr });
  }

  async factor(expr: string): Promise<SympyResponse> {
    this.logger.log(`Factoring expression: ${expr}`);
    return this.post<SympyResponse>('/factor', { expr });
  }

  async derivative(
    expr: string,
    variable: string,
    order: number = 1,
  ): Promise<SympyResponse> {
    this.logger.log(`Computing derivative: d${order}/${variable} of ${expr}`);
    return this.post<SympyResponse>('/derivative', { expr, variable, order });
  }

  async integral(
    expr: string,
    variable: string,
    lower?: string,
    upper?: string,
  ): Promise<SympyResponse> {
    const isDefinite = lower !== undefined && upper !== undefined;
    this.logger.log(
      `Computing ${isDefinite ? 'definite' : 'indefinite'} integral of ${expr}`,
    );
    return this.post<SympyResponse>('/integral', {
      expr,
      variable,
      lower,
      upper,
    });
  }

  /**
   * 求极限。
   * 默认 direction='+-'（**双侧**）：旧的默认单侧会让 lim(x→0) 1/x 返回 +∞，
   * 而正确答案是“不存在”。只有题面明确写了左/右极限时才传单侧。
   */
  async limit(
    expr: string,
    variable: string,
    approach: string,
    direction: string = '+-',
  ): Promise<SympyResponse> {
    this.logger.log(
      `Computing limit: ${expr} as ${variable} -> ${approach} (${direction})`,
    );
    return this.post<SympyResponse>('/limit', {
      expr,
      variable,
      approach,
      direction,
    });
  }

  async solveEquation(
    equation: string,
    variable: string,
  ): Promise<SympyResponse> {
    this.logger.log(`Solving equation: ${equation} for ${variable}`);
    return this.post<SympyResponse>('/solve', { equation, variable });
  }

  async series(
    expr: string,
    variable: string,
    point: string = '0',
    n: number = 6,
  ): Promise<SympyResponse> {
    this.logger.log(`Computing series expansion of ${expr}`);
    return this.post<SympyResponse>('/series', { expr, variable, point, n });
  }

  async calculate(expr: string): Promise<SympyResponse> {
    this.logger.log(`Calculating expression: ${expr}`);
    return this.post<SympyResponse>('/calculate', { expr });
  }

  async evaluate(expr: string, variables?: string[]): Promise<SympyResponse> {
    this.logger.log(
      `Evaluating expression: ${expr} with variables: ${variables}`,
    );
    return this.post<SympyResponse>('/evaluate', { expr, variables });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await firstValueFrom(this.httpService.get('/'));
      return response.data?.status === 'running';
    } catch {
      return false;
    }
  }
}
