import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export type ThemeMode = 'light' | 'dark' | 'auto';

export const useThemeStore = defineStore('theme', () => {
  const currentTheme = ref<'light' | 'dark'>('light');
  const themeMode = ref<ThemeMode>('light');
  let initialized = false;

  const initTheme = () => {
    if (initialized) {
      applyTheme();
      return;
    }
    initialized = true;
    try {
      const savedMode = uni.getStorageSync('themeMode') as ThemeMode;
      if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'auto') {
        themeMode.value = savedMode;
      }
    } catch {
      /* 忽略存储读取失败 */
    }
    applyTheme();
  };

  const applyTheme = () => {
    if (themeMode.value === 'auto') {
      let isDark = false;
      try {
        const systemInfo: any = uni.getSystemInfoSync();
        isDark = systemInfo?.osTheme === 'dark';
      } catch {
        isDark = false;
      }
      currentTheme.value = isDark ? 'dark' : 'light';
    } else {
      currentTheme.value = themeMode.value as 'light' | 'dark';
    }
    updatePageStyle();
  };

  const setTheme = (mode: ThemeMode) => {
    themeMode.value = mode;
    try {
      uni.setStorageSync('themeMode', mode);
    } catch {
      /* 忽略存储写入失败 */
    }
    applyTheme();
  };

  const toggleTheme = () => {
    const newMode = currentTheme.value === 'light' ? 'dark' : 'light';
    setTheme(newMode);
  };

  /**
   * 把主题类名挂到真正的 DOM 根节点。
   * App.vue 的模板在 uni-app 里不是可靠的挂载点，只有作用到 html/body
   * 才能让 CSS 变量（--bg-*、--text-*）在 H5 全局生效。
   */
  const applyThemeClassToDom = (isDark: boolean) => {
    // #ifdef H5
    if (typeof document === 'undefined') return;
    const themeClass = isDark ? 'theme-dark' : 'theme-light';
    const previousClass = isDark ? 'theme-light' : 'theme-dark';

    const targets: (HTMLElement | null)[] = [document.documentElement, document.body];
    for (const el of targets) {
      if (!el) continue;
      el.classList.remove(previousClass);
      el.classList.add(themeClass);
    }
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    // #endif
  };

  const updatePageStyle = () => {
    const isDark = currentTheme.value === 'dark';

    applyThemeClassToDom(isDark);

    try {
      const result: any = uni.setNavigationBarColor({
        frontColor: isDark ? '#ffffff' : '#000000',
        backgroundColor: isDark ? '#14141f' : '#ffffff',
        animation: {
          duration: 300,
          timingFunc: 'easeIn',
        },
      });
      // 部分平台（H5）不支持导航栏配色，返回 Promise 会 reject，静默忽略
      if (result && typeof result.catch === 'function') {
        result.catch(() => undefined);
      }
    } catch {
      /* 忽略 */
    }
  };

  watch(themeMode, () => {
    applyTheme();
  });

  return {
    currentTheme,
    themeMode,
    initTheme,
    setTheme,
    toggleTheme,
  };
});
