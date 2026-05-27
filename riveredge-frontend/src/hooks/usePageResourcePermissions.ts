import { usePagePermissionResource } from './usePagePermissionResource';
import { useResourcePermissions, type ResourcePermissionGates } from './useResourcePermissions';

/**
 * 当前页菜单资源 + 标准 action 权限门禁（供 UniTable 外自定义按钮使用）。
 */
export function usePageResourcePermissions(pathname?: string): ResourcePermissionGates {
  const resource = usePagePermissionResource(pathname);
  return useResourcePermissions(resource);
}
