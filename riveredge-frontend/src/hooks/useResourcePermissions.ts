import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useGlobalStore } from '../stores';
import { buildPermissionCode } from '../utils/permissionResource';
import { hasPermission, isAdminBypass } from '../utils/permission';
import { hasReviewPermission } from '../utils/permissionContract';
import { isPlatformInfraPath } from '../utils/platformScope';
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
  /** manifest 标准 action；`skip` 由 filter 层直接放行 */
  canAction?: (action: string) => boolean;
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
  canAction: () => false,
};

/** 管理员 bypass：关闭按钮级 RBAC 过滤（与 hasPermission / 后端 is_admin_bypass 一致） */
const ADMIN_BYPASS_OPEN: ResourcePermissionGates = {
  enabled: false,
  canRead: true,
  canCreate: true,
  canUpdate: true,
  canDelete: true,
  canImport: true,
  canExport: true,
  canPrint: true,
  canAction: () => true,
};

export type ResourcePermissionOptions = {
  /** 新建完修单时接受来源单据的 :complete（无需本页 :create） */
  completeCreateSourceResource?: string;
};

/**
 * 按 manifest 资源前缀（app:module）判断标准 CRUD / 导入导出权限。
 * 平台管理员 / 组织管理员 / 系统管理员角色始终放行；resource 为空时普通用户 fail-closed。
 */
export function useResourcePermissions(
  resource: string | null | undefined,
  options?: ResourcePermissionOptions,
): ResourcePermissionGates {
  const location = useLocation();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const completeSource = options?.completeCreateSourceResource?.trim() || '';

  return useMemo(() => {
    if (isAdminBypass(currentUser)) {
      return ADMIN_BYPASS_OPEN;
    }

    // /infra/* 无 manifest 资源码：仅平台管理员可展示操作按钮（后端 infra API 强校验）
    if (isPlatformInfraPath(location.pathname)) {
      return FAIL_CLOSED;
    }

    const prefix = (resource || '').trim();
    if (!prefix) {
      return FAIL_CLOSED;
    }

    const check = (action: string) => hasPermission(currentUser, buildPermissionCode(prefix, action));
    const canCreate = completeSource
      ? canInitiateCompleteCreate(currentUser, completeSource, prefix)
      : check('create');
    const canAction = (action: string) => {
      const act = (action || '').trim().toLowerCase();
      if (!act || act === 'skip') return true;
      if (act === 'create' && completeSource) {
        return canInitiateCompleteCreate(currentUser, completeSource, prefix);
      }
      if (act === 'audit' || act === 'approve' || act === 'reject') {
        return hasReviewPermission(currentUser, prefix);
      }
      return check(act);
    };

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
      canAction,
    };
  }, [currentUser, resource, completeSource, location.pathname]);
}
