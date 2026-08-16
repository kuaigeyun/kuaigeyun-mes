/**
 * 需求类型相关工具函数
 */

import React from 'react';
import type { TFunction } from 'i18next';
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

/** 需求类型展示文案（页面 / 取单唯一路径，五语） */
export function translateDemandType(t: TFunction, v: string | undefined | null): string {
  const k = normalizeDemandTypeKey(v);
  if (k === 'sales_forecast') return t('app.kuaizhizao.salesForecast.title');
  if (k === 'sales_order') return t('app.kuaizhizao.salesOrder.entityName');
  if (k === 'demand_plan') return t('app.kuaizhizao.demandManagement.demandTypePlan');
  return v?.trim() || '-';
}

/** 无 t 时的中文标签（仅溯源等非页面路径） */
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
export function renderDemandTypeMarkerTag(
  t: TFunction,
  v: string | undefined | null,
): React.ReactNode {
  const label = translateDemandType(t, v);
  if (label === '-') return '-';
  return React.createElement(MarkerTag, { color: getDemandTypeMarkerColor(v) }, label);
}
