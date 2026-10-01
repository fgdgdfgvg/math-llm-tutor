import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { getTraceId, newTraceId, runWithRequestContext } from '../utils/request-context';

/**
 * 为每个请求分配/透传 traceId。
 *
 * - 上游（网关/Nginx）传了 `X-Request-Id` 就沿用，保证跨服务链路可对齐；
 * - 否则生成一个新的，并写回响应头，便于用户报障时直接提供。
 *
 * 注意这里必须手动包一层 Observable：如果写成
 * `runWithRequestContext(ctx, () => next.handle())`，
 * 订阅发生在 run() 之外，AsyncLocalStorage 的上下文就丢了，
 * 后续服务层 `getTraceId()` 会拿到 undefined。
 */
@Injectable()
export class TraceIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest?.();
    const res = http.getResponse?.();

    const incoming: string | undefined =
      req?.headers?.['x-request-id'] || req?.headers?.['x-correlation-id'];
    const traceId = typeof incoming === 'string' && incoming.trim() ? incoming.trim() : newTraceId();

    if (req) req.traceId = traceId;
    if (res?.setHeader) res.setHeader('X-Request-Id', traceId);

    return new Observable((subscriber) => {
      runWithRequestContext({ traceId, path: req?.originalUrl || req?.url }, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}

export { getTraceId };
