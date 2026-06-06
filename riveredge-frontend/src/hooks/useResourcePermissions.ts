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
  canPrint: boolean;
};

const FAIL_CLOSED: ResourcePermissionGates = {
  enabled: true,
  canRead: false,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
  canImport: false,
  canExport: false,
  canPrint: false,
};

export type ResourcePermissionOptions = {
  /** 新建完修单时接受来源单据的 :complete（无需本页 :create） */
  completeCreateSourceResource?: string;
};

/**
 * 按 manifest 资源前缀（app:module）判断标准 CRUD / 导入导出权限。
 * resource 为空时 fail-closed（禁止无资源前缀的旁路放行）。
 */
export function useResourcePermissions(
  resource: string | null | undefined,
  options?: ResourcePermissionOptions,
): ResourcePermissionGates {
  const currentUser = useGlobalStore((s) => s.currentUser);
  const completeSource = options?.completeCreateSourceResource?.trim() || '';

  return useMemo(() => {
    const prefix = (resource || '').trim();
    if (!prefix) return FAIL_CLOSED;

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
      canPrint: check('print'),
    };
  }, [currentUser, resource, completeSource]);
}
