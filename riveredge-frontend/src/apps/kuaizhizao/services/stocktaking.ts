/**
 * 库存盘点相关服务
 */

import { apiRequest } from '../../../services/api';

export const stocktakingApi = {
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/stocktakings', { method: 'GET', params });
  },

  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/stocktakings', { method: 'POST', data });
  },

  update: async (id: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${id}`, { method: 'PUT', data });
  },

  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${id}`, { method: 'GET' });
  },

  start: async (id: string, data?: { line_granularity?: string; include_zero_stock?: boolean }) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${id}/start`, { method: 'POST', data: data ?? {} });
  },

  createItem: async (stocktakingId: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${stocktakingId}/items`, { method: 'POST', data });
  },

  bulkCreateItems: async (stocktakingId: string, items: any[]) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${stocktakingId}/items/bulk`, {
      method: 'POST',
      data: { items },
    });
  },

  updateItem: async (stocktakingId: string, itemId: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${stocktakingId}/items/${itemId}`, { method: 'PUT', data });
  },

  executeItem: async (stocktakingId: string, itemId: string, actualQuantity: number, remarks?: string) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${stocktakingId}/items/${itemId}/execute`, {
      method: 'POST',
      data: { actual_quantity: actualQuantity, remarks },
    });
  },

  complete: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${id}/complete`, { method: 'POST' });
  },

  withdraw: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${id}/withdraw`, { method: 'POST' });
  },

  adjust: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${id}/adjust`, { method: 'POST' });
  },

  delete: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${id}`, { method: 'DELETE' });
  },
};

export const inventoryReportApi = {
  batchLines: async (params?: Record<string, unknown>) => {
    return apiRequest('/apps/kuaizhizao/reports/inventory/batch-lines', { method: 'GET', params });
  },
  materialBalances: async (params?: Record<string, unknown>) => {
    return apiRequest('/apps/kuaizhizao/reports/inventory/material-balances', { method: 'GET', params });
  },
};
