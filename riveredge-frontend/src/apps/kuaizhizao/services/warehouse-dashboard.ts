/**
 * 仓储看板汇总 API
 */

import { apiRequest } from '../../../services/api';

export type WarehouseDashboardRecentRow = {
  doc_code: string;
  material_name: string;
  quantity: number;
  time: string | null;
  doc_type: string;
};

export type WarehouseDashboardSummary = {
  total_sku: number;
  total_quantity: number;
  low_stock: number;
  out_of_stock: number;
  high_stock: number;
  normal_stock: number;
  total_inventory_value: number;
  pending_inbound: number;
  overdue_inbound: number;
  pending_outbound: number;
  pending_inbounds: WarehouseDashboardRecentRow[];
  recent_inbounds: WarehouseDashboardRecentRow[];
  recent_outbounds: WarehouseDashboardRecentRow[];
};

export async function getWarehouseDashboardSummary(params?: {
  recent_limit?: number;
}): Promise<WarehouseDashboardSummary> {
  return apiRequest<WarehouseDashboardSummary>('/apps/kuaizhizao/warehouse-dashboard/summary', {
    method: 'GET',
    params,
  });
}
