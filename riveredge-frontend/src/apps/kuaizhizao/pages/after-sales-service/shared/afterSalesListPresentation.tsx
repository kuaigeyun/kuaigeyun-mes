/**
 * 售后服务列表展示：流程状态 solid（配色走 documentStatusColors）；类型/方式/阶段等 filled。
 */
import React from 'react';
import { renderDocumentStatusTag } from '../../../../../utils/documentLifecycleStatusTag';
import { MarkerTag } from '../../../../../constants/statusBadges';

/** @deprecated 仅兼容旧调用；新代码请直接 `renderDocumentStatusTag(status, status)` */
export const AFTER_SALES_TICKET_STATUS_COLOR: Record<string, string> = {};
/** @deprecated */
export const AFTER_SALES_INSTALL_STATUS_COLOR: Record<string, string> = {};
/** @deprecated */
export const AFTER_SALES_REPAIR_STATUS_COLOR: Record<string, string> = {};
/** @deprecated */
export const AFTER_SALES_DISPATCH_STATUS_COLOR: Record<string, string> = {};
/** @deprecated */
export const AFTER_SALES_REVIEW_STATUS_COLOR: Record<string, string> = {};
/** @deprecated */
export const AFTER_SALES_ASSET_STATUS_COLOR: Record<string, string> = {};

export function renderAfterSalesStatusTag(
  status?: string | null,
  _colorMap?: Record<string, string>,
) {
  const text = String(status ?? '').trim();
  if (!text) return '-';
  return renderDocumentStatusTag(text, text);
}

export function renderAfterSalesTypeMarker(text?: string | null) {
  const value = String(text ?? '').trim();
  if (!value || value === '—' || value === '-') return value || '-';
  return <MarkerTag color="processing">{value}</MarkerTag>;
}
