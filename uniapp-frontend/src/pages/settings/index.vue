<template>
  <view class="settings-container">
    <view class="settings-header">
      <text class="header-title">{{ $t('settings.title') }}</text>
    </view>

    <view class="settings-section">
      <text class="section-title">{{ $t('settings.appearance') }}</text>
      
      <view class="setting-item">
        <view class="setting-info">
          <text class="setting-name">{{ $t('settings.themeMode') }}</text>
          <text class="setting-desc">{{ $t('settings.themeModeDesc') }}</text>
        </view>
        <view class="theme-options">
          <view 
            v-for="option in themeOptions" 
            :key="option.value"
            class="theme-option"
            :class="{ 'option-active': themeStore.themeMode === option.value }"
            @click="setThemeMode(option.value)"
          >
            <view class="option-icon">{{ option.icon }}</view>
            <text class="option-label">{{ $t(`settings.${option.value}`) }}</text>
          </view>
        </view>
      </view>

      <view class="setting-item">
        <view class="setting-info">
          <text class="setting-name">{{ $t('settings.quickSwitch') }}</text>
          <text class="setting-desc">{{ $t('settings.quickSwitchDesc') }}</text>
        </view>
        <view class="switch-btn" :class="{ 'switch-dark': isDark }" @click="toggleTheme">
          <view class="switch-icon">{{ isDark ? '🌙' : '☀️' }}</view>
          <text class="switch-label">{{ isDark ? $t('settings.dark') : $t('settings.light') }}</text>
        </view>
      </view>
    </view>

    <view class="settings-section">
      <text class="section-title">{{ $t('settings.serviceStatus') }}</text>
      
      <ServiceStatusPanel />
    </view>

    <view class="settings-section">
      <text class="section-title">{{ $t('settings.display') }}</text>
      
      <view class="setting-item">
        <view class="setting-info">
          <text class="setting-name">{{ $t('settings.language') }}</text>
          <text class="setting-desc">{{ $t('settings.languageDesc') }}</text>
        </view>
        <picker mode="selector" :range="languages" range-key="label" @change="onLanguageChange">
          <view class="picker-value">{{ currentLanguageLabel }}</view>
        </picker>
      </view>

      <view class="setting-item">
        <view class="setting-info">
          <text class="setting-name">{{ $t('settings.fontSize') }}</text>
          <text class="setting-desc">{{ $t('settings.fontSizeDesc') }}</text>
        </view>
        <picker mode="selector" :range="fontSizes" range-key="label" @change="onFontSizeChange">
          <view class="picker-value">{{ currentFontSizeLabel }}</view>
        </picker>
      </view>

      <view class="setting-item">
        <view class="setting-info">
          <text class="setting-name">{{ $t('settings.autoSaveHistory') }}</text>
          <text class="setting-desc">{{ $t('settings.autoSaveHistoryDesc') }}</text>
        </view>
        <switch :checked="autoSaveHistory" @change="onAutoSaveChange" />
      </view>
    </view>

    <view class="settings-section">
      <text class="section-title">{{ $t('settings.data') }}</text>
      
      <view class="setting-item" @click="clearCache">
        <view class="setting-info">
          <text class="setting-name">{{ $t('settings.clearCache') }}</text>
          <text class="setting-desc">{{ $t('settings.clearCacheDesc') }}</text>
        </view>
        <text class="setting-arrow">></text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useThemeStore } from '@/stores/theme';
import type { ThemeMode } from '@/stores/theme';
import { setLocale } from '@/i18n';
import ServiceStatusPanel from '@/components/ServiceStatusPanel.vue';

const { t, locale } = useI18n();
const themeStore = useThemeStore();

const themeOptions = [
  { value: 'light' as ThemeMode, icon: '☀️' },
  { value: 'dark' as ThemeMode, icon: '🌙' },
  { value: 'auto' as ThemeMode, icon: '🔄' },
];

const languages = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English' },
];

const fontSizes = [
  { value: 'small', labelKey: 'settings.small' },
  { value: 'medium', labelKey: 'settings.medium' },
  { value: 'large', labelKey: 'settings.large' },
];

const isDark = computed(() => themeStore.currentTheme === 'dark');

const settings = ref({
  language: 'zh-CN',
  fontSize: 'medium',
  autoSaveHistory: true,
});

const currentLanguageLabel = computed(() => {
  const lang = languages.find(l => l.value === settings.value.language);
  return lang ? lang.label : '简体中文';
});

const currentFontSizeLabel = computed(() => {
  const size = fontSizes.find(s => s.value === settings.value.fontSize);
  return size ? t(size.labelKey) : t('settings.medium');
});

const autoSaveHistory = computed(() => settings.value.autoSaveHistory);

const loadSettings = () => {
  const savedSettings = uni.getStorageSync('appSettings');
  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings);
      settings.value = { ...settings.value, ...parsed };
    } catch {
      console.error('Failed to parse settings');
    }
  }
};

const saveSettings = () => {
  uni.setStorageSync('appSettings', JSON.stringify(settings.value));
};

const setThemeMode = (mode: ThemeMode) => {
  themeStore.setTheme(mode);
  uni.showToast({ title: t('settings.themeChanged'), icon: 'success' });
};

const toggleTheme = () => {
  themeStore.toggleTheme();
};

const onLanguageChange = (e: any) => {
  const index = e.detail.value;
  const newLang = languages[index].value;
  settings.value.language = newLang;
  setLocale(newLang);
  saveSettings();
  uni.showToast({ title: t('settings.languageChanged'), icon: 'success' });
};

const onFontSizeChange = (e: any) => {
  const index = e.detail.value;
  settings.value.fontSize = fontSizes[index].value;
  saveSettings();
  uni.showToast({ title: t('settings.fontSizeChanged'), icon: 'success' });
};

const onAutoSaveChange = (e: any) => {
  settings.value.autoSaveHistory = e.detail.value;
  saveSettings();
};

const clearCache = () => {
  uni.showModal({
    title: t('common.confirm'),
    content: t('settings.clearCacheConfirm'),
    success: (res) => {
      if (res.confirm) {
        uni.clearStorageSync();
        settings.value = {
          language: 'zh-CN',
          fontSize: 'medium',
          autoSaveHistory: true,
        };
        themeStore.setTheme('light');
        setLocale('zh-CN');
        uni.showToast({ title: t('settings.cacheCleared'), icon: 'success' });
      }
    },
  });
};

onMounted(() => {
  themeStore.initTheme();
  loadSettings();
});
</script>

<style scoped>
.settings-container {
  min-height: 100vh;
  background: var(--bg-secondary);
  padding: 20px;
}

.settings-header {
  text-align: center;
  padding: 20px 0;
  background: var(--accent-gradient);
  color: white;
  border-radius: 16px;
  margin-bottom: 20px;
}

.header-title {
  font-size: 24px;
  font-weight: bold;
}

.settings-section {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px var(--shadow-color);
}

.section-title {
  font-size: 18px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 15px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 0;
  border-bottom: 1px solid var(--border-color);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-info {
  flex: 1;
}

/* uni-app H5 下 <text> 默认行内，设置项名称与说明会挤在同一行 */
.setting-name {
  display: block;
  font-size: 16px;
  color: var(--text-primary);
}

.setting-desc {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.theme-options {
  display: flex;
  gap: 10px;
}

.theme-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 15px 10px;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.theme-option.option-active {
  border-color: var(--accent-color);
  background: var(--accent-gradient);
  color: white;
}

.option-icon {
  font-size: 24px;
  margin-bottom: 5px;
}

.option-label {
  font-size: 12px;
}

.switch-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 15px;
  background: var(--bg-card);
  border-radius: 12px;
  box-shadow: 0 2px 8px var(--shadow-color);
}

.switch-btn.switch-dark {
  background: #1a1a2e;
  color: white;
}

.switch-icon {
  font-size: 24px;
  margin-right: 10px;
}

.switch-label {
  font-size: 16px;
  font-weight: bold;
}

.picker-value {
  padding: 8px 15px;
  background: var(--bg-secondary);
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.setting-arrow {
  color: var(--text-muted);
  font-size: 18px;
}
</style>