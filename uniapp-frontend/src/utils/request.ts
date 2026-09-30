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
  (error) => {
    const status = error.response?.status;
    // NestJS 的参数校验错误 message 是数组，直接丢给 toast 会变成
    // “Expected String ... got Array”这种无意义的提示，这里统一压平成文本。
    const rawMessage = error.response?.data?.message;
    const message =
      (Array.isArray(rawMessage) ? rawMessage.join('; ') : rawMessage) ||
      error.message ||
      'Network error';
    
    if (status === 401) {
      uni.showToast({
        title: '登录已过期，请重新登录',
        icon: 'none',
      });
      // 清除本地存储的登录信息
      uni.removeStorageSync('token');
      uni.removeStorageSync('userInfo');
      // 跳转到登录页面
      uni.reLaunch({ url: '/pages/login/index' });
    } else {
      uni.showToast({
        title: message,
        icon: 'none',
      });
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
