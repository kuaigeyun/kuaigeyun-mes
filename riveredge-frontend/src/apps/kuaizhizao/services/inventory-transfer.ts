/**
 * 库存调拨相关服务
 */

import { apiRequest } from '../../../services/api';

export const inventoryTransferApi = {
  // 获取调拨单列表
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/inventory-transfers', { method: 'GET', params });
  },

  // 创建调拨单
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/inventory-transfers', { method: 'POST', data });
  },

  // 更新调拨单
  update: async (id: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/inventory-transfers/${id}`, { method: 'PUT', data });
  },

  // 获取调拨单详情
  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/inventory-transfers/${id}`, { method: 'GET' });
  },

  // 添加调拨明细
  createItem: async (transferId: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/inventory-transfers/${transferId}/items`, { method: 'POST', data });
  },

  // 更新调拨明细
  updateItem: async (transferId: string, itemId: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/inventory-transfers/${transferId}/items/${itemId}`, { method: 'PUT', data });
  },

  // 执行调拨（更新库存）
  execute: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/inventory-transfers/${id}/execute`, { method: 'POST' });
  },

  // 删除调拨单
  delete: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/inventory-transfers/${id}`, { method: 'DELETE' });
  },
};
