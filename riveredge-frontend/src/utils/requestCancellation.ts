import { isCancelledError } from '@tanstack/react-query';

/**
 * 请求被主动取消（租户切换 cancelQueries、AbortSignal、用户离开页面）。
 * 这是控制流，不是业务失败，不得弹 Toast / 不得当网络错误。
 */
export function isRequestCancellation(error: unknown): boolean {
  if (error == null) return false;
  if (isCancelledError(error)) return true;

  const err = error as {
    name?: string;
    message?: string;
    code?: string;
    originalError?: unknown;
  };

  const name = err.name;
  if (name === 'AbortError' || name === 'CancelledError' || name === 'CanceledError') {
    return true;
  }
  if (err.code === 'ERR_CANCELED' || err.code === 'ERR_ABORTED') {
    return true;
  }
  if (err.message === 'CancelledError' || err.message === 'CanceledError') {
    return true;
  }
  if (err.originalError && err.originalError !== error) {
    return isRequestCancellation(err.originalError);
  }
  return false;
}

/** 预取等 fire-and-forget：取消可结束；其它错误仍抛出让未处理拒绝暴露 */
export function swallowRequestCancellation(error: unknown): void {
  if (isRequestCancellation(error)) return;
  throw error;
}
