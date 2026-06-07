import React from 'react';
import { Tag } from 'antd';
import type { CurrentUser } from '../../../types/api';
import { hasReviewPermission, reviewPermissionCodes } from '../../../utils/permissionContract';

export function normalizeMoldSheetAuditStatus(status: string | null | undefined): string {
  const s = (status || '待审核').trim();
  if (s === '已通过' || s === '已驳回' || s === '待审核') return s;
  return '待审核';
}

export function moldSheetAuditStatusTag(status: string | null | undefined): React.ReactNode {
  const s = normalizeMoldSheetAuditStatus(status);
  const color = s === '已通过' ? 'success' : s === '已驳回' ? 'error' : 'warning';
  return <Tag color={color}>{s}</Tag>;
}

/** @deprecated 使用 reviewPermissionCodes(resource) */
export const moldSheetReviewPermissionCodes = reviewPermissionCodes;

/**
 * 模具单据简易审核权限（非平台审批流）。
 * 仅 audit / approve / reject；与「编辑」update 分离。
 */
export function canAuditMoldSheet(user: CurrentUser | undefined, resource: string): boolean {
  return hasReviewPermission(user, resource);
}

export function isMoldSheetApproved(status: string | null | undefined): boolean {
  return normalizeMoldSheetAuditStatus(status) === '已通过';
}
