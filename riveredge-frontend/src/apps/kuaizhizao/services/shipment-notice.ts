/**
 * 发货通知单 API
 */

import { apiRequest } from '../../../services/api';

export interface ActionCapability {
  allowed: boolean;
  reason?: string | null;
}

export interface ShipmentNoticeCapabilities {
  update: ActionCapability;
  delete: ActionCapability;
  notify: ActionCapability;
  withdraw: ActionCapability;
  print: ActionCapability;
}

export interface ShipmentNotice {
  id?: number;
  notice_code?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  customer_id?: number;
  customer_name?: string;
  customer_contact?: string;
  customer_phone?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  planned_ship_date?: string;
  shipping_address?: string;
  status?: string;
  notified_at?: string;
  sales_delivery_id?: number;
  sales_delivery_code?: string;
  total_quantity?: number;
  total_amount?: number;
  notes?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  created_at?: string;
  lifecycle?: Record<string, unknown>;
  capabilities?: ShipmentNoticeCapabilities;
  items?: ShipmentNoticeItem[];
}

export interface ShipmentNoticeItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  notice_quantity?: number;
  unit_price?: number;
  total_amount?: number;
  sales_order_item_id?: number;
  notes?: string;
}

export interface ShipmentNoticeNotifyPayload {
  warehouse_id?: number;
  warehouse_name?: string;
}

export interface ShipmentNoticePushPreviewResponse {
  target_type: string;
  summary: string;
  items: {
    item_id?: number;
    material_code: string;
    material_name: string;
    quantity: number;
    pushed_quantity?: number;
    max_push_quantity?: number;
    delivery_date?: string;
    suggested_action?: string;
  }[];
  tip?: string;
  has_blocking_issues?: boolean;
  blocking_reason?: string | null;
}

export interface ShipmentNoticeNotifyPreviewResponse {
  target_type: string;
  summary: string;
  notice_code?: string;
  warehouse_required?: boolean;
  warehouse_id?: number | null;
  items: {
    item_id?: number;
    sales_order_item_id?: number | null;
    material_code: string;
    material_name: string;
    quantity: number;
    pushed_quantity?: number;
    max_push_quantity?: number;
    notice_quantity?: number;
  }[];
  tip?: string;
  has_blocking_issues?: boolean;
  blocking_reason?: string | null;
  line_blocking_issues?: string[];
}

export const shipmentNoticeApi = {
  list: async (params?: Record<string, any>) =>
    apiRequest('/apps/kuaizhizao/shipment-notices', { method: 'GET', params }),
  create: async (data: any) => apiRequest('/apps/kuaizhizao/shipment-notices', { method: 'POST', data }),
  update: async (id: string, data: any) =>
    apiRequest(`/apps/kuaizhizao/shipment-notices/${id}`, { method: 'PUT', data }),
  delete: async (id: string) => apiRequest(`/apps/kuaizhizao/shipment-notices/${id}`, { method: 'DELETE' }),
  get: async (id: string) => apiRequest(`/apps/kuaizhizao/shipment-notices/${id}`, { method: 'GET' }),
  notify: async (id: string, data?: ShipmentNoticeNotifyPayload) =>
    apiRequest(`/apps/kuaizhizao/shipment-notices/${id}/notify`, { method: 'POST', data: data ?? {} }),
  previewNotify: async (id: string, params?: { warehouse_id?: number }) =>
    apiRequest<ShipmentNoticeNotifyPreviewResponse>(`/apps/kuaizhizao/shipment-notices/${id}/notify/preview`, {
      method: 'GET',
      params,
    }),
  withdraw: async (id: string) =>
    apiRequest(`/apps/kuaizhizao/shipment-notices/${id}/withdraw`, { method: 'POST' }),
};
