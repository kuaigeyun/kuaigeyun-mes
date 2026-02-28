/**
 * 库存盘点相关服务
 */

import { apiRequest } from '../../../services/api';

export const stocktakingApi = {
  // 获取盘点单列表
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/stocktakings', { method: 'GET', params });
  },

  // 创建盘点单
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/stocktakings', { method: 'POST', data });
  },

  // 更新盘点单
  update: async (id: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${id}`, { method: 'PUT', data });
  },

  // 获取盘点单详情
  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${id}`, { method: 'GET' });
  },

  // 开始盘点
  start: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${id}/start`, { method: 'POST' });
  },

  // 添加盘点明细
  createItem: async (stocktakingId: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${stocktakingId}/items`, { method: 'POST', data });
  },

  // 更新盘点明细
  updateItem: async (stocktakingId: string, itemId: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${stocktakingId}/items/${itemId}`, { method: 'PUT', data });
  },

  // 执行盘点明细（记录实际数量）
  executeItem: async (stocktakingId: string, itemId: string, actualQuantity: number, remarks?: string) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${stocktakingId}/items/${itemId}/execute`, {
      method: 'POST',
      data: { actual_quantity: actualQuantity, remarks },
    });
  },

  // 处理盘点差异（调整库存）
  adjust: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${id}/adjust`, { method: 'POST' });
  },

  // 删除盘点单
  delete: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${id}`, { method: 'DELETE' });
  },
};
