import { AIModelsService } from './ai-models.service';
import { AIModelProvider } from './ai-models.types';

/**
 * 反向测试：覆盖 AI 模型配置的"未配置 / 空值 / 缺 baseUrl / model 覆盖"边界，
 * 这些正是多智能体降级链路里最容易静默失败、也最难复现的点。
 *
 * 注意：本测试只验证配置解析与 isModelAvailable / chat 前置校验，不发起真实 HTTP。
 */

/** 桩 ConfigService：按 env 键返回预设值 */
function stubConfig(values: Record<string, string | undefined>) {
  return {
    get: <T>(key: string): T | undefined => values[key] as T | undefined,
  } as any;
}

describe('AIModelsService 配置解析与降级边界', () => {
  it('全部 provider 未配置 key → isModelAvailable 全部为 false', () => {
    const svc = new AIModelsService(stubConfig({}), {} as any);
    for (const p of Object.values(AIModelProvider)) {
      expect(svc.isModelAvailable(p)).toBe(false);
    }
  });

  it('DeepSeek 只配 key 不配 baseUrl → 仍不可用（baseUrl 有默认值，属例外）', () => {
    // DeepSeek 的 baseUrl 在代码里有官方默认 https://api.deepseek.com/v1，
    // 因此只配 key 即可用；这是与其他 provider（baseUrl 无默认）的关键差异。
    const svc = new AIModelsService(
      stubConfig({ AI_DEEPSEEK_API_KEY: 'sk-test' }),
      {} as any,
    );
    expect(svc.isModelAvailable(AIModelProvider.DEEPSEEK)).toBe(true);
  });

  it('QWEN 未配 key → 不可用；配 AI_QWEN_API_KEY → 可用', () => {
    const empty = new AIModelsService(stubConfig({}), {} as any);
    expect(empty.isModelAvailable(AIModelProvider.QWEN)).toBe(false);

    const configured = new AIModelsService(
      stubConfig({ AI_QWEN_API_KEY: 'sk-qwen' }),
      {} as any,
    );
    expect(configured.isModelAvailable(AIModelProvider.QWEN)).toBe(true);
  });

  it('DeepSeek 不借用 AI_DEEPSEEK_API_KEY 给 QWEN（B1 回归）', () => {
    // 关键安全回归：只配 DeepSeek key，QWEN 不得因此变得"可用"——
    // 否则 DeepSeek 官方 key 会被发往 QWEN 默认的 SiliconFlow 网关。
    const svc = new AIModelsService(
      stubConfig({ AI_DEEPSEEK_API_KEY: 'sk-deepseek' }),
      {} as any,
    );
    expect(svc.isModelAvailable(AIModelProvider.DEEPSEEK)).toBe(true);
    expect(svc.isModelAvailable(AIModelProvider.QWEN)).toBe(false);
    expect(svc.isModelAvailable(AIModelProvider.HUGGINGFACE)).toBe(false);
  });

  it('DeepSeek model 可由 AI_DEEPSEEK_MODEL 覆盖（官方 vs SiliconFlow 命名）', () => {
    const official = new AIModelsService(
      stubConfig({
        AI_DEEPSEEK_API_KEY: 'sk-test',
        AI_DEEPSEEK_MODEL: 'deepseek-chat',
      }),
      {} as any,
    );
    expect(official.getModelConfig(AIModelProvider.DEEPSEEK)?.model).toBe(
      'deepseek-chat',
    );

    const sf = new AIModelsService(
      stubConfig({
        AI_DEEPSEEK_API_KEY: 'sk-test',
        AI_DEEPSEEK_MODEL: 'deepseek-ai/DeepSeek-V3',
      }),
      {} as any,
    );
    expect(sf.getModelConfig(AIModelProvider.DEEPSEEK)?.model).toBe(
      'deepseek-ai/DeepSeek-V3',
    );

    // 未覆盖时默认 deepseek-chat（官方通用对话）
    const dflt = new AIModelsService(
      stubConfig({ AI_DEEPSEEK_API_KEY: 'sk-test' }),
      {} as any,
    );
    expect(dflt.getModelConfig(AIModelProvider.DEEPSEEK)?.model).toBe(
      'deepseek-chat',
    );
  });

  it('getModelConfig 对未知 provider 返回 undefined', () => {
    const svc = new AIModelsService(stubConfig({}), {} as any);
    expect(
      svc.getModelConfig('nonexistent' as AIModelProvider),
    ).toBeUndefined();
  });

  it('chat 对未配置的 provider 抛错（不发起 HTTP）', async () => {
    const svc = new AIModelsService(stubConfig({}), {} as any);
    await expect(
      svc.chat(AIModelProvider.QWEN, {
        messages: [{ role: 'user', content: 'test' }],
      }),
    ).rejects.toThrow(/configuration incomplete/i);
  });

  it('chat 对不存在的 provider 抛错', async () => {
    const svc = new AIModelsService(stubConfig({}), {} as any);
    await expect(
      svc.chat('nope' as AIModelProvider, {
        messages: [{ role: 'user', content: 'test' }],
      }),
    ).rejects.toThrow(/not configured/i);
  });
});
