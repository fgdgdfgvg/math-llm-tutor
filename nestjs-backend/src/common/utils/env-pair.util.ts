// env-pair.util.ts
//
// 「成对选择」工具：解决新旧两套环境变量前缀并存时，逐条 `||` 回退导致的
// "key 用新组、baseUrl 用旧组"跨组混合问题。
//
// 背景：多智能体链路统一用 `AI_DEEPSEEK_*` 前缀，旧直连模块用无前缀的
// `DEEPSEEK_*`。若对 key/baseUrl/model 各自独立回退，可能出现"配了新组的
// API Key、却取到旧组的 baseUrl"——官方 DeepSeek Key 被发往第三方网关，
// 构成跨服务商凭据串用（历史 B1/B2 缺陷的同类复发）。
//
// 规则：只要新组里**任意一个**键被显式设置，就认定"用户在使用新组"，
// 整组（key/baseUrl/model）都从新组读取，缺失项用默认值兜底，绝不跨组。
// 反之，若新组一个都没设置，则整组回退旧组。

export interface ConfigGetter {
  get<T = string>(key: string): T | undefined;
}

export interface EnvPair {
  key: string;
  baseUrl: string;
  model: string;
}

/**
 * 成对读取一组（新前缀 / 旧前缀）环境变量，避免跨组混合。
 *
 * @param get       配置读取器（通常是 Nest ConfigService）
 * @param newPrefix 新前缀，如 `AI_DEEPSEEK_`
 * @param oldPrefix 旧前缀，如 `DEEPSEEK_`
 * @param defaults  整组缺失时兜底的默认值 { key, baseUrl, model }
 */
export function pickEnvPair(
  get: ConfigGetter,
  newPrefix: string,
  oldPrefix: string,
  defaults: Partial<EnvPair>,
): EnvPair {
  const newKeys = [
    `${newPrefix}API_KEY`,
    `${newPrefix}BASE_URL`,
    `${newPrefix}MODEL`,
  ];
  const useNew = newKeys.some((k) => {
    const v = get.get<string>(k);
    return v !== undefined && v !== null && v !== '';
  });

  const prefix = useNew ? newPrefix : oldPrefix;
  const read = (suffix: string, fallback: string) => {
    const v = get.get<string>(`${prefix}${suffix}`);
    return v !== undefined && v !== null && v !== '' ? v : fallback;
  };

  return {
    key: read('API_KEY', defaults.key ?? ''),
    baseUrl: read('BASE_URL', defaults.baseUrl ?? ''),
    model: read('MODEL', defaults.model ?? ''),
  };
}
