import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { resolvePermissionResourceFromMenus } from '../utils/permissionResource';
import { isPlatformInfraPath } from '../utils/platformScope';
import { useNavigationMenuTreeQuery } from './useNavigationMenuTreeQuery';

/**
 * 从当前路由 + 导航菜单树解析功能资源前缀（与菜单 permission_code 一致）。
 */
export function usePagePermissionResource(pathname?: string): string | null {
  const location = useLocation();
  const path = pathname ?? location.pathname;

  const isInfraPath = isPlatformInfraPath(path);

  const { data: menuTree } = useNavigationMenuTreeQuery({ enabled: !isInfraPath });

  return useMemo(
    () => (isInfraPath ? null : resolvePermissionResourceFromMenus(menuTree, path)),
    [isInfraPath, menuTree, path],
  );
}
