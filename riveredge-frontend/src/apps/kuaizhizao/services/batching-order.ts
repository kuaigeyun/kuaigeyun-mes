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
  syncFromWorkOrder: async (id: string | number) => {
    return apiRequest(`/apps/kuaizhizao/batching-orders/${id}/sync-from-work-order`, { method: 'POST' });
  },
  confirm: async (
    id: string,
    data?: {
      item_batches?: {
        item_id: number;
        batch_no?: string;
        pick_quantity?: number;
        skip?: boolean;
      }[];
    },
  ) => {
    return apiRequest(`/apps/kuaizhizao/batching-orders/${id}/confirm`, { method: 'POST', data: data ?? {} });
  },
  listTasks: async (params?: Record<string, unknown>) => {
    try {
      return await apiRequest('/apps/kuaizhizao/batching-center/tasks', { method: 'GET', params });
    } catch {
      return { items: [], total: 0 };
    }
  },
};
