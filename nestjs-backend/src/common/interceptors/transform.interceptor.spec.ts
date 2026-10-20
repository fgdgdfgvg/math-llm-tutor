import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

/** 造一个最小可用的 ExecutionContext：只需要 switchToHttp().getResponse() */
function contextWithStatus(statusCode: number): ExecutionContext {
  const response = { statusCode };
  return {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ExecutionContext;
}

function handlerReturning(data: unknown): CallHandler {
  return { handle: () => of(data) } as unknown as CallHandler;
}

describe('TransformInterceptor', () => {
  const interceptor = new TransformInterceptor();

  const run = async (statusCode: number, data: unknown) => {
    const result$ = interceptor.intercept(
      contextWithStatus(statusCode),
      handlerReturning(data),
    );
    return await new Promise<any>((resolve) => result$.subscribe(resolve));
  };

  it('业务成功：统一包成 code 200 / message success', async () => {
    const body = await run(200, { hello: 'world' });
    expect(body).toEqual({
      code: 200,
      data: { hello: 'world' },
      message: 'success',
    });
  });

  it('data 为 undefined 时补齐为 null（避免前端拿到 undefined）', async () => {
    const body = await run(200, undefined);
    expect(body.data).toBeNull();
    expect(body.code).toBe(200);
  });

  it('处理器主动设置 503 时透传（/health/ready 未就绪场景）', async () => {
    const body = await run(503, { status: 'not-ready' });
    expect(body.code).toBe(503);
    expect(body.message).toBe('error');
    expect(body.data).toEqual({ status: 'not-ready' });
  });

  it('处理器主动设置 4xx 时同样透传', async () => {
    const body = await run(404, null);
    expect(body.code).toBe(404);
    expect(body.message).toBe('error');
  });

  it('2xx 中非 200 的状态码仍记 200（业务成功不区分 created/accepted 语义）', async () => {
    const body = await run(201, { id: 1 });
    expect(body.code).toBe(200);
    expect(body.message).toBe('success');
  });

  it('拿不到 statusCode 时退化为 200，不抛错', async () => {
    const ctx = {
      switchToHttp: () => ({ getResponse: () => undefined }),
    } as unknown as ExecutionContext;
    const result$ = interceptor.intercept(ctx, handlerReturning({ ok: true }));
    const body = await new Promise<any>((resolve) =>
      result$.subscribe(resolve),
    );
    expect(body.code).toBe(200);
  });
});
