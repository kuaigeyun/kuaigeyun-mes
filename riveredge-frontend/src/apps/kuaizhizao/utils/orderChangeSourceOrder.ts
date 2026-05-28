/** 与后端 is_source_order_locked_for_direct_edit 对齐：可创建变更单的原单状态 */

import {
  DocumentStatus,
  ReviewStatusEnum,
  isAuditedStatus,
  isConfirmedStatus,
  isDraftStatus,
  isPendingReviewStatus,
} from '../constants/documentStatus';

const EXECUTING_STATUS_VALUES = new Set([
  DocumentStatus.IN_PROGRESS,
  DocumentStatus.COMPLETED,
  DocumentStatus.CLOSED,
  DocumentStatus.RELEASED,
  '执行中',
  '进行中',
  '已完成',
  '已关闭',
  '已下达',
]);

const APPROVED_REVIEW = new Set([
  ReviewStatusEnum.APPROVED,
  'APPROVED',
  '已通过',
  '审核通过',
  '通过',
]);

export function isSourceOrderEligibleForChange(
  status?: string | null,
  reviewStatus?: string | null,
): boolean {
  const s = (status ?? '').trim();
  if (!s) return false;
  if (EXECUTING_STATUS_VALUES.has(s) || EXECUTING_STATUS_VALUES.has(s.toUpperCase())) return true;
  if (isAuditedStatus(s) || isConfirmedStatus(s)) return true;
  const rs = (reviewStatus ?? '').trim();
  if (
    APPROVED_REVIEW.has(rs) &&
    !isDraftStatus(s) &&
    !isPendingReviewStatus(s) &&
    s !== DocumentStatus.REJECTED &&
    s !== '已驳回'
  ) {
    return true;
  }
  return false;
}

export interface OrderChangeSourceOrderOption {
  id: number;
  order_code: string;
  partner_name?: string;
  status?: string;
  total_amount?: number;
  order_date?: string;
}
