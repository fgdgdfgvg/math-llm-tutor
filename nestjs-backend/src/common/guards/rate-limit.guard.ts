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
    this.defaultWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
    this.defaultMaxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);
    this.llmWindowMs = parseInt(process.env.RATE_LIMIT_LLM_WINDOW_MS || '300000', 10);
    this.llmMaxRequests = parseInt(process.env.RATE_LIMIT_LLM_MAX_REQUESTS || '20', 10);

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

    const isLlmEndpoint = path.includes('/agents/') || path.includes('/solve') || path.includes('/ai-');
    const windowMs = isLlmEndpoint ? this.llmWindowMs : this.defaultWindowMs;
    const maxRequests = isLlmEndpoint ? this.llmMaxRequests : this.defaultMaxRequests;

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
      this.logger.warn(`Rate limit exceeded for ${clientIp} on ${isLlmEndpoint ? 'LLM' : 'default'} endpoints`);
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

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
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
