import axios from 'axios';
import config, { getApiUrl } from '@/config';

const service = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 180000,
});

service.interceptors.request.use(
  (config) => {
    const token = uni.getStorageSync('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * 401 刷新单例锁。
 *
 * access token 只有 15 分钟，页面并发请求会同时撞上过期。
 * 若不加以收敛，每个请求都会各自去调 /auth/refresh：
 * 第一次成功换发后旧 refresh token 已被标记使用，
 * 其余并发请求再用同一个旧值就会被"重用检测"判定为令牌泄露，
 * 直接把整个会话吊销 —— 表现为用户莫名其妙被踢下线。
 * 这里让所有并发请求共享同一个刷新 Promise（single-flight）。
 */
let refreshFlight: Promise<string> | null = null;

function clearSession() {
  uni.removeStorageSync('token');
  uni.removeStorageSync('refreshToken');
  uni.removeStorageSync('userInfo');
}

function forceLogout() {
  clearSession();
  uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
  uni.reLaunch({ url: '/pages/login/index' });
}

async function refreshAccessToken(): Promise<string> {
  if (!refreshFlight) {
    refreshFlight = (async () => {
      const refreshToken = uni.getStorageSync('refreshToken');
      if (!refreshToken) throw new Error('no-refresh-token');
      const res = await axios.post(
        getApiUrl('/auth/refresh'),
        { refreshToken },
        { timeout: 15000 },
      );
      const body: any = res.data;
      const pair = body?.code === 200 ? body.data : body;
      if (!pair?.access_token) throw new Error('refresh-failed');
      uni.setStorageSync('token', pair.access_token);
      if (pair.refresh_token) uni.setStorageSync('refreshToken', pair.refresh_token);
      return pair.access_token as string;
    })().finally(() => {
      refreshFlight = null;
    });
  }
  return refreshFlight;
}

/** 判断是否值得自动重试：只对幂等请求重试，POST 重试可能造成重复写入 */
function shouldRetry(config: any, error: any): boolean {
  if (config?.method?.toUpperCase() !== 'GET') return false;
  const status = error?.response?.status;
  // 5xx 与网络错误才重试；4xx 是客户端问题，重试无意义
  if (status === undefined) return true;
  return status >= 500;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

service.interceptors.response.use(
  (response) => {
    const res = response.data;
    if (res.code === 200) {
      return res.data;
    }
    if (res.statusCode && res.statusCode !== 200) {
      uni.showToast({
        title: res.message || 'Request failed',
        icon: 'none',
      });
      return Promise.reject(new Error(res.message || 'Request failed'));
    }
    return res;
  },
  async (error) => {
    const status = error.response?.status;
    // NestJS 的参数校验错误 message 是数组，直接丢给 toast 会变成
    // “Expected String ... got Array”这种无意义的提示，这里统一压平成文本。
    const rawMessage = error.response?.data?.message;
    const message =
      (Array.isArray(rawMessage) ? rawMessage.join('; ') : rawMessage) ||
      error.message ||
      'Network error';

    const original = error.config || {};

    // 1) 401：先尝试用 refresh token 静默续期，成功则重放原请求
    if (status === 401 && !original._retry && !original._isRefreshCall) {
      original._retry = true;
      try {
        const newToken = await refreshAccessToken();
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newToken}` };
        return service(original);
      } catch {
        // 刷新失败（refresh 过期/被吊销/令牌族已失效）才真正登出
        forceLogout();
        const err: any = new Error('登录已过期，请重新登录');
        err.status = 401;
        return Promise.reject(err);
      }
    }

    // 2) 5xx / 网络错误：幂等 GET 指数退避重试，最多 2 次
    const retryCount = original._retryCount || 0;
    if (retryCount < 2 && shouldRetry(original, error)) {
      original._retryCount = retryCount + 1;
      await sleep(300 * Math.pow(2, retryCount));
      return service(original);
    }

    // 3) 完全拿不到响应：判定为离线，给出与"服务器报错"不同的提示
    if (!error.response) {
      uni.showToast({ title: '网络连接不可用，请检查网络', icon: 'none' });
      error.status = status;
      error.message = '网络错误';
      return Promise.reject(error);
    }

    if (status === 401) {
      forceLogout();
    } else {
      uni.showToast({ title: message, icon: 'none' });
    }

    error.status = status;
    error.message = message;
    return Promise.reject(error);
  }
);

interface RequestConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  params?: any;
  headers?: any;
}

const request = <T = any>(config: RequestConfig): Promise<T> => {
  return service({
    url: config.url,
    method: config.method || 'GET',
    data: config.data,
    params: config.params,
    headers: config.headers,
  }) as Promise<T>;
};

export { getApiUrl };
export default request;
