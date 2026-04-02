/**
 * 需求类型相关工具函数
 */

import React from 'react';

/** 需求类型码值归一（兼容大小写、连字符） */
export function normalizeDemandTypeKey(v: string | undefined | null): string {
  return (v ?? '').trim().toLowerCase().replace(/-/g, '_');
}

export const DEMAND_TYPE_LABEL: Record<string, string> = {
  sales_forecast: '销售预测',
  sales_order: '销售订单',
  demand_plan: '需求计划',
};

/** 需求计划：淡橙底，与预测（蓝）、订单（绿）区分 */
export const DEMAND_PLAN_TYPE_TAG_STYLE: React.CSSProperties = {
  color: '#d46b08',
  background: '#fff7e6',
  borderColor: '#ffd591',
};

/** 需求类型展示文案（未知码值回退为原字符串，避免界面出现「空白」） */
export function getDemandTypeLabel(v: string | undefined | null): string {
  const k = normalizeDemandTypeKey(v);
  return DEMAND_TYPE_LABEL[k] ?? (v?.trim() || '-');
}

export function getDemandTypeTagProps(
  v: string | undefined | null,
): { color?: string; style?: React.CSSProperties } {
  const k = normalizeDemandTypeKey(v);
  if (k === 'sales_forecast') return { color: 'processing' };
  if (k === 'sales_order') return { color: 'success' };
  if (k === 'demand_plan') return { style: DEMAND_PLAN_TYPE_TAG_STYLE };
  return { color: 'default' };
}
