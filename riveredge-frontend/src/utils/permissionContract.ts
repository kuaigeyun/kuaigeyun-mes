/**
 * 系统权限契约（前端）
 *
 * 与 docs/core/permission-contract.md、后端 permission_contract.py 对齐。
 * 页面与组件应优先使用本模块 + useResourcePermissions，禁止旁路拼权限。
 */

import type { CurrentUser } from '../types/api';
import { buildPermissionCode } from './permissionResource';
import { hasAnyPermission, hasPermission } from './permission';

/** 与后端 REVIEW_ACTIONS / 角色树「审核」合并勾选一致 */
export const REVIEW_ACTIONS = ['audit', 'approve', 'reject'] as const;

export type StandardAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'import'
  | 'export'
  | 'print'
  | 'audit'
  | 'approve'
  | 'reject'
  | 'submit'
  | 'revoke'
  | 'execute'
  | 'complete'
  | 'assign'
  | 'display'
  | 'dispatch'
  | 'recall'
  | 'confirm_adjustment';

/** 模块资源前缀，如 haoligo:molds-documents-trial */
export function reviewPermissionCodes(resourcePrefix: string): string[] {
  return REVIEW_ACTIONS.map((action) => buildPermissionCode(resourcePrefix, action));
}

export function hasModulePermission(
  user: CurrentUser | undefined,
  resourcePrefix: string,
  action: StandardAction,
): boolean {
  return hasPermission(user, buildPermissionCode(resourcePrefix, action));
}

/** 是否具备审核能力（通过/驳回/撤销审核），不含 update */
export function hasReviewPermission(user: CurrentUser | undefined, resourcePrefix: string): boolean {
  return hasAnyPermission(user, reviewPermissionCodes(resourcePrefix));
}
