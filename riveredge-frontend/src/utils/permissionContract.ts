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
  | 'display'
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
  | 'confirm_adjustment'
  | 'claim'
  | 'release'
  | 'recycle';

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

const REVIEW_ACTION_LABEL_KEY = 'audit';

/** 完整权限码 → i18n key（与 permission_action_spec.PERMISSION_CODE_DISPLAY_LABELS 对齐） */
const PERMISSION_CODE_LABEL_I18N: Record<string, string> = {
  'haoligo:equipment-documents-acceptance:submit': 'permission.haoligo.equipmentDocumentsAcceptance.submit',
  'haoligo:equipment-documents-acceptance:execute': 'permission.haoligo.equipmentDocumentsAcceptance.execute',
  'haoligo:equipment-documents-acceptance:complete': 'permission.haoligo.equipmentDocumentsAcceptance.complete',
};

/** 角色矩阵 / 功能权限树：权限码级展示名优先，否则按 action 走 permission.action.* */
export function resolvePermissionLabel(
  permissionCode: string | undefined,
  action: string | undefined,
  backendLabel: string | undefined,
  t: (key: string, opts?: { defaultValue?: string }) => string,
): string {
  const code = (permissionCode || '').trim().toLowerCase();
  const codeKey = code ? PERMISSION_CODE_LABEL_I18N[code] : undefined;
  if (codeKey) {
    const translated = t(codeKey, { defaultValue: '' });
    if (translated && translated !== codeKey) return translated;
  }
  return resolvePermissionActionLabel(action, backendLabel, t);
}

/** 角色矩阵 / 功能权限树操作展示：按 action 走 permission.action.*，与 permission_action_spec 对齐 */
export function resolvePermissionActionLabel(
  action: string | undefined,
  backendLabel: string | undefined,
  t: (key: string, opts?: { defaultValue?: string }) => string,
): string {
  const raw = (action || '').trim().toLowerCase();
  if (!raw) {
    const label = (backendLabel || '').trim();
    return label || '—';
  }

  let actionKey = raw;
  if (raw === 'edit') actionKey = 'update';
  if ((REVIEW_ACTIONS as readonly string[]).includes(raw)) actionKey = REVIEW_ACTION_LABEL_KEY;

  const i18nKey = `permission.action.${actionKey}`;
  const translated = t(i18nKey, { defaultValue: '' });
  if (translated && translated !== i18nKey) return translated;

  const label = (backendLabel || '').trim();
  return label || raw;
}
