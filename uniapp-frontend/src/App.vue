<template>
  <view class="app-container" :class="themeClass">
    <router-view />
  </view>
</template>

<script lang="ts">
import { useThemeStore } from '@/stores/theme';
import { useUserStore } from '@/stores/user';

export default {
  name: 'App',
  computed: {
    themeClass(): string {
      try {
        const themeStore = useThemeStore();
        return `theme-${themeStore.currentTheme}`;
      } catch {
        return 'theme-light';
      }
    },
  },
  onLaunch() {
    console.log('App Launch');
    try {
      // 恢复登录态（含从后端补齐用户信息）与主题
      useUserStore().init();
      useThemeStore().initTheme();

      // 默认入口页是登录页，因此“已登录却刷新页面”会退回登录页。
      // 这里在启动时把已登录用户送回家页，避免重复登录。
      const token = uni.getStorageSync('token');
      if (!token) {
        uni.reLaunch({ url: '/pages/login/index' });
        return;
      }

      setTimeout(() => {
        try {
          const pages = getCurrentPages();
          const route = (pages[pages.length - 1] as any)?.route || '';
          if (!route || route.includes('login')) {
            uni.reLaunch({ url: '/pages/index/index' });
          }
        } catch (e) {
          console.warn('Route restore failed:', e);
        }
      }, 50);
    } catch (e) {
      console.warn('Storage access error:', e);
    }
  },
  onShow() {
    console.log('App Show');
  },
  onHide() {
    console.log('App Hide');
  },
};
</script>

<style>
/* ===== 浅色主题（默认） ===== */
:root,
.theme-light,
html.theme-light,
body.theme-light,
uni-app.theme-light,
uni-page-body.theme-light {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f7fa;
  --bg-card: #ffffff;
  --text-primary: #1f2430;
  --text-secondary: #4a5162;
  --text-muted: #8a90a0;
  --border-color: #e6e9f0;
  --shadow-color: rgba(0, 0, 0, 0.12);
  --accent-color: #667eea;
  --accent-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --success-color: #2e9e4f;
  --warning-color: #e08c00;
  --error-color: #dc3545;
  --code-bg: #1e1e1e;
  --math-bg: #f8f9fa;
  --font-scale: 1;
  --base-font-size: 16px;
}

/* ===== 深色主题 ===== */
.theme-dark,
html.theme-dark,
body.theme-dark,
uni-app.theme-dark,
uni-page-body.theme-dark {
  --bg-primary: #14141f;
  --bg-secondary: #1c1c2b;
  --bg-card: #262637;
  --text-primary: #f2f3f7;
  --text-secondary: #c6c9d6;
  --text-muted: #9397a8;
  --border-color: #3a3a52;
  --shadow-color: rgba(0, 0, 0, 0.55);
  --accent-color: #8b95ff;
  --accent-gradient: linear-gradient(135deg, #5a63c9 0%, #6d3f96 100%);
  --success-color: #4cd07a;
  --warning-color: #ffb547;
  --error-color: #ff6b6b;
  --code-bg: #0d0d14;
  --math-bg: #1c1c2b;
}

.app-container {
  width: 100%;
  min-height: 100vh;
  background: var(--bg-secondary);
  color: var(--text-primary);
  transition: background 0.3s ease, color 0.3s ease;
  font-size: calc(var(--base-font-size) * var(--font-scale));
}

/* 让页面底色跟随主题（H5 下 page 会被编译为 uni-page-body） */
page,
html,
body,
uni-app,
uni-page-body {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

/* 深色模式下输入类控件的兜底，避免浏览器默认白底黑字 */
.theme-dark input,
.theme-dark textarea,
.theme-dark .uni-input-input {
  background: var(--bg-card);
  color: var(--text-primary);
}

/* 隐藏 Edge/IE 原生的密码显示按钮（自带的白色小方块会破坏暗色观感） */
input::-ms-reveal,
input::-ms-clear {
  display: none;
}
</style>
