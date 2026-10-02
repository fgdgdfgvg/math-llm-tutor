import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getApiUrl } from '@/config';
import { clearSession } from '@/utils/session';
import request, { cancelProactiveRefresh } from '@/utils/request';
import { useScenarioStore } from './scenario';

interface UserInfo {
  id: string;
  username: string;
  roles?: string[];
  createdAt?: string;
}

export const useUserStore = defineStore('user', () => {
  const token = ref<string>('');
  /** refresh token 仅用于调 /auth/refresh，不参与任何业务请求头 */
  const refreshToken = ref<string>('');
  const userInfo = ref<UserInfo | null>(null);
  const isLoggedIn = computed(() => !!token.value);

  /** 从本地存储恢复登录态（应用启动时调用） */
  const init = () => {
    const savedToken = uni.getStorageSync('token');
    const savedRefresh = uni.getStorageSync('refreshToken');
    const savedUserInfo = uni.getStorageSync('userInfo');
    if (savedToken) {
      token.value = savedToken;
    }
    if (savedRefresh) {
      refreshToken.value = savedRefresh;
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

  /**
   * 从后端拉取当前登录用户信息并落库。
   * 走统一的 request 客户端（而不是裸 uni.request）：这样 access token 过期时
   * 能自动静默续期并重放，不会因为一次 401 就把用户信息拉取静默失败。
   */
  const fetchProfile = async (): Promise<UserInfo | null> => {
    if (!token.value) return null;
    try {
      const profile = await request<any>({ url: '/user/profile', method: 'GET' });
      const payload = profile?.code === 200 ? profile.data : profile;
      if (payload?.username) {
        setUserInfo({
          id: String(payload.id || payload._id || payload.userId || ''),
          username: payload.username,
          roles: payload.roles,
          createdAt: payload.createdAt,
        });
        return userInfo.value;
      }
    } catch (e) {
      console.warn('[User] 拉取用户信息失败:', (e as Error)?.message || e);
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

  /** 登录成功后成对保存：只有同时保存 refresh token，15 分钟后的静默续期才可用 */
  const setTokens = (access: string, refresh?: string) => {
    setToken(access);
    if (refresh) {
      refreshToken.value = refresh;
      uni.setStorageSync('refreshToken', refresh);
    }
  };

  const setUserInfo = (info: UserInfo) => {
    userInfo.value = info;
    uni.setStorageSync('userInfo', JSON.stringify(info));
  };

  /**
   * 登出：先通知后端吊销 refresh token，再清本地。
   * 顺序很重要——先清本地就拿不到 refresh token，服务端会话会一直存活到自然过期，
   * 相当于"点了登出但令牌还能用"，这是本次改造要修掉的问题之一。
   * 后端调用失败不阻塞登出（网络不可用时也要能把本地状态清掉）。
   */
  const logout = async () => {
    const currentRefresh = refreshToken.value || uni.getStorageSync('refreshToken');
    const currentToken = token.value || uni.getStorageSync('token');
    try {
      if (currentRefresh) {
        await uni.request({
          url: getApiUrl('/auth/logout'),
          method: 'POST',
          header: { Authorization: `Bearer ${currentToken}`, 'Content-Type': 'application/json' },
          data: { refreshToken: currentRefresh },
        } as any);
      }
    } catch (e) {
      console.warn('[User] 服务端登出失败（已清理本地会话）:', (e as Error)?.message || '请求失败');
    }
    // 取消"过期前提前续期"定时器，避免登出后后台又换回新令牌
    cancelProactiveRefresh();
    // 清内存状态
    token.value = '';
    refreshToken.value = '';
    userInfo.value = null;
    // 清本地会话（含按账号隔离的学习进度，见 utils/session.ts）
    clearSession();
    // 清其他 store 的用户域内存数据（自检 P2-9：换账号后上一用户数据残留）
    const scenarioStore = useScenarioStore();
    scenarioStore.activeScenario = null;
    scenarioStore.scenarioProgress = {};
    scenarioStore.diagnosisResult = null;
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
    refreshToken,
    userInfo,
    isLoggedIn,
    init,
    fetchProfile,
    ensureUser,
    setToken,
    setTokens,
    setUserInfo,
    logout,
    checkLogin,
  };
});
