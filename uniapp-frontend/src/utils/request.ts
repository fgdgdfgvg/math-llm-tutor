import axios from 'axios';
import config, { getApiUrl } from '@/config';
import { clearSession } from '@/utils/session';

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

/**
 * 这些 URL 的 401 是"业务结论"而非"会话过期"，绝不能触发自动刷新：
 * - 登录：401 = 密码错误。若走刷新→重放，用户会看到"登录已过期"而不是
 *   "用户名或密码错误"，还会被误清会话（自检 P1-5 实证）。
 * - 注册：同理。
 * - 刷新/登出：它们自己就是会话管理端点，刷新它们没有意义。
 */
const SKIP_REFRESH_URLS = ['/user/login', '/user/register', '/auth/refresh', '/auth/logout'];

function shouldSkipRefresh(url?: string): boolean {
  if (!url) return false;
  return SKIP_REFRESH_URLS.some((path) => url.includes(path));
}

/** 登出跳转幂等：一次过期引发的 N 个并发失败请求，只跳一次登录页（自检 P2-6） */
let loggingOut = false;

function forceLogout() {
  if (loggingOut) return;
  loggingOut = true;
  cancelProactiveRefresh();
  clearSession();
  uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
  uni.reLaunch({
    url: '/pages/login/index',
    complete: () => {
      // 页面栈切换完成后复位，允许下一次正常登录-过期流程
      setTimeout(() => { loggingOut = false; }, 1000);
    },
  });
}

/** 提前刷新定时器：在 access token 过期前 60 秒静默续期，避免用户撞上 401（自检 P2-12） */
let proactiveTimer: ReturnType<typeof setTimeout> | null = null;

function cancelProactiveRefresh() {
  if (proactiveTimer) {
    clearTimeout(proactiveTimer);
    proactiveTimer = null;
  }
}

function scheduleProactiveRefresh(expiresInSeconds?: number) {
  cancelProactiveRefresh();
  if (!expiresInSeconds || expiresInSeconds <= 90) return;
  proactiveTimer = setTimeout(() => {
    proactiveTimer = null;
    refreshAccessToken().catch(() => {
      // 失败不处理：后续真实请求的 401 会走正常的强制登出流程
    });
  }, (expiresInSeconds - 60) * 1000);
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
      scheduleProactiveRefresh(pair.expires_in);
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
      // 登录/刷新成功会带回新的 access token：顺手启动"过期前提前续期"
      if (res.data?.access_token && typeof res.data?.expires_in === 'number') {
        scheduleProactiveRefresh(res.data.expires_in);
      }
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

    // 1) 401：先尝试用 refresh token 静默续期，成功则重放原请求。
    //    登录/注册/刷新等端点的 401 是业务结论，直接按失败处理（见上方注释）。
    if (status === 401 && !original._retry && !original._isRefreshCall && !shouldSkipRefresh(original.url)) {
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

    if (status === 401 && !shouldSkipRefresh(original.url)) {
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

export { getApiUrl, cancelProactiveRefresh };
export default request;
