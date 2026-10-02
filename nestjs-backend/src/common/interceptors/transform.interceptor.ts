import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  code: number;
  data: T;
  message: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const http = context.switchToHttp();
    return next.handle().pipe(
      map((data) => {
        // 与 HTTP 状态码保持一致。
        // 业务成功统一记 200（不区分 created/accepted 语义），但处理器**主动**设置了
        // 4xx/5xx 时必须透传：例如 /health/ready 未就绪会 set 503，
        // 若这里恒返回 code:200，按 body.code 判定的客户端会把"不就绪"读成成功。
        // 抛出的异常走 GlobalExceptionFilter，不经过这里，因此改动面仅限主动设状态码的处理器。
        const statusCode = http.getResponse<{ statusCode?: number }>()?.statusCode;
        const code =
          typeof statusCode === 'number' && statusCode >= 400 ? statusCode : 200;
        return {
          code,
          data: data ?? null,
          message: code === 200 ? 'success' : 'error',
        };
      }),
    );
  }
}
