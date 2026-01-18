/**
 * 增强错误处理工具模块
 *
 * 提供更完善的错误提示和处理功能，包括错误分类、错误详情、错误解决建议等。
 *
 * @author Auto (AI Assistant)
 * @date 2026-01-27
 */

import { Modal, message, notification } from 'antd';
import { ExclamationCircleOutlined, CloseCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { handleError as baseHandleError } from './errorHandler';

/**
 * 错误类型
 */
export enum ErrorType {
  /** 验证错误 */
  VALIDATION = 'validation',
  /** 网络错误 */
  NETWORK = 'network',
  /** 权限错误 */
  PERMISSION = 'permission',
  /** 业务错误 */
  BUSINESS = 'business',
  /** 系统错误 */
  SYSTEM = 'system',
  /** 未知错误 */
  UNKNOWN = 'unknown',
}

/**
 * 错误级别
 */
export enum ErrorLevel {
  /** 信息 */
  INFO = 'info',
  /** 警告 */
  WARNING = 'warning',
  /** 错误 */
  ERROR = 'error',
  /** 严重错误 */
  CRITICAL = 'critical',
}

/**
 * 错误信息接口
 */
export interface EnhancedErrorInfo {
  /** 错误类型 */
  type: ErrorType;
  /** 错误级别 */
  level: ErrorLevel;
  /** 错误标题 */
  title: string;
  /** 错误消息 */
  message: string;
  /** 错误详情 */
  details?: string;
  /** 错误代码 */
  code?: string;
  /** 解决建议 */
  suggestions?: string[];
  /** 帮助文档链接 */
  helpLink?: string;
  /** 是否可重试 */
  retryable?: boolean;
  /** 重试函数 */
  onRetry?: () => void | Promise<void>;
}

/**
 * 错误分类器
 */
export class ErrorClassifier {
  /**
   * 分类错误
   */
  static classify(error: any): ErrorType {
    // 网络错误
    if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
      return ErrorType.NETWORK;
    }

    // 权限错误
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      return ErrorType.PERMISSION;
    }

    // 验证错误
    if (error?.response?.status === 400 || error?.response?.data?.detail) {
      return ErrorType.VALIDATION;
    }

    // 业务错误
    if (error?.response?.status === 422 || error?.response?.data?.error?.code) {
      return ErrorType.BUSINESS;
    }

    // 系统错误
    if (error?.response?.status >= 500) {
      return ErrorType.SYSTEM;
    }

    return ErrorType.UNKNOWN;
  }

  /**
   * 获取错误级别
   */
  static getLevel(type: ErrorType): ErrorLevel {
    switch (type) {
      case ErrorType.VALIDATION:
        return ErrorLevel.WARNING;
      case ErrorType.NETWORK:
        return ErrorLevel.WARNING;
      case ErrorType.PERMISSION:
        return ErrorLevel.ERROR;
      case ErrorType.BUSINESS:
        return ErrorLevel.ERROR;
      case ErrorType.SYSTEM:
        return ErrorLevel.CRITICAL;
      default:
        return ErrorLevel.ERROR;
    }
  }

  /**
   * 获取错误标题
   */
  static getTitle(type: ErrorType): string {
    const titles: Record<ErrorType, string> = {
      [ErrorType.VALIDATION]: '数据验证失败',
      [ErrorType.NETWORK]: '网络连接错误',
      [ErrorType.PERMISSION]: '权限不足',
      [ErrorType.BUSINESS]: '业务处理失败',
      [ErrorType.SYSTEM]: '系统错误',
      [ErrorType.UNKNOWN]: '操作失败',
    };
    return titles[type] || titles[ErrorType.UNKNOWN];
  }

  /**
   * 获取解决建议
   */
  static getSuggestions(type: ErrorType, error: any): string[] {
    const suggestions: string[] = [];

    switch (type) {
      case ErrorType.VALIDATION:
        suggestions.push('请检查输入的数据是否符合要求');
        suggestions.push('确保必填字段已填写');
        if (error?.response?.data?.detail) {
          const detail = error.response.data.detail;
          if (Array.isArray(detail)) {
            suggestions.push(`具体错误：${detail.map((e: any) => e.msg || e.message).join('、')}`);
          }
        }
        break;

      case ErrorType.NETWORK:
        suggestions.push('请检查网络连接是否正常');
        suggestions.push('尝试刷新页面或稍后重试');
        suggestions.push('如果问题持续，请联系技术支持');
        break;

      case ErrorType.PERMISSION:
        suggestions.push('您没有执行此操作的权限');
        suggestions.push('请联系管理员获取相应权限');
        break;

      case ErrorType.BUSINESS:
        suggestions.push('业务规则验证失败');
        suggestions.push('请检查业务数据是否符合要求');
        if (error?.response?.data?.error?.message) {
          suggestions.push(`详情：${error.response.data.error.message}`);
        }
        break;

      case ErrorType.SYSTEM:
        suggestions.push('系统出现错误，请稍后重试');
        suggestions.push('如果问题持续，请联系技术支持');
        suggestions.push('错误代码已记录，技术人员会尽快处理');
        break;

      default:
        suggestions.push('请稍后重试');
        suggestions.push('如果问题持续，请联系技术支持');
    }

    return suggestions;
  }
}

/**
 * 增强错误处理函数
 */
export function handleEnhancedError(
  error: any,
  options?: {
    defaultMessage?: string;
    showDetails?: boolean;
    showSuggestions?: boolean;
    showHelpLink?: boolean;
    onRetry?: () => void | Promise<void>;
  }
): EnhancedErrorInfo {
  const {
    defaultMessage = '操作失败',
    showDetails = true,
    showSuggestions = true,
    showHelpLink = true,
  } = options || {};

  // 分类错误
  const type = ErrorClassifier.classify(error);
  const level = ErrorClassifier.getLevel(type);
  const title = ErrorClassifier.getTitle(type);

  // 提取错误消息
  let errorMessage = defaultMessage;
  let errorDetails: string | undefined;
  let errorCode: string | undefined;

  if (error?.response?.data) {
    const errorData = error.response.data;

    // 统一错误格式
    if (errorData.success === false && errorData.error) {
      errorMessage = errorData.error.message || defaultMessage;
      errorDetails = errorData.error.details;
      errorCode = errorData.error.code;
    }
    // FastAPI 错误格式
    else if (errorData.detail) {
      if (Array.isArray(errorData.detail)) {
        errorMessage = errorData.detail.map((e: any) => e.msg || e.message).join('、');
        errorDetails = errorData.detail.map((e: any) => JSON.stringify(e)).join('\n');
      } else {
        errorMessage = errorData.detail;
      }
    }
    // 其他格式
    else {
      errorMessage = errorData.message || errorData.error || defaultMessage;
    }
  } else if (error instanceof Error) {
    errorMessage = error.message || defaultMessage;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }

  // 获取解决建议
  const suggestions = showSuggestions ? ErrorClassifier.getSuggestions(type, error) : undefined;

  // 构建错误信息
  const errorInfo: EnhancedErrorInfo = {
    type,
    level,
    title,
    message: errorMessage,
    details: showDetails ? errorDetails : undefined,
    code: errorCode,
    suggestions,
    helpLink: showHelpLink ? getHelpLink(type) : undefined,
    retryable: type === ErrorType.NETWORK || type === ErrorType.SYSTEM,
    onRetry: options?.onRetry,
  };

  return errorInfo;
}

/**
 * 显示增强错误提示
 */
export function showEnhancedError(
  error: any,
  options?: {
    defaultMessage?: string;
    showDetails?: boolean;
    showSuggestions?: boolean;
    showHelpLink?: boolean;
    onRetry?: () => void | Promise<void>;
  }
): void {
  const errorInfo = handleEnhancedError(error, options);

  // 根据错误级别选择不同的提示方式
  switch (errorInfo.level) {
    case ErrorLevel.INFO:
      notification.info({
        message: errorInfo.title,
        description: errorInfo.message,
        icon: <InfoCircleOutlined style={{ color: '#1890ff' }} />,
        duration: 4.5,
      });
      break;

    case ErrorLevel.WARNING:
      notification.warning({
        message: errorInfo.title,
        description: errorInfo.message,
        icon: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
        duration: 4.5,
      });
      break;

    case ErrorLevel.ERROR:
      notification.error({
        message: errorInfo.title,
        description: errorInfo.message,
        icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
        duration: 5,
      });
      break;

    case ErrorLevel.CRITICAL:
      Modal.error({
        title: errorInfo.title,
        content: (
          <div>
            <p>{errorInfo.message}</p>
            {errorInfo.suggestions && errorInfo.suggestions.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontWeight: 'bold', marginBottom: 8 }}>解决建议：</p>
                <ul style={{ marginLeft: 20 }}>
                  {errorInfo.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
            {errorInfo.helpLink && (
              <p style={{ marginTop: 16 }}>
                <a href={errorInfo.helpLink} target="_blank" rel="noopener noreferrer">
                  查看帮助文档
                </a>
              </p>
            )}
          </div>
        ),
        width: 600,
        okText: errorInfo.retryable && errorInfo.onRetry ? '重试' : '确定',
        onOk: errorInfo.retryable && errorInfo.onRetry ? errorInfo.onRetry : undefined,
      });
      break;

    default:
      message.error(errorInfo.message);
  }
}

/**
 * 获取帮助文档链接
 */
function getHelpLink(type: ErrorType): string | undefined {
  const helpLinks: Record<ErrorType, string> = {
    [ErrorType.VALIDATION]: '/help/validation-errors',
    [ErrorType.NETWORK]: '/help/network-errors',
    [ErrorType.PERMISSION]: '/help/permission-errors',
    [ErrorType.BUSINESS]: '/help/business-errors',
    [ErrorType.SYSTEM]: '/help/system-errors',
    [ErrorType.UNKNOWN]: '/help/common-errors',
  };
  return helpLinks[type];
}

/**
 * 统一错误处理（增强版）
 */
export function handleError(
  error: any,
  defaultMessage: string = '操作失败',
  options?: {
    showDetails?: boolean;
    showSuggestions?: boolean;
    showHelpLink?: boolean;
    onRetry?: () => void | Promise<void>;
  }
): string {
  // 使用增强错误处理
  const errorInfo = handleEnhancedError(error, {
    defaultMessage,
    ...options,
  });

  // 显示错误提示
  showEnhancedError(error, {
    defaultMessage,
    ...options,
  });

  return errorInfo.message;
}
