import { createI18n } from 'vue-i18n';
import zhCN from './locales/zh-CN';
import enUS from './locales/en-US';

const messages = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

function getStoredLocale(): string {
  try {
    const stored = uni.getStorageSync('language');
    return stored || 'zh-CN';
  } catch {
    return 'zh-CN';
  }
}

const i18n = createI18n({
  locale: getStoredLocale(),
  fallbackLocale: 'zh-CN',
  legacy: false,
  globalInjection: true,
  messages,
});

export default i18n;

export const setLocale = (locale: string) => {
  // composition 模式下 locale 是 WritableComputedRef，legacy 模式下是普通字符串。
  // 用值本身的形状判断，比 i18n.mode 更直接（也让 TS 类型收窄生效）
  const current = i18n.global.locale as unknown;
  if (current && typeof current === 'object' && 'value' in (current as object)) {
    (current as { value: string }).value = locale;
  } else {
    (i18n.global as unknown as { locale: string }).locale = locale;
  }
  uni.setStorageSync('language', locale);
  document?.documentElement?.setAttribute('lang', locale);
};

export const getLocale = (): string => {
  const current = i18n.global.locale as unknown;
  if (current && typeof current === 'object' && 'value' in (current as object)) {
    return (current as { value: string }).value;
  }
  return current as string;
};

export const t = (key: string, params?: Record<string, unknown>): string => {
  return i18n.global.t(key, params as never) as string;
};
