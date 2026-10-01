import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

/**
 * 请求上下文（目前只有 traceId）。
 *
 * 目的：让一条请求在 NestJS 日志 → SymPy → LLM 调用链上都能带上同一个 ID。
 * 出问题时可以按 traceId 把整条链路捞出来，而不是在几千行日志里靠时间猜。
 *
 * 用 AsyncLocalStorage 而不是把 traceId 挂在 req 上，是为了让**服务层**也能拿到它：
 * 服务层按分层约定不接触 HTTP 对象，挂在 req 上就只能在控制器里用。
 */
export interface RequestContext {
  traceId: string;
  /** 便于在日志里区分请求来源，可选 */
  path?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function newTraceId(): string {
  return randomUUID();
}

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** 取当前请求的 traceId；不在请求上下文内（如定时任务）时返回 undefined */
export function getTraceId(): string | undefined {
  return storage.getStore()?.traceId;
}

/** 日志前缀，形如 `[trace:xxxx]`；无上下文时返回空串，方便直接拼接 */
export function tracePrefix(): string {
  const id = getTraceId();
  return id ? `[trace:${id.slice(0, 8)}] ` : '';
}
