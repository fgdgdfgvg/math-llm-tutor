/**
 * 运行期日志脱敏工具。
 *
 * 背景：本项目曾把 axios 错误对象整体 `logger.error(error)` 序列化，
 * 导致完整的 `Authorization: Bearer sk-…` 请求头被打进 backend-out.log，
 * 真实密钥就此落到磁盘并随项目分发。密钥轮换只能止损，
 * 真正的修复是让"敏感字段根本进不了日志"。
 *
 * 使用约定：
 * - 任何写入日志的值，先过 `redactSecrets()`；
 * - 捕获 axios / fetch 异常时，用 `describeHttpError()` 取结构化摘要，
 *   禁止直接打印 error 对象本身（它会带上 config.headers / request._header）。
 */

/** 需要整体遮蔽的 HTTP 头 */
const SENSITIVE_HEADERS =
  /^(?:authorization|proxy-authorization|cookie|set-cookie|x-api-key|api[-_]?key|x-auth-token|x-internal-token|x-csrf-token)$/i;

/** 需要整体遮蔽的字段名（对象 key） */
const SENSITIVE_FIELDS =
  /(?:api[_-]?key|apikey|password|passwd|pwd|secret|token|authorization|cookie|credential|private[_-]?key|refresh[_-]?token|access[_-]?token)/i;

/** 字符串里形如密钥的片段 */
const SECRET_LIKE_PATTERNS: Array<[RegExp, string]> = [
  [/(Bearer\s+)[A-Za-z0-9_\-\.]{8,}/gi, '$1<redacted>'],
  [/\b(sk-[A-Za-z0-9_\-]{8,})/g, '<redacted-sk-key>'],
  [
    /\b(eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{4,}\.[A-Za-z0-9_\-]{4,})/g,
    '<redacted-jwt>',
  ],
  // key=value / key: value 形式（值里不含空白与引号）
  [
    /((?:api[_-]?key|apikey|password|passwd|secret|token|access[_-]?token|refresh[_-]?token)\s*[:=]\s*)(["']?)([A-Za-z0-9_\-\.]{8,})\2/gi,
    '$1$2<redacted>$2',
  ],
];

const MAX_DEPTH = 6;
const REDACTED = '[REDACTED]';

function redactString(input: string): string {
  let out = input;
  for (const [pattern, replacement] of SECRET_LIKE_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * 深度脱敏：字符串替换形如密钥的片段，对象按 key 遮蔽敏感字段，其余递归。
 * 自带深度上限与循环引用保护，绝不会因为一个奇怪的对象把进程拖死。
 */
export function redactSecrets<T>(
  value: T,
  depth = 0,
  seen = new WeakSet<object>(),
): T {
  if (value == null) return value;

  if (typeof value === 'string') return redactString(value) as unknown as T;
  if (typeof value !== 'object') return value;

  if (depth >= MAX_DEPTH) return '[Object]' as unknown as T;

  const obj = value as object;
  if (seen.has(obj)) return '[Circular]' as unknown as T;
  seen.add(obj);

  if (Array.isArray(value)) {
    return value.map((item) =>
      redactSecrets(item, depth + 1, seen),
    ) as unknown as T;
  }

  // Error 对象：只保留名称与消息，不展开 stack（stack 里可能有局部变量快照）
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message ?? ''),
    } as unknown as T;
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (SENSITIVE_HEADERS.test(key) || SENSITIVE_FIELDS.test(key)) {
      out[key] = REDACTED;
      continue;
    }
    out[key] = redactSecrets(val, depth + 1, seen);
  }
  return out as unknown as T;
}

export interface HttpErrorSummary {
  /** 是否为 HTTP 类错误（有 response） */
  isHttpError: boolean;
  status?: number;
  /** 上游返回的错误码（如 PARSE_ERROR / TIMEOUT），保留用于选择降级策略 */
  upstreamCode?: string;
  message: string;
}

/**
 * 从 axios / fetch 异常中抽取可直接写进日志与响应的结构化摘要。
 *
 * 关键：绝不返回 `error.config`、`error.request`、`error.response.data`，
 * axios 的 error 对象里 `config.headers.Authorization` 与 `request._header`
 * 都带着完整的 Bearer 令牌。
 */
export function describeHttpError(error: unknown): HttpErrorSummary {
  const anyError = error as any;

  if (!anyError || typeof anyError !== 'object') {
    return { isHttpError: false, message: redactString(String(error)) };
  }

  const status: number | undefined = anyError?.response?.status;
  const upstreamCode: string | undefined =
    anyError?.response?.data?.code ?? anyError?.response?.data?.error?.code;

  const rawMessage: string =
    anyError?.response?.data?.message ??
    anyError?.message ??
    String(anyError?.name ?? 'UnknownError');

  return {
    isHttpError: status !== undefined,
    status,
    upstreamCode,
    message: redactString(rawMessage),
  };
}

/** 一行式摘要，便于 `logger.warn(describeErrorForLog(err))` */
export function describeErrorForLog(error: unknown): string {
  const summary = describeHttpError(error);
  const parts: string[] = [];
  if (summary.status !== undefined) parts.push(`status=${summary.status}`);
  if (summary.upstreamCode) parts.push(`code=${summary.upstreamCode}`);
  parts.push(`message=${summary.message}`);
  return parts.join(' ');
}
