/**
 * 采购物流记录 API
 */

import { apiRequest } from '../../../services/api';

export interface PurchaseLogistics {
  id?: number;
  tenant_id?: number;
  purchase_order_id?: number;
  purchase_order_code?: string;
  supplier_id?: number;
  supplier_name?: string;
  carrier?: string;
  tracking_number?: string;
  shipped_at?: string;
  expected_arrival?: string;
  status?: string;
  receipt_notice_id?: number;
  receipt_notice_code?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export const purchaseLogisticsApi = {
  list: async (params?: Record<string, any>) =>
    apiRequest('/apps/kuaizhizao/purchase-logistics', { method: 'GET', params }),
  create: async (data: Partial<PurchaseLogistics>) =>
    apiRequest('/apps/kuaizhizao/purchase-logistics', { method: 'POST', data }),
  get: async (id: string) =>
    apiRequest(`/apps/kuaizhizao/purchase-logistics/${id}`, { method: 'GET' }),
  update: async (id: string, data: Partial<PurchaseLogistics>) =>
    apiRequest(`/apps/kuaizhizao/purchase-logistics/${id}`, { method: 'PUT', data }),
  delete: async (id: string) =>
    apiRequest(`/apps/kuaizhizao/purchase-logistics/${id}`, { method: 'DELETE' }),
};
