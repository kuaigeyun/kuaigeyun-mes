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

const RECEIPT_NOTICE_LIMIT_MAX = 100;

function clampReceiptNoticeLimit(limit: unknown): number | undefined {
  if (typeof limit !== 'number' || Number.isNaN(limit)) return undefined;
  return Math.max(1, Math.min(RECEIPT_NOTICE_LIMIT_MAX, Math.trunc(limit)));
}

export const receiptNoticeApi = {
  list: async (params?: Record<string, any>) => {
    const limit = clampReceiptNoticeLimit(params?.limit);
    const safeParams = limit != null ? { ...params, limit } : params;
    return apiRequest('/apps/kuaizhizao/receipt-notices', { method: 'GET', params: safeParams });
  },
  create: async (data: any) => apiRequest('/apps/kuaizhizao/receipt-notices', { method: 'POST', data }),
  update: async (id: string, data: any) =>
    apiRequest(`/apps/kuaizhizao/receipt-notices/${id}`, { method: 'PUT', data }),
  delete: async (id: string) => apiRequest(`/apps/kuaizhizao/receipt-notices/${id}`, { method: 'DELETE' }),
  get: async (id: string) => apiRequest(`/apps/kuaizhizao/receipt-notices/${id}`, { method: 'GET' }),
  notify: async (id: string) =>
    apiRequest(`/apps/kuaizhizao/receipt-notices/${id}/notify`, { method: 'POST' }),
  withdraw: async (id: string) =>
    apiRequest(`/apps/kuaizhizao/receipt-notices/${id}/withdraw`, { method: 'POST' }),
};
