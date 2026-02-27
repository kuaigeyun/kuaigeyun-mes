/**
 * 保存搜索条件排序持久化
 *
 * 统一管理 saved_search_order_* 的读写，按租户隔离。
 * 保存搜索为租户级数据，切换租户时使用各自排序。
 */

import { getTenantId } from '../utils/auth';

function getKey(pagePath: string, type: 'personal' | 'shared'): string {
  const tenantId = getTenantId();
  const tenantPart = tenantId != null ? `t${tenantId}_` : '';
  return `saved_search_order_${tenantPart}${type}_${pagePath}`;
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
