/**
 * 库存预警相关服务
 */

import { apiRequest } from '../../../services/api';

export const inventoryAlertApi = {
  // 预警规则相关
  // 创建预警规则
  createRule: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/inventory-alert-rules', {
      method: 'POST',
      data,
    });
  },

  // 获取预警规则列表
  listRules: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/inventory-alert-rules', {
      method: 'GET',
      params,
    });
  },

  // 获取预警规则详情
  getRule: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/inventory-alert-rules/${id}`, {
      method: 'GET',
    });
  },

  // 更新预警规则
  updateRule: async (id: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/inventory-alert-rules/${id}`, {
      method: 'PUT',
      data,
    });
  },

  // 删除预警规则
  deleteRule: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/inventory-alert-rules/${id}`, {
      method: 'DELETE',
    });
  },

  // 预警记录相关
  // 获取预警记录列表
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/inventory-alerts', {
      method: 'GET',
      params,
    });
  },

  // 获取预警记录详情
  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/inventory-alerts/${id}`, {
      method: 'GET',
    });
  },

  // 处理预警
  handle: async (id: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/inventory-alerts/${id}/handle`, {
      method: 'POST',
      data,
    });
  },

  // 获取预警统计信息
  getStatistics: async () => {
    return apiRequest('/apps/kuaizhizao/inventory-alerts/statistics', {
      method: 'GET',
    });
  },
};
