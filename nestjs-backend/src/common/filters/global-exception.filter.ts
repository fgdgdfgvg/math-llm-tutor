import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError, InternalError, isAppError } from '../errors/app-error';
import { ErrorCode, ERROR_DEFAULT_MESSAGE, ERROR_HTTP_STATUS } from '../errors/error-codes';
import { redactSecrets } from '../utils/redact';
import { getTraceId } from '../utils/request-context';

export interface ErrorResponseBody {
  /** 稳定错误码，供前端做策略映射（重试/降级/提示） */
  code: ErrorCode;
  /** 与 HTTP 状态一致，兼容前端既有的 statusCode 判断 */
  statusCode: number;
  /** 可直接展示给用户的中文文案 */
  message: string;
  traceId: string;
  timestamp: string;
  path?: string;
  /** 仅非生产环境返回，便于联调；生产环境绝不回传堆栈与内部细节 */
  details?: unknown;
  stack?: string;
}

/**
 * 全局异常过滤器。
 *
 * 解决三个具体问题：
 * 1. 此前只有 `interactive-learning` 模块有自己的过滤器，其余模块抛出的异常
 *    以 Nest 默认格式 `{statusCode, message, error}` 返回，与成功响应
 *    的 `{code, data, message}` 信封不一致，前端要写两套解析；
 * 2. `throw new Error(...)` 直接冒泡时，message 里常常带着内部细节
 *    （SQL/Mongo 报错、上游地址、堆栈片段）原样回给客户端；
 * 3. 没有任何 traceId，线上报障无法定位。
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { traceId?: string }>();
    const res = ctx.getResponse<Response>();

    const traceId = getTraceId() ?? req?.traceId ?? 'unknown';
    const path = req?.originalUrl || req?.url;
    const isProduction = process.env.NODE_ENV === 'production';

    const appError = this.normalize(exception);

    const body = this.buildBody(appError, traceId, path, isProduction, exception);
    this.log(appError, traceId, path, exception);

    if (res && typeof res.status === 'function') {
      res.status(body.statusCode).json(body);
      return;
    }
    // 非 HTTP 上下文（如 WebSocket / RPC）：交给上层默认处理
    throw exception;
  }

  /** 把各类异常统一收敛成 AppError */
  private normalize(exception: unknown): AppError {
    if (isAppError(exception)) return exception;

    // Nest 内置异常（含 ValidationPipe 抛出的 BadRequestException）
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse() as string | { message?: unknown; error?: string };
      const rawMessage =
        typeof response === 'string' ? response : (response?.message ?? response?.error);
      return new AppError(this.mapHttpStatus(status), this.flattenMessage(rawMessage), {
        httpStatus: status,
        expose: status < 500, // 5xx 的内部描述不外传
      });
    }

    const anyError = exception as any;

    // Mongoose：唯一键冲突 / 类型强转失败 / schema 校验失败
    if (anyError?.code === 11000) {
      return new AppError(ErrorCode.CONFLICT, '数据已存在（唯一约束冲突）');
    }
    if (anyError?.name === 'CastError') {
      return new AppError(ErrorCode.VALIDATION_ERROR, '参数类型不正确');
    }
    if (anyError?.name === 'ValidationError' && anyError?.errors) {
      return new AppError(
        ErrorCode.VALIDATION_ERROR,
        Object.values<any>(anyError.errors)
          .map((e) => e?.message)
          .filter(Boolean)
          .join('; ') || ERROR_DEFAULT_MESSAGE[ErrorCode.VALIDATION_ERROR],
      );
    }

    // axios：外部服务异常/超时，原始信息不暴露给学生
    if (anyError?.isAxiosError) {
      const status: number | undefined = anyError.response?.status;
      if (anyError.code === 'ECONNABORTED' || anyError.code === 'ETIMEDOUT' || status === 504) {
        return new AppError(ErrorCode.UPSTREAM_TIMEOUT, undefined, { expose: false });
      }
      return new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, undefined, {
        httpStatus: status && status >= 400 && status < 500 ? status : HttpStatus.BAD_GATEWAY,
        expose: false,
      });
    }

    return new InternalError(anyError?.message, exception);
  }

  private mapHttpStatus(status: number): ErrorCode {
    switch (status) {
      case 400:
        return ErrorCode.VALIDATION_ERROR;
      case 401:
        return ErrorCode.UNAUTHORIZED;
      case 403:
        return ErrorCode.FORBIDDEN;
      case 404:
        return ErrorCode.NOT_FOUND;
      case 409:
        return ErrorCode.CONFLICT;
      case 413:
        return ErrorCode.PAYLOAD_TOO_LARGE;
      case 429:
        return ErrorCode.RATE_LIMITED;
      case 504:
        return ErrorCode.UPSTREAM_TIMEOUT;
      default:
        return status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.BUSINESS_ERROR;
    }
  }

  /** ValidationPipe 的 message 是字符串数组，压平后前端才能直接 toast */
  private flattenMessage(raw: unknown): string | undefined {
    if (Array.isArray(raw)) {
      return raw.map((m) => String(m)).join('; ');
    }
    if (typeof raw === 'string') return raw;
    return undefined;
  }

  private buildBody(
    error: AppError,
    traceId: string,
    path: string | undefined,
    isProduction: boolean,
    original: unknown,
  ): ErrorResponseBody {
    const body: ErrorResponseBody = {
      code: error.code,
      statusCode: error.httpStatus ?? ERROR_HTTP_STATUS[error.code],
      message: error.clientMessage(),
      traceId,
      timestamp: new Date().toISOString(),
      path,
    };
    if (!isProduction) {
      body.details = redactSecrets(error.details);
      if (original instanceof Error) body.stack = original.stack;
    }
    return body;
  }

  private log(error: AppError, traceId: string, path: string | undefined, original: unknown): void {
    const payload = {
      traceId,
      path,
      code: error.code,
      status: error.httpStatus,
      message: redactSecrets(error.message),
      details: redactSecrets(error.details),
    };
    const stack = original instanceof Error ? original.stack : undefined;

    // 5xx 才打 error 级别并附堆栈；4xx 是客户端问题，warn 即可，避免日志噪音
    if ((error.httpStatus ?? 500) >= 500) {
      this.logger.error(JSON.stringify(payload), stack);
    } else {
      this.logger.warn(JSON.stringify(payload));
    }
  }
}
