/**
 * 登出或会话结束时清理与租户/用户绑定的 React Query 缓存。
 *
 * 避免：侧边栏 applicationMenus 等在 staleTime 内不 refetch，重新登录后仍显示旧菜单。
 */
import type { QueryClient } from '@tanstack/react-query';

const SESSION_MENU_QUERY_KEYS: readonly (readonly string[])[] = [
  ['navigationMenuTree'],
  ['applicationMenus'],
  ['dashboard-menu-tree'],
  ['businessConfig'],
  ['tenantBackendHome'],
  ['chatIntegrationStatus'],
];

export function clearSessionScopedQueries(queryClient: QueryClient): void {
  for (const queryKey of SESSION_MENU_QUERY_KEYS) {
    queryClient.removeQueries({ queryKey: [...queryKey] });
  }
}
