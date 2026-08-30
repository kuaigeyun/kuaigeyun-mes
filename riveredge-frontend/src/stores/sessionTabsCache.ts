/**
 * UniTabs 会话内标签缓存（按租户隔离）
 *
 * 解决 UniTabs 因 key/remount 或父级短暂卸载导致内存标签丢失；
 * 与 tabsStorage（刷新后持久化）互补，优先于 localStorage 恢复。
 */

import type { TabItem } from './tabsStorage';

const tabsByTenant = new Map<number, TabItem[]>();
const activeKeyByTenant = new Map<number, string>();

export function getSessionTabs(tenantId: number): TabItem[] | null {
  const tabs = tabsByTenant.get(tenantId);
  return tabs && tabs.length > 0 ? tabs : null;
}

export function getSessionActiveKey(tenantId: number): string | null {
  return activeKeyByTenant.get(tenantId) ?? null;
}

export function setSessionTabs(tenantId: number, tabs: TabItem[], activeKey?: string | null): void {
  if (!tabs.length) {
    tabsByTenant.delete(tenantId);
    if (activeKey == null) {
      activeKeyByTenant.delete(tenantId);
    }
    return;
  }
  tabsByTenant.set(tenantId, tabs);
  if (activeKey) {
    activeKeyByTenant.set(tenantId, activeKey);
  }
}

export function clearSessionTabs(tenantId: number): void {
  tabsByTenant.delete(tenantId);
  activeKeyByTenant.delete(tenantId);
}

/** 登出时清空全部租户的会话标签，避免开关关闭时「退出再登录」仍恢复标签 */
export function clearAllSessionTabs(): void {
  tabsByTenant.clear();
  activeKeyByTenant.clear();
}
