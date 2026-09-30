<template>
  <view class="theme-provider" :class="themeClass">
    <slot></slot>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useThemeStore } from '@/stores/theme';

const themeStore = useThemeStore();
const themeClass = computed(() => `theme-${themeStore.currentTheme}`);

onMounted(() => {
  themeStore.initTheme();
});
</script>

<style>
.theme-light {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f7fa;
  --bg-card: #ffffff;
  --text-primary: #333333;
  --text-secondary: #666666;
  --text-muted: #999999;
  --border-color: #eeeeee;
  --shadow-color: rgba(0, 0, 0, 0.1);
  --accent-color: #667eea;
  --accent-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --success-color: #4caf50;
  --warning-color: #ff9800;
  --error-color: #f44336;
  --code-bg: #1e1e1e;
  --math-bg: #f8f9fa;
  --font-scale: 1;
  --base-font-size: 16px;
}

.theme-dark {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --bg-card: #0f3460;
  --text-primary: #e8e8e8;
  --text-secondary: #b8b8b8;
  --text-muted: #888888;
  --border-color: #2d2d44;
  --shadow-color: rgba(0, 0, 0, 0.3);
  --accent-color: #667eea;
  --accent-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --success-color: #4caf50;
  --warning-color: #ff9800;
  --error-color: #f44336;
  --code-bg: #0d0d0d;
  --math-bg: #1a1a2e;
  --font-scale: 1;
  --base-font-size: 16px;
}

.theme-provider {
  min-height: 100vh;
  background: var(--bg-secondary);
  color: var(--text-primary);
  transition: background 0.3s ease, color 0.3s ease;
  font-size: calc(var(--base-font-size) * var(--font-scale));
}
</style>
