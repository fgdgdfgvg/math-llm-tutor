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
  if (i18n.mode === 'legacy') {
    i18n.global.locale = locale;
  } else {
    (i18n.global.locale as unknown as { value: string }).value = locale;
  }
  uni.setStorageSync('language', locale);
  document?.documentElement?.setAttribute('lang', locale);
};

export const getLocale = (): string => {
  if (i18n.mode === 'legacy') {
    return i18n.global.locale as string;
  }
  return (i18n.global.locale as unknown as { value: string }).value;
};

export const t = (key: string, params?: Record<string, unknown>): string => {
  return i18n.global.t(key, params as never) as string;
};
