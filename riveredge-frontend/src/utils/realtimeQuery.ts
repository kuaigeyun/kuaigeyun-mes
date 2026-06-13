/**
 * 业务单据 / 主数据 Query 约定：实时优先，不做 stale 复用。
 * 性能优化仅允许「同一瞬间并发去重」，不得跨操作/跨页面返回旧数据。
 */
export const REALTIME_STALE_MS = 0;

export const REALTIME_QUERY_OPTIONS = {
  staleTime: REALTIME_STALE_MS,
  gcTime: 0,
} as const;

/** UniTable / 列表页 TanStack 默认：每次请求拉最新，禁止 staleWhileRevalidate 展示旧行 */
export const REALTIME_LIST_QUERY_OPTIONS = {
  staleTime: REALTIME_STALE_MS,
  gcTime: 5 * 60 * 1000,
  staleWhileRevalidate: false,
} as const;
