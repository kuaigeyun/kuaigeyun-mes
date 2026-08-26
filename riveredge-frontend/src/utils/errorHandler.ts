/**
 * 统一错误处理工具
 * 
 * 提供统一的错误处理函数，确保所有错误都按照统一格式处理。
 * 
 * ⚠️ 注意：Ant Design 6.0 要求使用 App.useApp() 获取 message 实例，
 * 工具函数无法使用 hooks，因此通过 antdAppApis 注册表获取（由 AntdAppBridge 注册）。
 * 禁止回落到 antd 静态 API：静态 API 渲染在 ConfigProvider 之外，
 * 无法消费主题 CSS 变量，会出现黑色图标、无间距的裸样式提示。
 */

import { getAntdMessage } from './antdAppApis';
import { isRequestCancellation } from './requestCancellation';

const getMessage = () => getAntdMessage();

/**
 * 将 FastAPI / Pydantic 的 detail（字符串、校验项数组或单对象）转为可展示文案，避免传入 message.error 导致 React 崩溃。
 */
export function formatFastApiDetail(detail: unknown): string {
  if (detail == null || detail === '') return '';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((e: any) => {
        if (e == null) return '';
        if (typeof e === 'string') return e;
        if (typeof e === 'object') {
          const m = e.msg ?? e.message;
          const locParts = Array.isArray(e.loc)
            ? e.loc.filter((p: unknown) => p !== 'body' && p !== 'query' && p !== 'path').map(String)
            : [];
          const field = locParts.length ? locParts.join('.') : '';
          if (field && m != null && String(m).trim()) return `${field}: ${String(m)}`;
          if (m != null && String(m).trim()) return String(m);
          return field;
        }
        return '';
      })
      .filter((s) => s && String(s).trim());
    return parts.length ? parts.join('；') : '';
  }
  if (typeof detail === 'object' && detail !== null) {
    const m = (detail as any).msg ?? (detail as any).message;
    if (m != null) return String(m);
  }
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

/**
 * 优先使用 apiRequest 抛出的 Error.message；否则从 response.data.detail 解析。
 */
export function getApiErrorMessage(error: any, fallback = '操作失败'): string {
  const m = error?.message;
  if (typeof m === 'string' && m.trim()) return m;
  const fromDetail = formatFastApiDetail(error?.response?.data?.detail);
  return fromDetail || fallback;
}

/** API 403/401 或后端 ACCESS_DENIED 文案 */
export function isApiAccessDenied(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 401 || status === 403) return true;
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const code = (detail as { code?: string }).code;
    if (code === 'ACCESS_DENIED' || code === 'UNAUTHORIZED') return true;
  }
  const msg = getApiErrorMessage(error, '');
  return /权限不足|无权限访问|permission denied/i.test(msg);
}

export type LinkedDocumentLoadErrorResult = {
  message: string;
  status: '403' | 'error';
};

/** 关联单据抽屉取数失败：权限问题用 403 Result，其它保持 error */
export function resolveLinkedDocumentLoadError(
  error: unknown,
  options: {
    fallback: string;
    permissionMessage: string;
  },
): LinkedDocumentLoadErrorResult {
  if (isApiAccessDenied(error)) {
    return {
      message: options.permissionMessage,
      status: '403',
    };
  }
  return {
    message: getApiErrorMessage(error, options.fallback),
    status: 'error',
  };
}

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
  if (isRequestCancellation(error)) {
    return '';
  }

  const message = getMessage();
  
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
      const errorMessage = formatFastApiDetail(errorData.detail) || defaultMessage;
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
  const message = getMessage();
  message.success(msg);
}

/**
 * 统一警告提示函数
 * 
 * @param msg - 警告消息
 */
export function handleWarning(msg: string): void {
  const message = getMessage();
  message.warning(msg);
}

/**
 * 统一信息提示函数
 * 
 * @param msg - 信息消息
 */
export function handleInfo(msg: string): void {
  const message = getMessage();
  message.info(msg);
}

