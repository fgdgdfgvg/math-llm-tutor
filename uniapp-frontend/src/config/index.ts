export interface AppConfig {
  apiBaseUrl: string;
  sympyServiceUrl: string;
  wsBaseUrl: string;
  appVersion: string;
  simpleTexApiUrl: string;
  simpleTexApiKey: string;
  simpleTexApiKeyId: string;
}

const config: AppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  sympyServiceUrl: import.meta.env.VITE_SYMPY_URL || 'http://localhost:8000',
  wsBaseUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:3000',
  appVersion: '1.0.0',
  simpleTexApiUrl: import.meta.env.VITE_SIMPLETEX_API_URL || 'https://server.simpletex.cn/api/simpletex_ocr',
  simpleTexApiKey: import.meta.env.VITE_SIMPLETEX_API_KEY || '',
  simpleTexApiKeyId: import.meta.env.VITE_SIMPLETEX_API_KEY_ID || '',
};

export const getApiUrl = (path: string): string => {
  const base = config.apiBaseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

export const getSymPyUrl = (path: string): string => {
  const base = config.sympyServiceUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

export default config;
