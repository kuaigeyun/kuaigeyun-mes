/**
 * 需求 / 需求计算等业务模式（MTS / MTO / ATO）展示
 *
 * 列表「业务模式」列与需求计划一致：ProColumns.valueEnum + status，
 * 由 ProTable / UniTable 渲染为圆点状态徽章（非 MarkerTag / Tag）。
 * 取单列用 MarkerTag + translateDemandBusinessMode。
 */

import React from 'react';
import type { TFunction } from 'i18next';
import { MarkerTag } from '../../../constants/statusBadges';

export type DemandBusinessMode = 'MTS' | 'MTO' | 'ATO';

export function getDemandBusinessModeLabel(mode: string | undefined | null): string {
  const m = (mode ?? '').trim();
  if (m === 'MTS') return '按库存生产 (MTS)';
  if (m === 'MTO') return '按订单生产 (MTO)';
  if (m === 'ATO') return '按订单组装 (ATO)';
  return m || '-';
}

/** 业务模式展示文案（页面 / 取单唯一路径，五语） */
export function translateDemandBusinessMode(t: TFunction, mode: string | undefined | null): string {
  const m = (mode ?? '').trim();
  if (m === 'MTS') return t('app.kuaizhizao.demandManagement.businessModeMts');
  if (m === 'MTO') return t('app.kuaizhizao.demandManagement.businessModeMto');
  if (m === 'ATO') return t('app.kuaizhizao.demandManagement.businessModeAto');
  return m || '-';
}

/** 取单业务模式徽章（filled） */
export function renderDemandBusinessModeMarkerTag(
  t: TFunction,
  mode: string | undefined | null,
): React.ReactNode {
  const label = translateDemandBusinessMode(t, mode);
  if (label === '-') return '-';
  return React.createElement(MarkerTag, { color: getDemandBusinessModeTagColor(mode) }, label);
}

/** Ant Design Tag color preset（详情抽屉等 Tag 展示） */
export function getDemandBusinessModeTagColor(mode: string | undefined | null): string {
  const m = (mode ?? '').trim();
  if (m === 'MTS') return 'processing';
  if (m === 'MTO') return 'success';
  if (m === 'ATO') return 'orange';
  return 'default';
}

type DemandBusinessModeValueEnum = Record<
  string,
  { text: string; status: 'Processing' | 'Success' | 'Warning' }
>;

/** 列表 valueEnum（圆点 + 文案），label 可传入 i18n */
export function buildDemandBusinessModeValueEnum(
  labelOf: (mode: DemandBusinessMode) => string = (mode) =>
    getDemandBusinessModeLabel(mode),
): DemandBusinessModeValueEnum {
  return {
    MTS: { text: labelOf('MTS'), status: 'Processing' },
    MTO: { text: labelOf('MTO'), status: 'Success' },
    ATO: { text: labelOf('ATO'), status: 'Warning' },
  };
}
