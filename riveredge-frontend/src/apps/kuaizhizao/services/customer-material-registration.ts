/**
 * 客户来料登记相关服务
 */

import { apiRequest } from '../../../services/api';

export const customerMaterialRegistrationApi = {
  // 解析客户来料条码
  parseBarcode: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/inventory/customer-material-registration/parse-barcode', {
      method: 'POST',
      data,
    });
  },

  // 创建客户来料登记
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/inventory/customer-material-registration', {
      method: 'POST',
      data,
    });
  },

  // 获取客户来料登记列表
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/inventory/customer-material-registration', {
      method: 'GET',
      params,
    });
  },

  // 获取客户来料登记详情
  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/inventory/customer-material-registration/${id}`, {
      method: 'GET',
    });
  },

  // 处理客户来料登记（入库）
  process: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/inventory/customer-material-registration/${id}/process`, {
      method: 'POST',
    });
  },

  // 取消客户来料登记
  cancel: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/inventory/customer-material-registration/${id}/cancel`, {
      method: 'POST',
    });
  },
};
