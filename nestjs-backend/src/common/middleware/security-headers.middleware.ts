import { NextFunction, Request, Response } from 'express';

/**
 * 最小安全响应头集。
 *
 * 为什么手写而不引 helmet：只差四五个头，手写零依赖、可读、无供应链面；
 * helmet 更完整（CSP 等），但它默认开启的 CSP 会直接打断挂在 /api/docs 的
 * Swagger UI，仍需逐项关掉，收益反而变小。将来要上 CSP 时再换 helmet 更合适。
 *
 * 逐项理由：
 * - X-Content-Type-Options: nosniff —— 禁止浏览器 MIME 嗅探。API 返回 JSON，
 *   若被当成 HTML 解析，用户可控内容就有了 XSS 通道。
 * - X-Frame-Options: DENY —— 禁止被 iframe 嵌套，防点击劫持。
 * - Referrer-Policy: no-referrer —— 避免把请求地址（含可能的查询参数）泄给第三方。
 * - Strict-Transport-Security —— 仅生产环境下发：开发环境通常是 http，
 *   下发 HSTS 会让浏览器强制升级到 https，把本机调试打断。
 * - X-Powered-By —— Express 默认会带，属不必要的框架指纹，直接关闭。
 */
export function securityHeaders(isProduction: boolean) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.removeHeader('X-Powered-By');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');

    if (isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    next();
  };
}
