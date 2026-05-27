import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useGlobalStore } from '../stores';
import { getNavigationMenuTree } from '../services/menu';
import { resolvePermissionResourceFromMenus } from '../utils/permissionResource';
import { NAVIGATION_MENU_TREE_QUERY_KEY } from './useUnifiedMenuData';

/**
 * 从当前路由 + 导航菜单树解析功能资源前缀（与菜单 permission_code 一致）。
 */
export function usePagePermissionResource(pathname?: string): string | null {
  const location = useLocation();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const path = pathname ?? location.pathname;

  const queryKey = useMemo(
    () =>
      [
        NAVIGATION_MENU_TREE_QUERY_KEY,
        'permissionResource',
        currentUser?.tenant_id ?? null,
        currentUser?.permission_version ?? 0,
      ] as const,
    [currentUser?.tenant_id, currentUser?.permission_version],
  );

  const { data: menuTree } = useQuery({
    queryKey,
    queryFn: () => getNavigationMenuTree(),
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return useMemo(
    () => resolvePermissionResourceFromMenus(menuTree, path),
    [menuTree, path],
  );
}
