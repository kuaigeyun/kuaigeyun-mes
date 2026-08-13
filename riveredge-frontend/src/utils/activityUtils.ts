/**
 * 用户活动时间工具
 *
 * 用于不活动超时检测：仅当页面可见且窗口聚焦、用户真正无操作、无进行中 API 时才累计空闲并退出。
 * 内存时间戳为真源；localStorage 仅用于多标签页同步。
 */

export const ACTIVITY_STORAGE_KEY = 'riveredge_last_activity';

/** 节流间隔（毫秒）：避免过于频繁写入 localStorage */
const THROTTLE_MS = 1000;

let lastWriteWallClock = 0;
/** 本页内存中的最后活动时间（优先于 localStorage，避免写入失败或竞态误判） */
let memoryLastActivity = 0;

/** 进行中的 API 请求数：有请求时视为用户正在操作，不触发超时退出 */
let pendingRequestCount = 0;

/**
 * 增加进行中请求计数（内部使用，由 api.ts 在请求发起/结束时调用）
 */
export function incrementPendingRequests(): void {
  pendingRequestCount += 1;
}

/**
 * 减少进行中请求计数
 */
export function decrementPendingRequests(): void {
  if (pendingRequestCount > 0) pendingRequestCount -= 1;
}

/**
 * 是否有进行中的请求（有则视为用户正在操作）
 */
export function hasPendingRequests(): boolean {
  return pendingRequestCount > 0;
}

function persistActivity(ts: number): void {
  memoryLastActivity = ts;
  lastWriteWallClock = Date.now();
  try {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, String(ts));
  } catch {
    // 忽略 localStorage 写入失败（隐私模式等）
  }
}

/**
 * 多标签页：采纳其它标签写入的更新活动时间
 */
export function syncMemoryActivityFromStorage(ts: number): void {
  if (!Number.isFinite(ts) || ts <= 0) return;
  if (ts > memoryLastActivity) {
    memoryLastActivity = ts;
  }
}

/**
 * 更新最后活动时间
 *
 * @param force - 是否强制更新（忽略节流），用于 API 请求等低频场景
 */
export function updateLastActivity(force = false): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (!force && now - lastWriteWallClock < THROTTLE_MS) return;
  persistActivity(now);
}

/**
 * 页面隐藏期间暂停空闲计时：把最后活动时间向后平移 pauseMs。
 * 这样「切到其它窗口」不会把隐藏时长算进无操作超时。
 */
export function bumpLastActivityBy(pauseMs: number): void {
  if (typeof window === 'undefined') return;
  if (!Number.isFinite(pauseMs) || pauseMs <= 0) return;
  const base = getLastActivityTime();
  persistActivity(base + pauseMs);
}

/**
 * 获取最后活动时间（时间戳）
 */
export function getLastActivityTime(): number {
  if (typeof window === 'undefined') return Date.now();
  let stored = 0;
  try {
    const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (raw) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n > 0) stored = n;
    }
  } catch {
    // ignore
  }
  const best = Math.max(memoryLastActivity, stored);
  return best > 0 ? best : Date.now();
}
