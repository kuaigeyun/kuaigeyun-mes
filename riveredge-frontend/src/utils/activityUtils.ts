/**
 * 用户活动时间工具
 *
 * 用于不活动超时检测：仅当用户真正不活动（无操作、无 API 请求）时才触发超时退出
 */

export const ACTIVITY_STORAGE_KEY = 'riveredge_last_activity';

/** 节流间隔（毫秒）：避免过于频繁写入 localStorage */
const THROTTLE_MS = 1000;

let lastUpdateTime = 0;

/**
 * 更新最后活动时间
 *
 * 在以下场景调用以表示用户处于活动状态：
 * - 用户操作：鼠标移动、点击、键盘、滚动、触摸
 * - API 请求成功：表示页面正在使用，用户处于活动状态
 *
 * @param force - 是否强制更新（忽略节流），用于 API 响应等低频场景
 */
export function updateLastActivity(force = false): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (!force && now - lastUpdateTime < THROTTLE_MS) return;
  lastUpdateTime = now;
  try {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
  } catch (e) {
    // 忽略 localStorage 写入失败（隐私模式等）
  }
}

/**
 * 获取最后活动时间（时间戳）
 */
export function getLastActivityTime(): number {
  if (typeof window === 'undefined') return Date.now();
  try {
    const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    return stored ? parseInt(stored, 10) : Date.now();
  } catch {
    return Date.now();
  }
}
