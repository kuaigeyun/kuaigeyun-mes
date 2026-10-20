/**
 * React.lazy + 动态 import 失败重试。
 *
 * 开发态 Vite HMR / 瞬时 5xx 常见「Failed to fetch dynamically imported module」；
 * 生产态若判定为旧 chunk，优先走整页刷新（与 staleChunkReload 一致）。
 */

import React from 'react';
import { isStaleChunkError, reloadForStaleChunkOnce } from './staleChunkReload';

type ModuleDefault<T> = { default: T };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * @param importer 与 `import('./X')` 相同的动态导入函数
 * @param retries 失败后额外重试次数（默认 1，共尝试 2 次）
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  importer: () => Promise<ModuleDefault<T>>,
  retries = 1,
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await importer();
      } catch (error) {
        lastError = error;
        if (import.meta.env.PROD && isStaleChunkError(error)) {
          const detail = error instanceof Error ? error.message : String(error ?? '');
          if (reloadForStaleChunkOnce(detail)) {
            // 页面即将刷新：挂起不 resolve，避免再抛到 ErrorBoundary
            return new Promise<ModuleDefault<T>>(() => {});
          }
        }
        if (attempt >= retries) {
          break;
        }
        await sleep(300 * (attempt + 1));
      }
    }
    throw lastError;
  });
}
