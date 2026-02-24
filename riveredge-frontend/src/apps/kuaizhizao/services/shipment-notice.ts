/**
 * 发货通知单 API
 */

import { apiRequest } from '../../../services/api';

export const shipmentNoticeApi = {
  list: async (params?: Record<string, any>) =>
    apiRequest('/apps/kuaizhizao/shipment-notices', { method: 'GET', params }),
  create: async (data: any) => apiRequest('/apps/kuaizhizao/shipment-notices', { method: 'POST', data }),
  update: async (id: string, data: any) =>
    apiRequest(`/apps/kuaizhizao/shipment-notices/${id}`, { method: 'PUT', data }),
  delete: async (id: string) => apiRequest(`/apps/kuaizhizao/shipment-notices/${id}`, { method: 'DELETE' }),
  get: async (id: string) => apiRequest(`/apps/kuaizhizao/shipment-notices/${id}`, { method: 'GET' }),
  notify: async (id: string) =>
    apiRequest(`/apps/kuaizhizao/shipment-notices/${id}/notify`, { method: 'POST' }),
};
