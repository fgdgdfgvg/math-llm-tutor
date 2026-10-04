import { createServer, Server, get as httpGet, request as httpRequest } from 'http';
import express from 'express';
import { gzipSync, gunzipSync } from 'zlib';
import { gzipCompression } from './compression.middleware';

/**
 * 压缩中间件的行为契约测试。
 * 三条红线各有对应用例：SSE 不能被缓冲、小响应不压、已编码不重复压。
 */
describe('gzipCompression', () => {
  let server: Server;
  let port: number;
  let app: express.Express;

  const bigPayload = { items: Array.from({ length: 200 }, (_, i) => ({ id: i, name: `concept-${i}`, desc: 'x'.repeat(40) })) };

  beforeAll(async () => {
    app = express();
    app.use(gzipCompression(1024));
    app.get('/big', (_req, res) => res.json(bigPayload));
    app.get('/small', (_req, res) => res.json({ ok: true }));
    app.get('/sse', (_req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.write('data: 第一条\n\n');
      // 关键：分两次推送。若中间件缓冲，收流时就拿不到第一条。
      setTimeout(() => res.write('data: 第二条\n\n'), 30);
      setTimeout(() => res.end(), 60);
    });
    app.get('/preencoded', (_req, res) => {
      const body = gzipSync(Buffer.from(JSON.stringify(bigPayload)));
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Type', 'application/json');
      res.end(body);
    });

    await new Promise<void>((resolve) => {
      server = createServer(app);
      server.listen(0, '127.0.0.1', () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  /** 发起请求；acceptGzip=false 时显式声明不支持压缩 */
  const call = (path: string, acceptGzip = true) =>
    new Promise<{ headers: any; raw: Buffer; status: number }>((resolve, reject) => {
      const req = httpRequest(
        { host: '127.0.0.1', port, path, headers: { 'accept-encoding': acceptGzip ? 'gzip, deflate' : 'identity' } },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () =>
            resolve({ headers: res.headers, raw: Buffer.concat(chunks), status: res.statusCode! }),
          );
        },
      );
      req.on('error', reject);
      req.end();
    });

  it('大响应会被 gzip 压缩，且带 Content-Encoding 与 Vary', async () => {
    const r = await call('/big');
    expect(r.headers['content-encoding']).toBe('gzip');
    expect(String(r.headers['vary'])).toContain('Accept-Encoding');
    // 压缩后必须小于原文，且不应残留 Content-Length（长度已变）
    const plain = JSON.stringify(bigPayload);
    expect(r.raw.length).toBeLessThan(plain.length);
    expect(r.headers['content-length']).toBeUndefined();
    // 压缩必须无损：解开后内容与原文一致
    expect(gunzipSync(r.raw).toString()).toBe(plain);
  });

  it('客户端不支持 gzip 时原样返回（不加 Content-Encoding）', async () => {
    const r = await call('/big', false);
    expect(r.headers['content-encoding']).toBeUndefined();
    expect(JSON.parse(r.raw.toString()).items.length).toBe(200);
  });

  it('小于阈值的响应不压缩（压缩收益为负）', async () => {
    const r = await call('/small');
    expect(r.headers['content-encoding']).toBeUndefined();
    expect(r.raw.toString()).toContain('"ok":true');
  });

  it('SSE（text/event-stream）不被缓冲：首条数据必须即时到达', async () => {
    const chunks: string[] = [];
    await new Promise<void>((resolve, reject) => {
      const req = httpGet({ host: '127.0.0.1', port, path: '/sse' }, (res) => {
        expect(res.headers['content-encoding']).toBeUndefined();
        res.on('data', (c) => {
          chunks.push(c.toString());
          // 收到第一条即证明没有被缓冲（缓冲的话要等 res.end 才有数据）
          if (chunks.join('').includes('第一条')) resolve();
        });
        res.on('end', () => resolve());
      });
      req.on('error', reject);
      setTimeout(() => reject(new Error('SSE 未在预期时间内推送首条数据')), 2000);
    });
    expect(chunks.join('')).toContain('第一条');
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('上游已压缩的响应不重复压缩', async () => {
    const r = await call('/preencoded');
    expect(r.headers['content-encoding']).toBe('gzip');
    // 响应体应仍是"一层" gzip：能直接解开并还原出原始 JSON。
    // 若被二次压缩，gunzipSync 要么抛错、要么解出乱码。
    const decoded = JSON.parse(gunzipSync(r.raw).toString());
    expect(decoded.items.length).toBe(200);
  });
});
