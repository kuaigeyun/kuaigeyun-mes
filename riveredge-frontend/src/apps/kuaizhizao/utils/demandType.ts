/**
 * 需求类型相关工具函数
 */

import React from 'react';
import { MarkerTag } from '../../../constants/statusBadges';

/** 需求类型码值归一（兼容大小写、连字符） */
export function normalizeDemandTypeKey(v: string | undefined | null): string {
  return (v ?? '').trim().toLowerCase().replace(/-/g, '_');
}

export const DEMAND_TYPE_LABEL: Record<string, string> = {
  sales_forecast: '销售预测',
  sales_order: '销售订单',
  demand_plan: '需求计划',
};

/** 需求类型 MarkerTag 颜色（分类标识，filled） */
export function getDemandTypeMarkerColor(v: string | undefined | null): string {
  const k = normalizeDemandTypeKey(v);
  if (k === 'sales_forecast') return 'processing';
  if (k === 'sales_order') return 'success';
  if (k === 'demand_plan') return 'orange';
  return 'default';
}

/** 需求类型展示文案（未知码值回退为原字符串，避免界面出现「空白」） */
export function getDemandTypeLabel(v: string | undefined | null): string {
  const k = normalizeDemandTypeKey(v);
  return DEMAND_TYPE_LABEL[k] ?? (v?.trim() || '-');
}

export function getDemandTypeTagProps(
  v: string | undefined | null,
): { color?: string; style?: React.CSSProperties } {
  return { color: getDemandTypeMarkerColor(v) };
}

/** 来源类型徽章（filled） */
export function renderDemandTypeMarkerTag(v: string | undefined | null): React.ReactNode {
  const label = getDemandTypeLabel(v);
  if (label === '-') return '-';
  return React.createElement(MarkerTag, { color: getDemandTypeMarkerColor(v) }, label);
}
