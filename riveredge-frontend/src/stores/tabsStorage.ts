/**
 * 标签栏持久化存储
 *
 * 统一管理 riveredge_saved_tabs、riveredge_saved_active_key 的读写，
 * 按租户隔离，切换租户时使用各自标签。
 */

import { getTenantId } from '../utils/auth';

function getTabsKey(): string {
  const tenantId = getTenantId();
  return tenantId != null ? `riveredge_saved_tabs_t${tenantId}` : 'riveredge_saved_tabs';
}

function getActiveKey(): string {
  const tenantId = getTenantId();
  return tenantId != null ? `riveredge_saved_active_key_t${tenantId}` : 'riveredge_saved_active_key';
}

export interface TabItem {
  key: string;
  path: string;
  label: string;
  closable?: boolean;
  pinned?: boolean;
}

export function getSavedTabs(): TabItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getTabsKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setSavedTabs(tabs: TabItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getTabsKey(), JSON.stringify(tabs));
  } catch {
    // ignore
  }
}

export function getSavedActiveKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(getActiveKey());
}

export function setSavedActiveKey(key: string | null): void {
  if (typeof window === 'undefined') return;
  const storageKey = getActiveKey();
  if (key) {
    localStorage.setItem(storageKey, key);
  } else {
    localStorage.removeItem(storageKey);
  }
}

/** 清除标签数据（如主题编辑器重置时调用） */
export function clearTabsData(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(getTabsKey());
    localStorage.removeItem(getActiveKey());
  } catch {
    // ignore
  }
}
