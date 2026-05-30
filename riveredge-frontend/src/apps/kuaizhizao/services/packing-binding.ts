/**
 * 装箱打包绑定相关服务
 */

import { apiRequest } from '../../../services/api';

export const packingBindingApi = {
  // 获取装箱绑定记录列表
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/packing-bindings', { method: 'GET', params });
  },

  // 获取装箱绑定记录分页（含总数）
  listPage: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/packing-bindings/page', { method: 'GET', params });
  },

  // 获取装箱绑定统计
  statistics: async () => {
    return apiRequest('/apps/kuaizhizao/packing-bindings/statistics', { method: 'GET' });
  },

  // 获取待装箱任务池（只读）
  taskPool: async (params?: { limit?: number }) => {
    return apiRequest('/apps/kuaizhizao/packing-bindings/task-pool', { method: 'GET', params });
  },

  // 获取装箱绑定记录详情
  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/packing-bindings/${id}`, { method: 'GET' });
  },

  // 更新装箱绑定记录
  update: async (id: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/packing-bindings/${id}`, { method: 'PUT', data });
  },

  // 删除装箱绑定记录
  delete: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/packing-bindings/${id}`, { method: 'DELETE' });
  },

  // 从成品入库单创建装箱绑定
  createFromReceipt: async (receiptId: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/finished-goods-receipts/${receiptId}/packing-binding`, {
      method: 'POST',
      data,
    });
  },

  // 获取成品入库单的装箱绑定记录列表
  getByReceipt: async (receiptId: string) => {
    return apiRequest(`/apps/kuaizhizao/finished-goods-receipts/${receiptId}/packing-binding`, {
      method: 'GET',
    });
  },

  // 生成装箱二维码
  generateQRCode: async (boxUuid: string, boxNo: string, productName?: string): Promise<any> => {
    const { qrcodeApi } = await import('../../../services/qrcode');
    return qrcodeApi.generateBox({
      box_uuid: boxUuid,
      box_code: boxNo,
      material_codes: [],
    });
  },
};
