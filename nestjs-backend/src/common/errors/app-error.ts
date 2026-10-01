import { HttpStatus } from '@nestjs/common';
import { ERROR_DEFAULT_MESSAGE, ERROR_HTTP_STATUS, ErrorCode } from './error-codes';

/**
 * 类型化错误体系。
 *
 * 约定：
 * - 业务代码只抛 AppError 及其子类，**不要**再直接 `throw new Error('中文串')`；
 * - `expose = true` 表示 message 可以原样回给客户端（面向用户的业务提示）；
 *   `expose = false` 表示这是内部细节，响应里只给兜底文案，真实信息只进日志。
 *   这条区分是"生产环境绝不回传堆栈/内部细节"的落地点。
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly expose: boolean;
  /** 结构化附加信息（仅开发/测试环境回传），不要放敏感数据 */
  public readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message?: string,
    options: { httpStatus?: number; expose?: boolean; details?: unknown; cause?: unknown } = {},
  ) {
    super(message || ERROR_DEFAULT_MESSAGE[code]);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = options.httpStatus ?? ERROR_HTTP_STATUS[code];
    this.expose = options.expose ?? true;
    this.details = options.details;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
    // 继承内置类时修正原型链，否则 instanceof 在 ES5 编译目标下会失效
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** 面向客户端的 message：不暴露的内部错误统一换成兜底文案 */
  public clientMessage(): string {
    return this.expose ? this.message : ERROR_DEFAULT_MESSAGE[this.code];
  }
}

/** 业务规则拒绝（默认 422，message 可直出） */
export class BusinessError extends AppError {
  constructor(message?: string, details?: unknown) {
    super(ErrorCode.BUSINESS_ERROR, message, { details });
  }
}

/** 参数校验失败（默认 400） */
export class ValidationAppError extends AppError {
  constructor(message?: string, details?: unknown) {
    super(ErrorCode.VALIDATION_ERROR, message, { details });
  }
}

export class NotFoundAppError extends AppError {
  constructor(message?: string) {
    super(ErrorCode.NOT_FOUND, message);
  }
}

export class ConflictAppError extends AppError {
  constructor(message?: string) {
    super(ErrorCode.CONFLICT, message);
  }
}

export class UnauthorizedAppError extends AppError {
  constructor(message?: string) {
    super(ErrorCode.UNAUTHORIZED, message);
  }
}

export class ForbiddenAppError extends AppError {
  constructor(message?: string) {
    super(ErrorCode.FORBIDDEN, message);
  }
}

export class RateLimitedAppError extends AppError {
  constructor(message?: string) {
    super(ErrorCode.RATE_LIMITED, message);
  }
}

/**
 * 外部依赖异常（SymPy / LLM / Neo4j / Redis）。
 * 默认 `expose = false`：上游的原始报错（内部地址、模型名、堆栈片段）
 * 不该出现在给学生的响应里，只进日志。
 */
export class ExternalServiceError extends AppError {
  constructor(
    public readonly service: string,
    message?: string,
    options: { code?: ErrorCode; details?: unknown } = {},
  ) {
    super(options.code ?? ErrorCode.EXTERNAL_SERVICE_ERROR, message, {
      expose: false,
      details: options.details,
    });
  }
}

/** 上游超时：与 EXTERNAL_SERVICE_ERROR 分开，便于调用方直接走降级而不是重试 */
export class UpstreamTimeoutError extends ExternalServiceError {
  constructor(service: string, message?: string) {
    super(service, message, { code: ErrorCode.UPSTREAM_TIMEOUT });
  }
}

/** 未预期错误：一律不暴露细节 */
export class InternalError extends AppError {
  constructor(message?: string, cause?: unknown) {
    super(ErrorCode.INTERNAL_ERROR, message, { expose: false, cause });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** 从未知异常恢复成 AppError，供全局过滤器兜底 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  return new InternalError(error instanceof Error ? error.message : String(error), error);
}

export { ErrorCode, HttpStatus };
