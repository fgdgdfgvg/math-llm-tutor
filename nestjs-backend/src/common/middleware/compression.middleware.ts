import { NextFunction, Request, Response } from 'express';
import { gzip } from 'zlib';

/**
 * 零依赖 gzip 响应压缩（对应目标文档 11.3.3「API 响应压缩」）。
 *
 * 为什么不用 compression 中间件：为一个 gzip 引入新依赖不划算，
 * Node 自带 zlib 足够；本文件不到 80 行，行为完全可控。
 *
 * 三条必须守住的红线：
 * 1. **不能破坏 SSE**：`/agents/solve/stream` 是 text/event-stream 长连接，
 *    一旦缓冲响应体，流式推送会变成"最后一次性吐出"，实时性直接归零。
 *    因此 text/event-stream / octet-stream / video 一律跳过。
 * 2. **不能重复压缩**：上游已设 Content-Encoding（nginx 压缩过的响应）直接放行，
 *    否则浏览器拿到双层压缩直接报错。
 * 3. **不能对小响应压**：JSON 信封普遍几百字节，压缩收益为负（还多了 CPU 与
 *    ~20 字节 gzip 头），因此设阈值（默认 1KB，可用 GZIP_MIN_SIZE 调整，0 = 全压）。
 */
export function gzipCompression(
  minSize = Number(process.env.GZIP_MIN_SIZE || 1024),
) {
  const SKIP_CONTENT_TYPE =
    /^(text\/event-stream|application\/octet-stream|video\/|audio\/)/i;

  return (req: Request, res: Response, next: NextFunction): void => {
    // 客户端不支持 gzip 就完全不管
    const accept = String(req.headers['accept-encoding'] || '');
    if (!/\bgzip\b/.test(accept)) {
      next();
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    let hijacked = false;

    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    res.write = ((chunk: any, ...args: any[]) => {
      // 流式响应（WebSocket 升级等）直接放行，不能缓冲
      if (res.headersSent || hijacked) return originalWrite(chunk, ...args);
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      chunks.push(buf);
      size += buf.length;
      return true;
    }) as typeof res.write;

    res.end = ((chunk?: any, ...args: any[]) => {
      if (hijacked) return originalEnd(chunk, ...args);
      if (chunk) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        chunks.push(buf);
        size += buf.length;
      }

      const contentType = String(res.getHeader('content-type') || '');
      const alreadyEncoded = Boolean(res.getHeader('content-encoding'));
      const shouldCompress =
        !res.headersSent &&
        !alreadyEncoded &&
        !SKIP_CONTENT_TYPE.test(contentType) &&
        size >= minSize &&
        size > 0;

      if (!shouldCompress) {
        // 不压缩：把缓冲的内容原样吐回去（分片写回，保持与原行为一致）
        hijacked = true;
        if (chunks.length) originalWrite(Buffer.concat(chunks));
        return originalEnd();
      }

      const body = Buffer.concat(chunks);
      gzip(body, (err, compressed) => {
        if (err || !compressed) {
          // 压缩失败绝不能吞掉响应：退回原文
          hijacked = true;
          if (chunks.length) originalWrite(Buffer.concat(chunks));
          return originalEnd();
        }
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
        // 长度变了，必须撤掉旧的 Content-Length
        res.removeHeader('Content-Length');
        hijacked = true;
        originalWrite(compressed);
        originalEnd();
      });
      return res;
    }) as typeof res.end;

    next();
  };
}
