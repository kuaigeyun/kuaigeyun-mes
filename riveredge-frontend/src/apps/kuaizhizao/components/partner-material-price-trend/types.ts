/**
 * 客商物料价格趋势 API 类型与请求
 */

import { getSalesOrderPriceTrend } from '../../services/sales-order';
import { getPurchaseOrderPriceTrend } from '../../services/purchase';

export type PartnerMaterialPriceTrendSide = 'sales' | 'purchase';

export interface PartnerMaterialPriceTrendItem {
  order_id: number;
  order_code: string;
  order_date: string;
  partner_id: number;
  partner_name: string;
  unit_price: number;
  quantity?: number;
}

export interface PartnerMaterialPriceTrendPoint {
  date: string;
  price: number;
  order_code: string;
}

export interface PartnerMaterialPriceTrendResponse {
  side: PartnerMaterialPriceTrendSide;
  material_id: number;
  partner_id: number;
  partner_name?: string | null;
  history_items: PartnerMaterialPriceTrendItem[];
  trend_points: PartnerMaterialPriceTrendPoint[];
  average_price: number;
  min_price: number;
  max_price: number;
}

export const PARTNER_MATERIAL_PRICE_TREND_RESOURCE: Record<PartnerMaterialPriceTrendSide, string> = {
  sales: 'kuaizhizao:sales-order-price-trend',
  purchase: 'kuaizhizao:purchase-order-price-trend',
};

export function partnerMaterialPriceTrendQueryKey(
  side: PartnerMaterialPriceTrendSide,
  materialId?: number | null,
  partnerId?: number | null,
) {
  return ['partnerMaterialPriceTrend', side, materialId ?? null, partnerId ?? null] as const;
}

export async function fetchPartnerMaterialPriceTrend(
  side: PartnerMaterialPriceTrendSide,
  materialId: number,
  partnerId: number,
  limit = 10,
): Promise<PartnerMaterialPriceTrendResponse> {
  if (side === 'sales') {
    return getSalesOrderPriceTrend({ materialId, customerId: partnerId, limit });
  }
  return getPurchaseOrderPriceTrend({ materialId, supplierId: partnerId, limit });
}
