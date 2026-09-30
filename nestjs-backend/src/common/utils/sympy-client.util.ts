import { ConfigService } from '@nestjs/config';

/**
 * SymPy 客户端超时。
 *
 * 略大于服务端单次计算预算（默认 12s，见 SYMPY_COMPUTE_TIMEOUT_SECONDS），
 * 这样超时会由服务端以 504 + TIMEOUT 错误码返回，而不是客户端 axios 直接断链。
 */
export const SYMPY_HTTP_TIMEOUT_MS = Number(process.env.SYMPY_TIMEOUT_MS || 20000);

/**
 * 内部令牌请求头。
 *
 * SymPy 服务只在容器网络内暴露，配置 SYMPY_INTERNAL_TOKEN 后所有计算端点
 * 都要求携带 X-Internal-Token；未配置时返回空对象（本地开发不启用鉴权）。
 */
export function sympyRequestHeaders(
  configService: ConfigService,
): Record<string, string> {
  const token = configService.get<string>('SYMPY_INTERNAL_TOKEN');
  return token ? { 'X-Internal-Token': token } : {};
}

/**
 * 从 axios 错误中取出 SymPy 返回的结构化错误体。
 *
 * 服务端硬化后失败会返回真正的 4xx/5xx（不再是 HTTP 200 + success=false），
 * 调用方需要用这里拿到的 `error_code` 决定降级策略（数值积分、转 AI、明确告知…）。
 */
export function extractSympyErrorPayload(error: unknown): any | null {
  const response = (error as { response?: { data?: unknown } } | undefined)?.response;
  return (response?.data as any) ?? null;
}
