/**
 * 登出或会话结束时清理与租户/用户绑定的 React Query 缓存。
 *
 * 避免：侧边栏 applicationMenus 等在 staleTime 内不 refetch，重新登录后仍显示旧菜单。
 *
 * 登录页（pages/login）禁止静态 import 本文件：它与 BasicLayout 同属 login/main 双入口，
 * Rollup 会抽成以本文件命名的共享块，并把主应用 i18n 文案打进登录 MPA。
 */
import type { QueryClient } from '@tanstack/react-query';

const SESSION_QUERY_ROOTS: readonly string[] = [
  'currentUser',
  'siteSetting',
  'userPreference',
  'languageListActive',
  'navigationMenuTree',
  'applicationMenus',
  'dashboard-menu-tree',
  'businessConfig',
  'tenantBackendHome',
  'chatIntegrationStatus',
];

export function clearSessionScopedQueries(queryClient: QueryClient): void {
  for (const root of SESSION_QUERY_ROOTS) {
    queryClient.removeQueries({ queryKey: [root] });
  }
}
