/**
 * 全系统统一的错误码表。
 *
 * 为什么要单独一张表：
 * - 前端目前只能靠 `error.response.data.message` 中文文案区分错误，
 *   文案一改（或被 i18n 替换）判断逻辑就失效；有了稳定错误码，
 *   前端可以做「4xx 不重试、5xx 指数退避重试」之类的策略映射。
 * - 后端各模块此前各自 `throw new Error('xxx')` 或抛不同状态码的 HttpException，
 *   同一类问题可能有 400/500 两种表现，无法统计也无法针对性降级。
 */

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  /** 依赖的外部服务（SymPy / LLM / Neo4j）不可用或返回异常 */
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  /** 外部服务超时——调用方可据此选择降级而不是重试 */
  UPSTREAM_TIMEOUT = 'UPSTREAM_TIMEOUT',
  /** 明确的业务规则拒绝（如"本题暂不支持自动求解"） */
  BUSINESS_ERROR = 'BUSINESS_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.PAYLOAD_TOO_LARGE]: 413,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.UPSTREAM_TIMEOUT]: 504,
  [ErrorCode.BUSINESS_ERROR]: 422,
  [ErrorCode.INTERNAL_ERROR]: 500,
};

/** 兜底中文文案：业务未指定 message 时使用，保证前端永远有可读提示 */
export const ERROR_DEFAULT_MESSAGE: Record<ErrorCode, string> = {
  [ErrorCode.VALIDATION_ERROR]: '请求参数不合法',
  [ErrorCode.UNAUTHORIZED]: '未登录或登录已过期',
  [ErrorCode.FORBIDDEN]: '没有访问权限',
  [ErrorCode.NOT_FOUND]: '资源不存在',
  [ErrorCode.CONFLICT]: '资源冲突',
  [ErrorCode.RATE_LIMITED]: '请求过于频繁，请稍后再试',
  [ErrorCode.PAYLOAD_TOO_LARGE]: '请求内容过大',
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: '依赖服务暂时不可用，请稍后重试',
  [ErrorCode.UPSTREAM_TIMEOUT]: '计算服务超时，已降级处理',
  [ErrorCode.BUSINESS_ERROR]: '请求无法满足',
  [ErrorCode.INTERNAL_ERROR]: '服务器内部错误',
};

/** 哪些错误码值得客户端重试（其余一律不重试） */
const RETRYABLE = new Set<ErrorCode>([
  ErrorCode.EXTERNAL_SERVICE_ERROR,
  ErrorCode.UPSTREAM_TIMEOUT,
  ErrorCode.RATE_LIMITED,
  ErrorCode.INTERNAL_ERROR,
]);

export function isRetryable(code: ErrorCode): boolean {
  return RETRYABLE.has(code);
}
