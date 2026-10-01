<template>
  <view class="login-container">
    <view class="top-bar">
      <view class="language-switch">
        <view 
          class="lang-btn" 
          :class="{ 'active': currentLang === 'zh-CN' }" 
          @click="switchLanguage('zh-CN')"
        >
          中文
        </view>
        <view 
          class="lang-btn" 
          :class="{ 'active': currentLang === 'en-US' }" 
          @click="switchLanguage('en-US')"
        >
          EN
        </view>
      </view>
    </view>

    <view class="login-header">
      <view class="logo-container">
        <text class="logo-icon">📐</text>
      </view>
      <text class="app-title">{{ $t('login.title') }}</text>
      <text class="app-subtitle">{{ $t('login.subtitle') }}</text>
    </view>

    <view class="login-form">
      <view class="form-item">
        <text class="form-label">{{ $t('login.username') }}</text>
        <input 
          class="form-input" 
          v-model="username" 
          :placeholder="$t('login.usernamePlaceholder')"
          placeholder-style="color: #8a90a0"
          :maxlength="20"
        />
      </view>

      <view class="form-item">
        <text class="form-label">{{ $t('login.password') }}</text>
        <view class="password-wrapper">
          <input 
            class="form-input password-input" 
            v-model="password" 
            :type="showPassword ? 'text' : 'password'" 
            :placeholder="$t('login.passwordPlaceholder')"
            placeholder-style="color: #8a90a0"
            :maxlength="32"
          />
          <text class="password-toggle" @click="showPassword = !showPassword">
            {{ showPassword ? '🙈' : '👁️' }}
          </text>
        </view>
      </view>

      <view class="button-group">
        <button class="login-btn" @click="handleLogin" :loading="loginLoading">
          {{ loginLoading ? $t('login.loggingIn') : $t('login.login') }}
        </button>
        <button class="register-btn" @click="handleRegister" :loading="registerLoading">
          {{ registerLoading ? $t('login.registering') : $t('login.register') }}
        </button>
      </view>
    </view>

    <view class="login-footer">
      <text class="footer-text">{{ $t('login.terms') }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import request from '@/utils/request';
import { useUserStore } from '@/stores/user';
import { setLocale } from '@/i18n';

const { t, locale } = useI18n();
const userStore = useUserStore();

const username = ref('');
const password = ref('');
const showPassword = ref(false);
const loginLoading = ref(false);
const registerLoading = ref(false);

const currentLang = computed(() => locale.value);

const switchLanguage = (lang: string) => {
  setLocale(lang);
  uni.showToast({ title: lang === 'zh-CN' ? '已切换为中文' : 'Switched to English', icon: 'none' });
};

const showToast = (title: string) => {
  uni.showToast({ title, icon: 'none' });
};

const handleLogin = async () => {
  if (!username.value.trim()) {
    showToast(t('login.usernameRequired'));
    return;
  }
  if (!password.value) {
    showToast(t('login.passwordRequired'));
    return;
  }

  loginLoading.value = true;
  try {
    // 不要把 password 打进控制台日志：小程序/H5 的调试日志容易被截图或导出，
    // 等同把明文凭据留在设备上。只记录用户名即可定位问题。
    console.log('Login request:', { username: username.value.trim() });
    const response = await request({
      url: '/user/login',
      method: 'POST',
      data: {
        username: username.value.trim(),
        password: password.value,
      },
    });
    // 不要把整个响应（含令牌）打进日志
    if (response.access_token) {
      // 必须成对保存：缺了 refresh token，15 分钟后就无法静默续期，只能重新登录
      userStore.setTokens(response.access_token, response.refresh_token);
      if (response.user) {
        userStore.setUserInfo(response.user);
      }
      showToast(t('login.loginSuccess'));
      uni.redirectTo({ url: '/pages/index/index' });
    } else {
      console.error('No access_token in response:', response);
      showToast(t('login.loginFailed'));
    }
  } catch (error: any) {
    console.error('Login failed:', error);
    showToast(t('login.loginFailed'));
  } finally {
    loginLoading.value = false;
  }
};

const handleRegister = async () => {
  if (!username.value.trim()) {
    showToast(t('login.usernameRequired'));
    return;
  }
  if (!password.value) {
    showToast(t('login.passwordRequired'));
    return;
  }
  if (password.value.length < 6) {
    showToast(t('login.passwordMinLength'));
    return;
  }

  registerLoading.value = true;
  try {
    console.log('Register request:', { username: username.value.trim() });
    const registerResponse = await request({
      url: '/user/register',
      method: 'POST',
      data: {
        username: username.value.trim(),
        password: password.value,
      },
    });
    console.log('Register response:', registerResponse);
    
    showToast(t('login.registerSuccess'));
    
    console.log('Login after register request:', { username: username.value.trim() });
    const loginResponse = await request({
      url: '/user/login',
      method: 'POST',
      data: {
        username: username.value.trim(),
        password: password.value,
      },
    });
    if (loginResponse.access_token) {
      userStore.setTokens(loginResponse.access_token, loginResponse.refresh_token);
      if (loginResponse.user) {
        userStore.setUserInfo(loginResponse.user);
      }
      showToast(t('login.loginSuccess'));
      uni.reLaunch({ url: '/pages/index/index' });
    } else {
      console.error('No access_token in login response:', loginResponse);
      showToast(t('login.loginFailed'));
    }
  } catch (error: any) {
    console.error('Registration failed:', error);
    if (error.status === 409) {
      showToast(t('login.usernameExists'));
    } else {
      showToast(t('login.registerFailed'));
    }
  } finally {
    registerLoading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  background: var(--accent-gradient);
  padding: 20px 24px 40px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow-x: hidden;
}

/* 语言切换跟随文档流，不再绝对定位，窄屏也不会溢出屏幕 */
.top-bar {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-height: 36px;
  flex-shrink: 0;
}

.language-switch {
  display: flex;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 3px;
  max-width: 100%;
}

.lang-btn {
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.2;
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
  transition: all 0.3s ease;
}

.lang-btn.active {
  background: white;
  color: #5a63c9;
  font-weight: bold;
}

.login-header {
  text-align: center;
  margin-bottom: 40px;
  margin-top: 30px;
}

.logo-container {
  width: 80px;
  height: 80px;
  background: white;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.logo-icon {
  font-size: 40px;
}

.app-title {
  font-size: 28px;
  font-weight: bold;
  color: #ffffff;
  display: block;
  margin-bottom: 8px;
}

.app-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  display: block;
}

.login-form {
  background: var(--bg-card);
  border-radius: 20px;
  padding: 30px 25px;
  box-shadow: 0 10px 40px var(--shadow-color);
  transition: background 0.3s ease;
}

.form-item {
  margin-bottom: 25px;
}

.form-label {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  margin-bottom: 10px;
  display: block;
}

.form-input {
  width: 100%;
  height: 50px;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 0 15px;
  font-size: 16px;
  box-sizing: border-box;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: border-color 0.3s, background 0.3s, color 0.3s;
}

.form-input:focus {
  border-color: var(--accent-color);
}

.password-wrapper {
  position: relative;
}

.password-input {
  padding-right: 50px;
}

.password-toggle {
  position: absolute;
  right: 15px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
}

.button-group {
  display: flex;
  gap: 15px;
  margin-top: 30px;
}

.login-btn, .register-btn {
  flex: 1;
  height: 50px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  border: none;
}

.login-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
}

.register-btn {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.login-footer {
  text-align: center;
  margin-top: 40px;
}

.footer-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}
</style>
