import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getApiUrl } from '@/config';

interface UserInfo {
  id: string;
  username: string;
  roles?: string[];
  createdAt?: string;
}

export const useUserStore = defineStore('user', () => {
  const token = ref<string>('');
  const userInfo = ref<UserInfo | null>(null);
  const isLoggedIn = computed(() => !!token.value);

  /** 从本地存储恢复登录态（应用启动时调用） */
  const init = () => {
    const savedToken = uni.getStorageSync('token');
    const savedUserInfo = uni.getStorageSync('userInfo');
    if (savedToken) {
      token.value = savedToken;
    }
    if (savedUserInfo) {
      try {
        userInfo.value = typeof savedUserInfo === 'string' ? JSON.parse(savedUserInfo) : savedUserInfo;
      } catch (e) {
        userInfo.value = null;
      }
    }
    // 有 token 但没有用户信息时，主动向后端拉取，保证“用户记录”始终可用
    if (token.value && !userInfo.value?.username) {
      void fetchProfile();
    }
  };

  /** 从后端拉取当前登录用户信息并落库 */
  const fetchProfile = async (): Promise<UserInfo | null> => {
    if (!token.value) return null;
    try {
      const res = await uni.request({
        url: getApiUrl('/user/profile'),
        method: 'GET',
        header: { Authorization: `Bearer ${token.value}` },
      } as any);
      const body: any = (res as any).data ?? res;
      const profile = body?.code === 200 ? body.data : body;
      if (profile?.username) {
        setUserInfo({
          id: String(profile.id || profile._id || profile.userId || ''),
          username: profile.username,
          roles: profile.roles,
          createdAt: profile.createdAt,
        });
        return userInfo.value;
      }
    } catch (e) {
      console.warn('[User] 拉取用户信息失败:', e);
    }
    return null;
  };

  /** 只等到拿到 username 为止（页面写记录前调用） */
  const ensureUser = async (): Promise<UserInfo | null> => {
    if (userInfo.value?.username) return userInfo.value;
    if (!token.value) {
      const saved = uni.getStorageSync('userInfo');
      if (saved) {
        try {
          userInfo.value = typeof saved === 'string' ? JSON.parse(saved) : saved;
        } catch {
          userInfo.value = null;
        }
      }
    }
    if (userInfo.value?.username) return userInfo.value;
    return fetchProfile();
  };

  const setToken = (newToken: string) => {
    token.value = newToken;
    uni.setStorageSync('token', newToken);
  };

  const setUserInfo = (info: UserInfo) => {
    userInfo.value = info;
    uni.setStorageSync('userInfo', JSON.stringify(info));
  };

  const logout = () => {
    token.value = '';
    userInfo.value = null;
    uni.removeStorageSync('token');
    uni.removeStorageSync('userInfo');
    uni.reLaunch({ url: '/pages/login/index' });
  };

  const checkLogin = (): boolean => {
    if (!token.value) {
      uni.showToast({
        title: 'Please login first',
        icon: 'none',
      });
      uni.navigateTo({ url: '/pages/login/index' });
      return false;
    }
    return true;
  };

  return {
    token,
    userInfo,
    isLoggedIn,
    init,
    fetchProfile,
    ensureUser,
    setToken,
    setUserInfo,
    logout,
    checkLogin,
  };
});
