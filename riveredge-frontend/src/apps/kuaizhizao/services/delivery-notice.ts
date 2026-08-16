/**
 * 送货单 API
 */

import { apiRequest } from '../../../services/api';

export type DeliveryNoticePullPreviewLine = {
  item_id: number;
  material_id: number;
  material_code: string;
  material_name: string;
  material_unit: string;
  quantity: number;
  pushed_quantity: number;
  max_push_quantity: number;
  unit_price: number;
};

export type DeliveryNoticePullPreview = {
  sales_delivery_id: number;
  sales_delivery_code: string;
  customer_id: number;
  customer_name: string;
  customer_contact?: string | null;
  customer_phone?: string | null;
  sales_order_id?: number | null;
  sales_order_code?: string | null;
  planned_delivery_date?: string | null;
  shipping_address?: string | null;
  items: DeliveryNoticePullPreviewLine[];
  message?: string | null;
};

export type DeliveryNoticePullCandidate = {
  id: number;
  delivery_code: string;
  sales_order_id?: number | null;
  sales_order_code?: string | null;
  customer_id: number;
  customer_name: string;
  status: string;
  delivery_date?: string | null;
  updated_at?: string | null;
  pullable: boolean;
  capabilities?: {
    push_delivery_notice?: { allowed: boolean; reason?: string | null };
  };
};

export type DeliveryNoticePullLine = {
  id: number;
  sales_delivery_id: number;
  delivery_code?: string;
  customer_id?: number;
  customer_name?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string | null;
  unit?: string;
  suggested_quantity?: number;
  pushed_quantity?: number;
  remaining_quantity?: number;
  required_date?: string | null;
};

export const deliveryNoticeApi = {
  list: async (params?: any) => apiRequest('/apps/kuaizhizao/delivery-notices', { method: 'GET', params }),
  listPullCandidates: async (params?: { skip?: number; limit?: number; keyword?: string }) =>
    apiRequest('/apps/kuaizhizao/delivery-notices/pull-candidates', { method: 'GET', params }),
  listSalesDeliveryPullLines: async (params: {
    skip?: number;
    limit?: number;
    keyword?: string;
    sales_delivery_id?: number;
    pullable_only?: boolean;
  }): Promise<{ data: DeliveryNoticePullLine[]; total: number }> =>
    apiRequest('/apps/kuaizhizao/delivery-notices/sales-delivery-pull-lines', {
      method: 'GET',
      params,
    }),
  pullFromSalesDeliveryItems: async (
    selectedItemIds: number[],
  ): Promise<{
    success: boolean;
    message: string;
    notice_id?: number;
    notice_code?: string;
    notices?: Array<{ notice_id: number; notice_code: string }>;
  }> =>
    apiRequest('/apps/kuaizhizao/delivery-notices/pull-from-sales-delivery-items', {
      method: 'POST',
      data: { selected_item_ids: selectedItemIds },
    }),
  previewFromSalesDelivery: async (salesDeliveryId: number): Promise<DeliveryNoticePullPreview> =>
    apiRequest('/apps/kuaizhizao/delivery-notices/sales-delivery-preview', {
      method: 'GET',
      params: { sales_delivery_id: salesDeliveryId },
    }),
  create: async (data: any) => apiRequest('/apps/kuaizhizao/delivery-notices', { method: 'POST', data }),
  update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/delivery-notices/${id}`, { method: 'PUT', data }),
  delete: async (id: string) => apiRequest(`/apps/kuaizhizao/delivery-notices/${id}`, { method: 'DELETE' }),
  get: async (id: string) => apiRequest(`/apps/kuaizhizao/delivery-notices/${id}`, { method: 'GET' }),
  send: async (id: string) => apiRequest(`/apps/kuaizhizao/delivery-notices/${id}/send`, { method: 'POST' }),
  print: async (id: string, templateUuid?: string) =>
    apiRequest(`/apps/kuaizhizao/delivery-notices/${id}/print`, {
      method: 'GET',
      params: templateUuid ? { template_uuid: templateUuid } : undefined,
    }),
};
