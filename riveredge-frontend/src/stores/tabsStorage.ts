/**
 * 标签栏持久化存储
 *
 * 统一管理 riveredge_saved_tabs、riveredge_saved_active_key 的读写，
 * 避免多处直接操作 localStorage 造成技术栈分散。
 */

const SAVED_TABS_KEY = 'riveredge_saved_tabs';
const SAVED_ACTIVE_KEY = 'riveredge_saved_active_key';

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
    const raw = localStorage.getItem(SAVED_TABS_KEY);
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
    localStorage.setItem(SAVED_TABS_KEY, JSON.stringify(tabs));
  } catch {
    // ignore
  }
}

export function getSavedActiveKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SAVED_ACTIVE_KEY);
}

export function setSavedActiveKey(key: string | null): void {
  if (typeof window === 'undefined') return;
  if (key) {
    localStorage.setItem(SAVED_ACTIVE_KEY, key);
  } else {
    localStorage.removeItem(SAVED_ACTIVE_KEY);
  }
}

/** 清除标签数据（如主题编辑器重置时调用） */
export function clearTabsData(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SAVED_TABS_KEY);
    localStorage.removeItem(SAVED_ACTIVE_KEY);
  } catch {
    // ignore
  }
}
