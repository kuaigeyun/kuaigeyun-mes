/**
 * 拆卸单相关服务
 */

import { apiRequest } from '../../../services/api';

export const disassemblyOrderApi = {
  list: async (params?: any) => {
    try {
      return await apiRequest('/apps/kuaizhizao/disassembly-orders', { method: 'GET', params });
    } catch {
      return { items: [], total: 0 };
    }
  },
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/disassembly-orders', { method: 'POST', data });
  },
  update: async (id: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/disassembly-orders/${id}`, { method: 'PUT', data });
  },
  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/disassembly-orders/${id}`, { method: 'GET' });
  },
  createItem: async (orderId: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/disassembly-orders/${orderId}/items`, { method: 'POST', data });
  },
  updateItem: async (orderId: string, itemId: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/disassembly-orders/${orderId}/items/${itemId}`, { method: 'PUT', data });
  },
  execute: async (orderId: string) => {
    return apiRequest(`/apps/kuaizhizao/disassembly-orders/${orderId}/execute`, { method: 'POST' });
  },
};
