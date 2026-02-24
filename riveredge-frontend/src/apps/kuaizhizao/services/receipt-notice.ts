/**
 * 收货通知单 API
 */

import { apiRequest } from '../../../services/api';

export const receiptNoticeApi = {
  list: async (params?: Record<string, any>) =>
    apiRequest('/apps/kuaizhizao/receipt-notices', { method: 'GET', params }),
  create: async (data: any) => apiRequest('/apps/kuaizhizao/receipt-notices', { method: 'POST', data }),
  update: async (id: string, data: any) =>
    apiRequest(`/apps/kuaizhizao/receipt-notices/${id}`, { method: 'PUT', data }),
  delete: async (id: string) => apiRequest(`/apps/kuaizhizao/receipt-notices/${id}`, { method: 'DELETE' }),
  get: async (id: string) => apiRequest(`/apps/kuaizhizao/receipt-notices/${id}`, { method: 'GET' }),
  notify: async (id: string) =>
    apiRequest(`/apps/kuaizhizao/receipt-notices/${id}/notify`, { method: 'POST' }),
};
