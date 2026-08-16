/**
 * 订单评审徽章展示（列表 / 详情 / 评审弹窗唯一路径）
 * 状态走全局 documentStatusColors + StatusTag；紧急度 / 风险 / 部门结论走 MarkerTag filled。
 */

import React from 'react';
import type { TFunction } from 'i18next';
import { MarkerTag } from '../../../constants/statusBadges';
import { renderDocumentStatusTag } from '../../../utils/documentLifecycleStatusTag';

/** 紧急度：低灰 → 正常蓝 → 高橙 → 加急红（非流程状态，仍用 MarkerTag） */
export function salesReviewUrgencyMarkerColor(value?: string | null): string {
  switch (String(value || 'normal').toLowerCase()) {
    case 'low':
      return 'default';
    case 'normal':
      return 'processing';
    case 'high':
      return 'warning';
    case 'urgent':
      return 'error';
    default:
      return 'default';
  }
}

/** 风险级次：低绿 → 中橙 → 高红 */
export function salesReviewRiskMarkerColor(value?: string | null): string {
  switch (String(value || 'medium').toLowerCase()) {
    case 'low':
      return 'success';
    case 'medium':
      return 'warning';
    case 'high':
      return 'error';
    default:
      return 'default';
  }
}

export function translateSalesReviewStatus(t: TFunction, status?: string | null): string {
  const key = status || 'draft';
  return t(`app.kuaizhizao.salesReview.status.${key}`, { defaultValue: status || '—' });
}

export function translateSalesReviewUrgency(t: TFunction, value?: string | null): string {
  const key = value || 'normal';
  return t(`app.kuaizhizao.salesReview.urgency.${key}`, { defaultValue: value || '—' });
}

export function translateSalesReviewRisk(t: TFunction, value?: string | null): string {
  const key = value || 'medium';
  return t(`app.kuaizhizao.salesReview.risk.${key}`, { defaultValue: value || '—' });
}

export function renderSalesReviewStatusTag(t: TFunction, status?: string | null): React.ReactNode {
  return renderDocumentStatusTag(translateSalesReviewStatus(t, status), status || 'draft');
}

export function renderSalesReviewUrgencyMarkerTag(
  t: TFunction,
  value?: string | null,
): React.ReactNode {
  return (
    <MarkerTag color={salesReviewUrgencyMarkerColor(value)}>
      {translateSalesReviewUrgency(t, value)}
    </MarkerTag>
  );
}

export function renderSalesReviewRiskMarkerTag(
  t: TFunction,
  value?: string | null,
): React.ReactNode {
  return (
    <MarkerTag color={salesReviewRiskMarkerColor(value)}>
      {translateSalesReviewRisk(t, value)}
    </MarkerTag>
  );
}

export function renderSalesReviewDeptOpinionResultTag(
  t: TFunction,
  result?: string | null,
): React.ReactNode {
  if (result === 'pass') {
    return <MarkerTag color="success">{t('app.kuaizhizao.salesReview.opinionPass')}</MarkerTag>;
  }
  if (result === 'fail') {
    return <MarkerTag color="error">{t('app.kuaizhizao.salesReview.opinionFail')}</MarkerTag>;
  }
  return <MarkerTag color="default">{t('app.kuaizhizao.salesReview.deptPending')}</MarkerTag>;
}
