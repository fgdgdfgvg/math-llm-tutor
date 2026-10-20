import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { Request } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly store = new Map<string, RateLimitEntry>();
  /** 定时清理句柄；实现 OnModuleDestroy 后优雅停机时释放（旧实现永不释放） */
  private readonly cleanupTimer: NodeJS.Timeout;

  private readonly defaultWindowMs: number;
  private readonly defaultMaxRequests: number;
  private readonly llmWindowMs: number;
  private readonly llmMaxRequests: number;

  constructor() {
    this.defaultWindowMs = parseInt(
      process.env.RATE_LIMIT_WINDOW_MS || '60000',
      10,
    );
    this.defaultMaxRequests = parseInt(
      process.env.RATE_LIMIT_MAX_REQUESTS || '100',
      10,
    );
    this.llmWindowMs = parseInt(
      process.env.RATE_LIMIT_LLM_WINDOW_MS || '300000',
      10,
    );
    this.llmMaxRequests = parseInt(
      process.env.RATE_LIMIT_LLM_MAX_REQUESTS || '20',
      10,
    );

    this.cleanupTimer = setInterval(() => this.cleanup(), 60000);
    // 定时器不应阻止进程退出
    this.cleanupTimer.unref?.();
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path || '';

    const isLlmEndpoint =
      path.includes('/agents/') ||
      path.includes('/solve') ||
      path.includes('/ai-');
    const windowMs = isLlmEndpoint ? this.llmWindowMs : this.defaultWindowMs;
    const maxRequests = isLlmEndpoint
      ? this.llmMaxRequests
      : this.defaultMaxRequests;

    const clientIp = this.getClientIp(request);
    const key = `${clientIp}:${isLlmEndpoint ? 'llm' : 'default'}`;

    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      this.store.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    entry.count++;

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      this.logger.warn(
        `Rate limit exceeded for ${clientIp} on ${isLlmEndpoint ? 'LLM' : 'default'} endpoints`,
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `请求过于频繁，请在${retryAfter}秒后重试`,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  /**
   * 取客户端来源地址用于限流分桶。
   *
   * **必须用 `request.ip`，绝不能直接读 `x-forwarded-for` 头。**
   * 该头是客户端可任意伪造的，直接采信等于让攻击者每次换一个假 IP 就能拿到
   * 全新的配额桶。实测：固定伪造值时第 21 次触发 429，但每次换一个伪造值时
   * 连打 40 次全部放行（0 次 429），LLM 成本防护完全失效。
   *
   * Express 的 `req.ip` 会依据 `app.set('trust proxy', ...)` 决定是否采信该头
   * （见 main.ts 的 TRUST_PROXY 配置）：默认不信任，取 socket 地址——这是安全默认；
   * 部署在 nginx/网关之后时再由运维显式开启，否则全部请求会被算成网关同一个来源。
   */
  private getClientIp(request: Request): string {
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
}
