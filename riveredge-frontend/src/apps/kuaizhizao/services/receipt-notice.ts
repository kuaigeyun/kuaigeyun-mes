/**
 * 收货通知单 API
 */

import { apiRequest } from '../../../services/api';

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
