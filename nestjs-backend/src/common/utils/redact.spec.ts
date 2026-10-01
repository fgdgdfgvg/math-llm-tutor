import { describeErrorForLog, describeHttpError, redactSecrets } from './redact';

describe('redactSecrets', () => {
  it('遮蔽字符串里的 sk- 密钥与 Bearer 令牌', () => {
    const out = redactSecrets('Authorization: Bearer sk-abcdefghijklmnopqrstuvwxyz012345');
    expect(out).not.toContain('sk-abcdefghijklmnopqrstuvwxyz012345');
    expect(out).toContain('Bearer');
  });

  it('遮蔽对象里按 key 判定的敏感字段（含嵌套）', () => {
    const out = redactSecrets({
      username: 'alice',
      password: 'p@ssw0rd',
      nested: { apiKey: 'sk-1234567890abcdef', inner: { token: 'abc' } },
    }) as any;
    expect(out.username).toBe('alice');
    expect(out.password).toBe('[REDACTED]');
    expect(out.nested.apiKey).toBe('[REDACTED]');
    expect(out.nested.inner.token).toBe('[REDACTED]');
  });

  it('遮蔽 HTTP 头对象（大小写不敏感）', () => {
    const out = redactSecrets({ Authorization: 'Bearer sk-xxx', 'X-Api-Key': 'yyy' }) as any;
    expect(out.Authorization).toBe('[REDACTED]');
    expect(out['X-Api-Key']).toBe('[REDACTED]');
  });

  it('Error 对象只保留 name/message，不展开 stack', () => {
    const err = new Error('failed with token sk-abcdefghijklmnop');
    const out = redactSecrets(err) as any;
    expect(out.stack).toBeUndefined();
    expect(out.message).not.toContain('sk-abcdefghijklmnop');
  });

  it('循环引用不导致栈溢出', () => {
    const a: any = { name: 'a' };
    a.self = a;
    const out = redactSecrets(a) as any;
    expect(out.name).toBe('a');
    expect(out.self).toBe('[Circular]');
  });

  it('数组逐元素脱敏', () => {
    const out = redactSecrets(['ok', 'Bearer sk-abcdefghijklmnop', 'plain']) as string[];
    expect(out[0]).toBe('ok');
    expect(out[1]).not.toContain('sk-abcdefghijklmnop');
    expect(out[2]).toBe('plain');
  });
});

describe('describeHttpError', () => {
  it('抽取 status 与上游错误码，且不携带 config/request', () => {
    const axiosError: any = new Error('Request failed with status code 504');
    axiosError.isAxiosError = true;
    axiosError.config = { headers: { Authorization: 'Bearer sk-shouldnotleak123456' } };
    axiosError.request = { _header: 'POST /v1 HTTP/1.1\r\nAuthorization: Bearer sk-shouldnotleak123456' };
    axiosError.response = { status: 504, data: { code: 'TIMEOUT', message: 'compute timeout' } };

    const summary = describeHttpError(axiosError);
    expect(summary.isHttpError).toBe(true);
    expect(summary.status).toBe(504);
    expect(summary.upstreamCode).toBe('TIMEOUT');

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('sk-shouldnotleak');
    // 关键回归点：历史上正是 _header 把完整令牌打进了日志
    expect(serialized).not.toContain('_header');
  });

  it('非 HTTP 错误也能给出可用摘要', () => {
    const summary = describeHttpError(new Error('socket hang up'));
    expect(summary.isHttpError).toBe(false);
    expect(summary.message).toBe('socket hang up');
  });

  it('describeErrorForLog 输出单行、可直接进日志', () => {
    const axiosError: any = new Error('boom');
    axiosError.response = { status: 400, data: { code: 'PARSE_ERROR', message: 'bad expr' } };
    expect(describeErrorForLog(axiosError)).toBe('status=400 code=PARSE_ERROR message=bad expr');
  });
});
