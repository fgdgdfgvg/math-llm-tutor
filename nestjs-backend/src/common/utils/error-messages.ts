export function toUserFriendlyError(error: any): {
  statusCode: number;
  message: string;
  originalError?: string;
} {
  const message = error?.message || error?.toString() || '未知错误';

  if (typeof message !== 'string') {
    return { statusCode: 500, message: '服务器内部错误，请稍后重试' };
  }

  const lower = message.toLowerCase();

  if (lower.includes('status code 401') || lower.includes('unauthorized')) {
    return {
      statusCode: 502,
      message: 'AI模型认证失败，请检查API密钥配置。如需帮助，请联系管理员。',
      originalError: message,
    };
  }

  if (
    lower.includes('status code 429') ||
    lower.includes('too many requests')
  ) {
    return {
      statusCode: 503,
      message: 'AI模型请求过于频繁，请稍等片刻后再试。',
      originalError: message,
    };
  }

  if (lower.includes('status code 404') || lower.includes('not found')) {
    return {
      statusCode: 502,
      message: 'AI模型服务暂不可用，请检查模型endpoint配置。',
      originalError: message,
    };
  }

  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound')
  ) {
    return {
      statusCode: 504,
      message: 'AI模型响应超时，请检查网络连接后重试。',
      originalError: message,
    };
  }

  if (
    lower.includes('not configured') ||
    lower.includes('api key') ||
    lower.includes('configuration incomplete')
  ) {
    return {
      statusCode: 503,
      message: 'AI模型未正确配置，请联系管理员设置API密钥。',
      originalError: message,
    };
  }

  if (lower.includes('neo4j') || lower.includes('not available')) {
    return {
      statusCode: 503,
      message: '知识图谱服务暂不可用，系统将使用备用模式运行。',
      originalError: message,
    };
  }

  if (
    lower.includes('validation') ||
    lower.includes('is not valid') ||
    lower.includes('invalid')
  ) {
    return {
      statusCode: 400,
      message: '输入格式不正确，请检查后重试。',
      originalError: message,
    };
  }

  return {
    statusCode: 500,
    message: '服务器处理请求时遇到问题，请稍后重试。如问题持续，请联系管理员。',
    originalError: message,
  };
}
