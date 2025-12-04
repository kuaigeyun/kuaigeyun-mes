/**
 * 统一错误处理工具
 * 
 * 提供统一的错误处理函数，确保所有错误都按照统一格式处理。
 */

import { message } from 'antd';

/**
 * 错误响应接口
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

/**
 * 统一错误处理函数
 * 
 * @param error - 错误对象
 * @param defaultMessage - 默认错误消息
 * @returns 错误消息字符串
 */
export function handleError(error: any, defaultMessage: string = '操作失败'): string {
  // 如果是 ErrorResponse 格式
  if (error?.response?.data) {
    const errorData = error.response.data;
    
    // 统一错误格式 { success: false, error: { code, message, details } }
    if (errorData.success === false && errorData.error) {
      const errorMessage = errorData.error.message || defaultMessage;
      message.error(errorMessage);
      return errorMessage;
    }
    
    // FastAPI 错误格式 { detail: ... }
    if (errorData.detail) {
      const errorMessage = Array.isArray(errorData.detail)
        ? errorData.detail.map((e: any) => e.msg || e.message).join(', ')
        : errorData.detail;
      message.error(errorMessage);
      return errorMessage;
    }
    
    // 其他格式
    const errorMessage = errorData.message || errorData.error || defaultMessage;
    message.error(errorMessage);
    return errorMessage;
  }
  
  // 如果是普通 Error 对象
  if (error instanceof Error) {
    message.error(error.message || defaultMessage);
    return error.message || defaultMessage;
  }
  
  // 默认处理
  const errorMessage = typeof error === 'string' ? error : defaultMessage;
  message.error(errorMessage);
  return errorMessage;
}

/**
 * 统一成功提示函数
 * 
 * @param msg - 成功消息
 */
export function handleSuccess(msg: string = '操作成功'): void {
  message.success(msg);
}

/**
 * 统一警告提示函数
 * 
 * @param msg - 警告消息
 */
export function handleWarning(msg: string): void {
  message.warning(msg);
}

/**
 * 统一信息提示函数
 * 
 * @param msg - 信息消息
 */
export function handleInfo(msg: string): void {
  message.info(msg);
}

