/**
 * 错误恢复工具
 * 
 * 提供错误恢复机制，包括重试、降级、回退等
 */

import { message, Modal } from 'antd';
import { handleError } from './errorHandler';

/**
 * 重试配置
 */
export interface RetryConfig {
  /**
   * 最大重试次数
   */
  maxRetries: number;
  /**
   * 重试延迟（毫秒）
   */
  retryDelay: number;
  /**
   * 是否使用指数退避
   */
  exponentialBackoff?: boolean;
  /**
   * 重试条件（返回 true 表示应该重试）
   */
  shouldRetry?: (error: any, attempt: number) => boolean;
  /**
   * 重试回调
   */
  onRetry?: (attempt: number, error: any) => void;
}

/**
 * 默认重试配置
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  exponentialBackoff: true,
  shouldRetry: (error: any) => {
    // 网络错误或服务器错误（502, 503, 504）可以重试
    const isNetworkError = error?.message?.includes('fetch') || 
                          error?.message?.includes('NetworkError') ||
                          error?.message?.includes('Failed to fetch');
    const isServerError = [502, 503, 504].includes(error?.response?.status);
    
    // 401 和 400 错误不重试
    if ([401, 400].includes(error?.response?.status)) {
      return false;
    }
    
    return isNetworkError || isServerError;
  },
};

/**
 * 带重试的函数执行
 * 
 * @param fn - 要执行的函数
 * @param config - 重试配置
 * @returns 执行结果
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: any;
  
  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // 检查是否应该重试
      if (finalConfig.shouldRetry && !finalConfig.shouldRetry(error, attempt)) {
        throw error;
      }
      
      // 如果已达到最大重试次数，抛出错误
      if (attempt >= finalConfig.maxRetries) {
        break;
      }
      
      // 计算重试延迟
      const delay = finalConfig.exponentialBackoff
        ? finalConfig.retryDelay * Math.pow(2, attempt)
        : finalConfig.retryDelay;
      
      // 调用重试回调
      if (finalConfig.onRetry) {
        finalConfig.onRetry(attempt + 1, error);
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * 错误恢复策略
 */
export enum ErrorRecoveryStrategy {
  /**
   * 重试
   */
  RETRY = 'retry',
  /**
   * 降级（使用缓存或默认值）
   */
  FALLBACK = 'fallback',
  /**
   * 忽略错误
   */
  IGNORE = 'ignore',
  /**
   * 显示错误并停止
   */
  FAIL = 'fail',
}

/**
 * 错误恢复配置
 */
export interface ErrorRecoveryConfig {
  /**
   * 恢复策略
   */
  strategy: ErrorRecoveryStrategy;
  /**
   * 降级值（当策略为 FALLBACK 时使用）
   */
  fallbackValue?: any;
  /**
   * 重试配置（当策略为 RETRY 时使用）
   */
  retryConfig?: Partial<RetryConfig>;
  /**
   * 错误消息（当策略为 FAIL 时使用）
   */
  errorMessage?: string;
}

/**
 * 带错误恢复的函数执行
 * 
 * @param fn - 要执行的函数
 * @param config - 错误恢复配置
 * @returns 执行结果或降级值
 */
export async function withErrorRecovery<T>(
  fn: () => Promise<T>,
  config: ErrorRecoveryConfig
): Promise<T | any> {
  try {
    if (config.strategy === ErrorRecoveryStrategy.RETRY) {
      return await withRetry(fn, config.retryConfig);
    }
    return await fn();
  } catch (error: any) {
    switch (config.strategy) {
      case ErrorRecoveryStrategy.FALLBACK:
        if (config.fallbackValue !== undefined) {
          message.warning('操作失败，已使用默认值');
          return config.fallbackValue;
        }
        throw error;
      
      case ErrorRecoveryStrategy.IGNORE:
        console.warn('错误已忽略:', error);
        return undefined;
      
      case ErrorRecoveryStrategy.FAIL:
        handleError(error, config.errorMessage || '操作失败');
        throw error;
      
      default:
        throw error;
    }
  }
}

/**
 * 网络错误恢复
 * 
 * 检测网络错误并提供恢复建议
 */
export function handleNetworkError(error: any): void {
  const isNetworkError = error?.message?.includes('fetch') || 
                        error?.message?.includes('NetworkError') ||
                        error?.message?.includes('Failed to fetch');
  
  if (isNetworkError) {
    Modal.error({
      title: '网络连接错误',
      content: '无法连接到服务器，请检查网络连接后重试。',
      okText: '重试',
      onOk: () => {
        window.location.reload();
      },
    });
  } else {
    handleError(error);
  }
}

/**
 * 服务器错误恢复
 * 
 * 检测服务器错误并提供恢复建议
 */
export function handleServerError(error: any): void {
  const status = error?.response?.status;
  
  if (status === 502 || status === 503 || status === 504) {
    Modal.warning({
      title: '服务器暂时不可用',
      content: '服务器正在维护或暂时不可用，请稍后重试。',
      okText: '重试',
      onOk: () => {
        window.location.reload();
      },
    });
  } else {
    handleError(error);
  }
}

