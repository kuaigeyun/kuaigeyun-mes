/**
 * 订单变更明细「变更类型」徽章（非流程状态，filled）
 */

import React from 'react';
import type { TFunction } from 'i18next';
import { MarkerTag } from '../../../constants/statusBadges';

export const ORDER_CHANGE_LINE_TYPE_CODES = [
  'QUANTITY',
  'DELIVERY_DATE',
  'UNIT_PRICE',
  'LINE_CANCEL',
  'LINE_ADD',
] as const;

export type OrderChangeLineTypeCode = (typeof ORDER_CHANGE_LINE_TYPE_CODES)[number];

/** 变更类型 MarkerTag 颜色（分类标识，filled） */
export function getOrderChangeTypeMarkerColor(type: string | undefined | null): string {
  switch (String(type ?? '').toUpperCase()) {
    case 'QUANTITY':
      return 'blue';
    case 'UNIT_PRICE':
      return 'gold';
    case 'DELIVERY_DATE':
      return 'cyan';
    case 'LINE_ADD':
      return 'success';
    case 'LINE_CANCEL':
      return 'error';
    default:
      return 'default';
  }
}

export function translateOrderChangeLineType(t: TFunction, type: string | undefined | null): string {
  switch (String(type ?? '').toUpperCase()) {
    case 'QUANTITY':
      return t('common.quantity');
    case 'DELIVERY_DATE':
      return t('app.kuaizhizao.orderChange.changeTypeDeliveryDate');
    case 'UNIT_PRICE':
      return t('app.kuaizhizao.orderChange.changeTypeUnitPrice');
    case 'LINE_CANCEL':
      return t('app.kuaizhizao.orderChange.changeTypeLineCancel');
    case 'LINE_ADD':
      return t('app.kuaizhizao.orderChange.changeTypeLineAdd');
    default:
      return type?.trim() || '-';
  }
}

export function renderOrderChangeTypeMarkerTag(
  t: TFunction,
  type: string | undefined | null,
): React.ReactNode {
  const label = translateOrderChangeLineType(t, type);
  if (label === '-') return '-';
  return React.createElement(MarkerTag, { color: getOrderChangeTypeMarkerColor(type) }, label);
}
