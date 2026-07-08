/**
 * 装箱打包绑定相关服务
 */

import { apiRequest } from '../../../services/api';

export interface PackingBindingListParams {
  skip?: number;
  limit?: number;
  receipt_id?: number;
  sales_delivery_id?: number;
  product_id?: number;
  box_no?: string;
  uuid?: string;
  keyword?: string;
  product_code?: string;
  product_name?: string;
  product_serial_no?: string;
  packing_material_name?: string;
  binding_method?: string;
  source_type?: string;
  bound_at_start_date?: string;
  bound_at_end_date?: string;
  created_start_date?: string;
  created_end_date?: string;
  order_by?: string;
}

export interface PackingBindingListResult {
  data: Record<string, unknown>[];
  total: number;
  success: boolean;
}

export const packingBindingApi = {
  list: async (params?: PackingBindingListParams) => {
    return apiRequest('/apps/kuaizhizao/packing-bindings', { method: 'GET', params });
  },

  listPage: async (params?: PackingBindingListParams): Promise<PackingBindingListResult> => {
    const raw = await apiRequest<PackingBindingListResult>(
      '/apps/kuaizhizao/packing-bindings/page',
      { method: 'GET', params },
    );
    const rows = raw?.data ?? [];
    return {
      data: rows,
      total: raw?.total ?? rows.length,
      success: raw?.success !== false,
    };
  },

  statistics: async () => {
    return apiRequest('/apps/kuaizhizao/packing-bindings/statistics', { method: 'GET' });
  },

  taskPool: async (params?: { limit?: number }) => {
    return apiRequest('/apps/kuaizhizao/packing-bindings/task-pool', { method: 'GET', params });
  },

  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/packing-bindings/${id}`, { method: 'GET' });
  },

  update: async (id: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/packing-bindings/${id}`, { method: 'PUT', data });
  },

  delete: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/packing-bindings/${id}`, { method: 'DELETE' });
  },

  createFromReceipt: async (receiptId: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/finished-goods-receipts/${receiptId}/packing-binding`, {
      method: 'POST',
      data,
    });
  },

  getByReceipt: async (receiptId: string) => {
    return apiRequest(`/apps/kuaizhizao/finished-goods-receipts/${receiptId}/packing-binding`, {
      method: 'GET',
    });
  },

  generateQRCode: async (boxUuid: string, boxNo: string, productName?: string): Promise<any> => {
    const { qrcodeApi } = await import('../../../services/qrcode');
    return qrcodeApi.generateBox({
      box_uuid: boxUuid,
      box_code: boxNo,
      material_codes: [],
    });
  },
};
