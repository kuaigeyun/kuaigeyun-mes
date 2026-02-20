/**
 * 送货单 API
 */

import { apiRequest } from '../../../services/api';

export const deliveryNoticeApi = {
  list: async (params?: any) => apiRequest('/apps/kuaizhizao/delivery-notices', { method: 'GET', params }),
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
