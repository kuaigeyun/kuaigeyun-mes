/**
 * 组装单相关服务
 */

import { apiRequest } from '../../../services/api';

export const assemblyOrderApi = {
  list: async (params?: any) => {
    try {
      return await apiRequest('/apps/kuaizhizao/assembly-orders', { method: 'GET', params });
    } catch {
      return { items: [], total: 0 };
    }
  },
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/assembly-orders', { method: 'POST', data });
  },
  update: async (id: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/assembly-orders/${id}`, { method: 'PUT', data });
  },
  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/assembly-orders/${id}`, { method: 'GET' });
  },
  createItem: async (orderId: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/assembly-orders/${orderId}/items`, { method: 'POST', data });
  },
  updateItem: async (orderId: string, itemId: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/assembly-orders/${orderId}/items/${itemId}`, { method: 'PUT', data });
  },
  deleteItem: async (orderId: string, itemId: string) => {
    return apiRequest(`/apps/kuaizhizao/assembly-orders/${orderId}/items/${itemId}`, { method: 'DELETE' });
  },
  execute: async (orderId: string) => {
    return apiRequest(`/apps/kuaizhizao/assembly-orders/${orderId}/execute`, { method: 'POST' });
  },
  applyTemplate: async (
    orderId: string,
    data: { template_id: number; replace_existing: boolean }
  ) => {
    return apiRequest(`/apps/kuaizhizao/assembly-orders/${orderId}/apply-template`, {
      method: 'POST',
      data,
    });
  },
  delete: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/assembly-orders/${id}`, { method: 'DELETE' });
  },
};
