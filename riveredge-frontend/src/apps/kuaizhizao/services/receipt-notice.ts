/**
 * 收货通知单 API
 */

import { apiRequest } from '../../../services/api';

export interface ActionCapability {
  allowed: boolean;
  reason?: string | null;
}

export interface ReceiptNoticeCapabilities {
  update?: ActionCapability;
  delete?: ActionCapability;
  notify?: ActionCapability;
  withdraw?: ActionCapability;
  print?: ActionCapability;
}

export interface ReceiptNotice {
  id?: number;
  notice_code?: string;
  purchase_order_id?: number;
  purchase_order_code?: string;
  supplier_id?: number;
  supplier_name?: string;
  supplier_contact?: string;
  supplier_phone?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  planned_receipt_date?: string;
  status?: string;
  notified_at?: string;
  purchase_receipt_id?: number;
  purchase_receipt_code?: string;
  total_quantity?: number;
  total_amount?: number;
  notes?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  created_at?: string;
  updated_at?: string;
  lifecycle?: Record<string, unknown>;
  capabilities?: ReceiptNoticeCapabilities;
}

export interface ReceiptNoticeNotifyPreviewResponse {
  target_type: string;
  summary: string;
  notice_code?: string;
  warehouse_required?: boolean;
  warehouse_id?: number | null;
  items: Array<{
    item_id?: number;
    purchase_order_item_id?: number | null;
    material_code: string;
    material_name: string;
    quantity: number;
    pushed_quantity?: number;
    max_push_quantity?: number;
    notice_quantity?: number;
  }>;
  tip?: string;
  has_blocking_issues?: boolean;
  blocking_reason?: string | null;
  line_blocking_issues?: string[];
}

const RECEIPT_NOTICE_LIMIT_MAX = 1000;

export interface ReceiptNoticeListParams {
  skip?: number;
  limit?: number;
  status?: string;
  purchase_order_id?: number;
  supplier_id?: number;
  warehouse_id?: number;
  keyword?: string;
  notice_code?: string;
  purchase_order_code?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  created_start_date?: string;
  created_end_date?: string;
  order_by?: string;
  /** 明细表格视图：附带通知明细 */
  include_items?: boolean;
}

export interface ReceiptNoticeListResult {
  data: ReceiptNotice[];
  total: number;
  success: boolean;
}

function clampReceiptNoticeLimit(limit: unknown): number | undefined {
  if (typeof limit !== 'number' || Number.isNaN(limit)) return undefined;
  return Math.max(1, Math.min(RECEIPT_NOTICE_LIMIT_MAX, Math.trunc(limit)));
}

export const receiptNoticeApi = {
  list: async (params?: ReceiptNoticeListParams): Promise<ReceiptNoticeListResult> => {
    const limit = clampReceiptNoticeLimit(params?.limit);
    const safeParams = limit != null ? { ...params, limit } : params;
    return apiRequest('/apps/kuaizhizao/receipt-notices', { method: 'GET', params: safeParams });
  },
  create: async (data: any) => apiRequest('/apps/kuaizhizao/receipt-notices', { method: 'POST', data }),
  update: async (id: string, data: any) =>
    apiRequest(`/apps/kuaizhizao/receipt-notices/${id}`, { method: 'PUT', data }),
  delete: async (id: string) => apiRequest(`/apps/kuaizhizao/receipt-notices/${id}`, { method: 'DELETE' }),
  get: async (id: string) => apiRequest(`/apps/kuaizhizao/receipt-notices/${id}`, { method: 'GET' }),
  previewNotify: async (id: string) =>
    apiRequest<ReceiptNoticeNotifyPreviewResponse>(`/apps/kuaizhizao/receipt-notices/${id}/notify/preview`, {
      method: 'GET',
    }),
  notify: async (id: string) =>
    apiRequest(`/apps/kuaizhizao/receipt-notices/${id}/notify`, { method: 'POST' }),
  statistics: async () =>
    apiRequest<{ total: number; pending: number; notified: number; received: number }>(
      '/apps/kuaizhizao/receipt-notices/statistics',
      { method: 'GET' },
    ),
  withdraw: async (id: string) =>
    apiRequest(`/apps/kuaizhizao/receipt-notices/${id}/withdraw`, { method: 'POST' }),
};
