/**
 * 保存搜索条件排序持久化
 *
 * 统一管理 saved_search_order_personal_*、saved_search_order_shared_* 的读写，
 * 避免多处直接操作 localStorage。
 */

function getKey(pagePath: string, type: 'personal' | 'shared'): string {
  return `saved_search_order_${type}_${pagePath}`;
}

export function getSavedSearchOrder(pagePath: string, type: 'personal' | 'shared'): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getKey(pagePath, type));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setSavedSearchOrder(pagePath: string, type: 'personal' | 'shared', order: number[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getKey(pagePath, type), JSON.stringify(order));
  } catch {
    // ignore
  }
}
