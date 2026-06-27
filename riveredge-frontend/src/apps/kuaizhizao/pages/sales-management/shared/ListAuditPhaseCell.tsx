import React from 'react';
import { AuditPhaseBadge, type AuditPhaseRecord } from '../../../../../components/uni-audit/AuditPhaseBadge';

/** 列表「审核状态」列统一渲染（与 lifecycle 列完全分离；审核关闭仍展示自动通过相位） */
export function ListAuditPhaseCell({
  record,
}: {
  record: AuditPhaseRecord | null | undefined;
  /** @deprecated 展示不再因审核关闭而隐藏 */
  auditEnabled?: boolean;
}) {
  return <AuditPhaseBadge record={record} variant="column" />;
}
