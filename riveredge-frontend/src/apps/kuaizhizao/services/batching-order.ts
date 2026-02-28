/**
 * 配料单相关服务
 */

import { apiRequest } from '../../../services/api';

export const batchingOrderApi = {
  list: async (params?: any) => {
    try {
      return await apiRequest('/apps/kuaizhizao/batching-orders', { method: 'GET', params });
    } catch {
      return { items: [], total: 0 };
    }
  },
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/batching-orders', { method: 'POST', data });
  },
  update: async (id: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/batching-orders/${id}`, { method: 'PUT', data });
  },
  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/batching-orders/${id}`, { method: 'GET' });
  },
  delete: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/batching-orders/${id}`, { method: 'DELETE' });
  },
  pullFromWorkOrder: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/batching-orders/pull-from-work-order', { method: 'POST', data });
  },
  confirm: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/batching-orders/${id}/confirm`, { method: 'POST' });
  },
};
