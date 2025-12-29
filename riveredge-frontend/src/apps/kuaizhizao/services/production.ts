/**
 * 生产执行相关服务
 */

import { api } from '../../../services/api';

// 工单相关接口
export const workOrderApi = {
  // 获取工单列表
  list: async (params?: any) => {
    return api.get('/apps/kuaizhizao/production/work-orders', { params });
  },

  // 创建工单
  create: async (data: any) => {
    return api.post('/apps/kuaizhizao/production/work-orders', data);
  },

  // 更新工单
  update: async (id: string, data: any) => {
    return api.put(`/apps/kuaizhizao/production/work-orders/${id}`, data);
  },

  // 删除工单
  delete: async (id: string) => {
    return api.delete(`/apps/kuaizhizao/production/work-orders/${id}`);
  },

  // 获取工单详情
  get: async (id: string) => {
    return api.get(`/apps/kuaizhizao/production/work-orders/${id}`);
  },

  // 下达工单
  release: async (id: string) => {
    return api.post(`/apps/kuaizhizao/production/work-orders/${id}/release`);
  },
};

// 报工相关接口
export const reportingApi = {
  // 获取报工记录列表
  list: async (params?: any) => {
    return api.get('/apps/kuaizhizao/production/reporting', { params });
  },

  // 提交报工
  create: async (data: any) => {
    return api.post('/apps/kuaizhizao/production/reporting', data);
  },

  // 审核报工
  approve: async (id: string, data: any) => {
    return api.post(`/apps/kuaizhizao/production/reporting/${id}/approve`, data);
  },

  // 驳回报工
  reject: async (id: string, data: any) => {
    return api.post(`/apps/kuaizhizao/production/reporting/${id}/reject`, data);
  },

  // 获取报工统计
  getStatistics: async (params?: any) => {
    return api.get('/apps/kuaizhizao/production/reporting/statistics', { params });
  },
};
