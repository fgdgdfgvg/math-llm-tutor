import { defineStore } from 'pinia';
import { ref, watch, computed } from 'vue';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type FontSize = 'small' | 'medium' | 'large';
export type Language = 'zh-CN' | 'en-US';

export const useSettingsStore = defineStore('settings', () => {
  const themeMode = ref<ThemeMode>('light');
  const fontSize = ref<FontSize>('medium');
  const language = ref<Language>('zh-CN');
  const autoSaveHistory = ref(true);

  const initSettings = () => {
    try {
      const savedThemeMode = uni.getStorageSync('themeMode') as ThemeMode;
      const savedFontSize = uni.getStorageSync('fontSize') as FontSize;
      const savedLanguage = uni.getStorageSync('language') as Language;
      const savedAutoSave = uni.getStorageSync('autoSaveHistory');

      if (savedThemeMode) themeMode.value = savedThemeMode;
      if (savedFontSize) fontSize.value = savedFontSize;
      if (savedLanguage) language.value = savedLanguage;
      if (typeof savedAutoSave === 'boolean') autoSaveHistory.value = savedAutoSave;
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  };

  const setThemeMode = (mode: ThemeMode) => {
    themeMode.value = mode;
    uni.setStorageSync('themeMode', mode);
  };

  const setFontSize = (size: FontSize) => {
    fontSize.value = size;
    uni.setStorageSync('fontSize', size);
  };

  const setLanguage = (lang: Language) => {
    language.value = lang;
    uni.setStorageSync('language', lang);
  };

  const setAutoSaveHistory = (value: boolean) => {
    autoSaveHistory.value = value;
    uni.setStorageSync('autoSaveHistory', value);
  };

  watch([themeMode, fontSize, language, autoSaveHistory], () => {
    uni.setStorageSync('themeMode', themeMode.value);
    uni.setStorageSync('fontSize', fontSize.value);
    uni.setStorageSync('language', language.value);
    uni.setStorageSync('autoSaveHistory', autoSaveHistory.value);
  });

  return {
    themeMode,
    fontSize,
    language,
    autoSaveHistory,
    initSettings,
    setThemeMode,
    setFontSize,
    setLanguage,
    setAutoSaveHistory,
  };
});
