import { createSSRApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import i18n from './i18n';
import { useUserStore } from './stores/user';
import { useThemeStore } from './stores/theme';
import { initNavigationTitles, applyNavigationTitle } from './utils/page-title';
import 'katex/dist/katex.min.css';

export function createApp() {
  const app = createSSRApp(App);
  const pinia = createPinia();
  
  app.use(pinia);
  app.use(i18n);

  // 每个页面显示时重新应用导航栏标题（跟随语言）与导航栏配色（跟随深色模式）。
  // uni-app H5 每次进入新页面都会按 pages.json 重新渲染导航栏，
  // 不在 onShow 里重设的话，深色模式下导航栏会变回白色。
  const themeStore = useThemeStore(pinia);
  app.mixin({
    onShow() {
      applyNavigationTitle();
      themeStore.initTheme();
    },
  });

  // 应用启动时恢复登录态与主题，保证刷新后用户记录/错题本仍可用
  try {
    useUserStore(pinia).init();
    useThemeStore(pinia).initTheme();
    initNavigationTitles();
  } catch (e) {
    console.warn('[Bootstrap] 初始化用户/主题状态失败:', e);
  }
  
  return {
    app,
    pinia,
  };
}
