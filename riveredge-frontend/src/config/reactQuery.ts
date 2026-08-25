/**
 * React Query 默认策略。
 *
 * 开发环境降低窗口焦点 refetch 频率，避免切 Tab 触发整页请求风暴与掉帧。
 * 生产环境保持较短 staleTime，便于多 Tab 协作时较快看到他人变更。
 */

import { isRequestCancellation } from '../utils/requestCancellation';

const isDev = import.meta.env.DEV;

/** 全局 query 默认项（main.tsx QueryClient） */
export const defaultQueryOptions = {
  retry: (failureCount: number, error: any) => {
    if (isRequestCancellation(error)) return false;
    if (error?.response?.status === 401) return false;
    if (error?.response?.status === 400) return false;
    if (error?.response?.status === 500) return false;
    const isNetworkError =
      error?.message?.includes('fetch') ||
      error?.message?.includes('NetworkError') ||
      error?.message?.includes('Failed to fetch');
    const isServerError = [502, 503, 504].includes(error?.response?.status);
    if (isNetworkError || isServerError) {
      return failureCount < 2;
    }
    return false;
  },
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 10000),
  refetchOnWindowFocus: !isDev,
  refetchOnReconnect: true,
  refetchOnMount: true,
  staleTime: isDev ? 60_000 : 30_000,
  throwOnError: false,
  retryOnMount: false,
} as const;

/** Layout / Shell 层只读聚合接口：更长缓存、不随窗口焦点刷新 */
export const layoutShellQueryOptions = {
  staleTime: 2 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  refetchOnWindowFocus: false,
} as const;

/** 当前用户：权限变更仍由 permission_version 驱动菜单失效 */
export const currentUserQueryOptions = {
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  refetchOnWindowFocus: false,
} as const;
