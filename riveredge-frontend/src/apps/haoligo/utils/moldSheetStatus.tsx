import React from 'react';
import { Tag } from 'antd';
import type { CurrentUser } from '../../../types/api';
import { hasAnyPermission, resolveUserForMenuPermission } from '../../../utils/permission';

export function normalizeMoldSheetAuditStatus(status: string | null | undefined): string {
  const s = (status || '待审核').trim();
  if (s === '已通过' || s === '已驳回' || s === '待审核') return s;
  return '待审核';
}

export function moldSheetAuditStatusTag(status: string | null | undefined): React.ReactNode {
  const s = normalizeMoldSheetAuditStatus(status);
  const color = s === '已通过' ? 'success' : s === '已驳回' ? 'error' : 'processing';
  return <Tag color={color}>{s}</Tag>;
}

/**
 * 模具单据简易审核权限（非平台审批流）。
 * 组织管理员 bypass；业务上具备 update（可维护单据）或 audit/approve/reject 即可显示审核操作。
 */
export function canAuditMoldSheet(user: CurrentUser | undefined, resource: string): boolean {
  const resolved = resolveUserForMenuPermission(user);
  return hasAnyPermission(resolved, [
    `${resource}:audit`,
    `${resource}:approve`,
    `${resource}:reject`,
    `${resource}:update`,
  ]);
}

export function isMoldSheetApproved(status: string | null | undefined): boolean {
  return normalizeMoldSheetAuditStatus(status) === '已通过';
}
