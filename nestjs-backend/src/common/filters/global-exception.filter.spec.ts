import { ArgumentsHost, BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { GlobalExceptionFilter, ErrorResponseBody } from './global-exception.filter';
import { AppError, InternalError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';
import { getTraceId, runWithRequestContext } from '../utils/request-context';

/** 构造一个最小可用的 HTTP ArgumentsHost */
function fakeHost(path = '/api/test', traceId?: string): { host: ArgumentsHost; res: any } {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  const req: any = { originalUrl: path, url: path, traceId, headers: {} };
  const host = {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
      getNext: () => undefined,
    }),
    getType: () => 'http',
  } as unknown as ArgumentsHost;
  return { host, res };
}

describe('GlobalExceptionFilter', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    // 过滤器自身不打日志到 stdout，避免污染测试结果；这里只关心响应体
    jest.spyOn((filter as any).logger, 'error').mockImplementation(() => undefined);
    jest.spyOn((filter as any).logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('AppError：暴露型错误原样回传 message，内部错误只给兜底文案', () => {
    process.env.NODE_ENV = 'production';
    const { host, res } = fakeHost();

    filter.catch(new AppError(ErrorCode.BUSINESS_ERROR, '这题暂不支持自动求解'), host);
    expect(res.statusCode).toBe(422);
    expect((res.body as ErrorResponseBody).message).toBe('这题暂不支持自动求解');

    const { host: h2, res: r2 } = fakeHost();
    filter.catch(new InternalError('Mongo connection string mongodb://user:pwd@host leaked'), h2);
    expect(r2.statusCode).toBe(500);
    // 关键：内部细节不能出现在响应里
    expect((r2.body as ErrorResponseBody).message).not.toContain('pwd');
    expect((r2.body as ErrorResponseBody).message).toBe('服务器内部错误');
  });

  it('ValidationPipe 的数组 message 被压平成单行文本', () => {
    process.env.NODE_ENV = 'production';
    const { host, res } = fakeHost();
    filter.catch(
      new BadRequestException(['username must be a string', 'password too short']),
      host,
    );
    const body = res.body as ErrorResponseBody;
    expect(res.statusCode).toBe(400);
    expect(body.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(body.message).toBe('username must be a string; password too short');
  });

  it('Nest 内置异常按状态码映射为稳定错误码', () => {
    process.env.NODE_ENV = 'production';
    const { host, res } = fakeHost();
    filter.catch(new NotFoundException(), host);
    expect(res.statusCode).toBe(404);
    expect((res.body as ErrorResponseBody).code).toBe(ErrorCode.NOT_FOUND);
  });

  it('Mongoose 唯一键冲突映射为 409 而不是 500', () => {
    process.env.NODE_ENV = 'production';
    const { host, res } = fakeHost();
    const duplicateKeyError: any = new Error('E11000 duplicate key error');
    duplicateKeyError.code = 11000;
    filter.catch(duplicateKeyError, host);
    expect(res.statusCode).toBe(409);
    expect((res.body as ErrorResponseBody).code).toBe(ErrorCode.CONFLICT);
  });

  it('axios 超时映射为 504 UPSTREAM_TIMEOUT，且不回传上游细节', () => {
    process.env.NODE_ENV = 'production';
    const { host, res } = fakeHost();
    const axiosError: any = new Error('timeout of 20000ms exceeded');
    axiosError.isAxiosError = true;
    axiosError.code = 'ECONNABORTED';
    axiosError.config = { headers: { Authorization: 'Bearer sk-secretvalue123456' } };
    filter.catch(axiosError, host);
    const body = res.body as ErrorResponseBody;
    expect(res.statusCode).toBe(504);
    expect(body.code).toBe(ErrorCode.UPSTREAM_TIMEOUT);
    expect(JSON.stringify(body)).not.toContain('sk-secretvalue');
  });

  it('响应体带 traceId，且与请求上下文一致', () => {
    process.env.NODE_ENV = 'production';
    runWithRequestContext({ traceId: 'trace-fixed-id' }, () => {
      expect(getTraceId()).toBe('trace-fixed-id');
      const { host, res } = fakeHost();
      filter.catch(new AppError(ErrorCode.NOT_FOUND, '没找到'), host);
      expect((res.body as ErrorResponseBody).traceId).toBe('trace-fixed-id');
    });
  });

  it('无请求上下文时 traceId 回落到 req.traceId，不返回 undefined', () => {
    process.env.NODE_ENV = 'production';
    const { host, res } = fakeHost('/api/x', 'req-level-trace');
    filter.catch(new AppError(ErrorCode.NOT_FOUND, '没找到'), host);
    expect((res.body as ErrorResponseBody).traceId).toBe('req-level-trace');
  });

  it('生产环境不返回 stack/details，非生产环境返回', () => {
    process.env.NODE_ENV = 'production';
    const { host, res } = fakeHost();
    filter.catch(new Error('boom'), host);
    expect((res.body as ErrorResponseBody).stack).toBeUndefined();
    expect((res.body as ErrorResponseBody).details).toBeUndefined();

    process.env.NODE_ENV = 'development';
    const { host: h2, res: r2 } = fakeHost();
    filter.catch(new AppError(ErrorCode.BUSINESS_ERROR, 'x', { details: { a: 1 } }), h2);
    expect((r2.body as ErrorResponseBody).details).toEqual({ a: 1 });
    expect((r2.body as ErrorResponseBody).stack).toBeDefined();
  });

  it('未识别异常不会把原始 message 透给客户端', () => {
    process.env.NODE_ENV = 'production';
    const { host, res } = fakeHost();
    filter.catch(new Error('Cannot read property x of undefined at /app/src/foo.ts:12'), host);
    const body = res.body as ErrorResponseBody;
    expect(body.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(body.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body.message).toBe('服务器内部错误');
  });
});
