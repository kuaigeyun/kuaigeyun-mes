import { useMemo } from 'react';
import { useGlobalStore } from '../stores';
import { buildPermissionCode } from '../utils/permissionResource';
import { hasPermission } from '../utils/permission';
import { canInitiateCompleteCreate } from '../utils/documentWorkflowPermission';

export type ResourcePermissionGates = {
  /** 是否已解析到资源前缀并启用按钮级权限控制 */
  enabled: boolean;
  resource?: string;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canImport: boolean;
  canExport: boolean;
};

const ALL_ALLOWED: ResourcePermissionGates = {
  enabled: false,
  canRead: true,
  canCreate: true,
  canUpdate: true,
  canDelete: true,
  canImport: true,
  canExport: true,
};

export type ResourcePermissionOptions = {
  /** 新建完修单时接受来源单据的 :complete（无需本页 :create） */
  completeCreateSourceResource?: string;
};

/**
 * 按功能资源前缀（app:module）判断标准 CRUD / 导入导出权限。
 * resource 为空时不启用门禁（保持历史页面行为）。
 */
export function useResourcePermissions(
  resource: string | null | undefined,
  options?: ResourcePermissionOptions,
): ResourcePermissionGates {
  const currentUser = useGlobalStore((s) => s.currentUser);
  const completeSource = options?.completeCreateSourceResource?.trim() || '';

  return useMemo(() => {
    const prefix = (resource || '').trim();
    if (!prefix) return ALL_ALLOWED;

    const check = (action: string) => hasPermission(currentUser, buildPermissionCode(prefix, action));
    const canCreate = completeSource
      ? canInitiateCompleteCreate(currentUser, completeSource, prefix)
      : check('create');

    return {
      enabled: true,
      resource: prefix,
      canRead: check('read'),
      canCreate,
      canUpdate: check('update'),
      canDelete: check('delete'),
      canImport: check('import'),
      canExport: check('export'),
    };
  }, [currentUser, resource, completeSource]);
}
