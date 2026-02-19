/**
 * 生产计划相关 API（MRP/LRP 已合并为需求计算，productionPlan 保留）
 */

import { apiRequest } from '../../../services/api';

export const planningApi = {
  mrp: {
    compute: async (_data: any) => {
      throw new Error('MRP运算已合并为统一需求计算，请使用需求计算接口');
    },
  },
  lrp: {
    compute: async (_data: any) => {
      throw new Error('LRP运算已合并为统一需求计算，请使用需求计算接口');
    },
  },
  productionPlan: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/production-plans', { method: 'GET', params }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/production-plans/${id}`, { method: 'GET' }),
    getItems: async (id: string) => apiRequest(`/apps/kuaizhizao/production-plans/${id}/items`, { method: 'GET' }),
    execute: async (id: string) => apiRequest(`/apps/kuaizhizao/production-plans/${id}/execute`, { method: 'POST' }),
    pushToWorkOrders: async (id: number) =>
      apiRequest(`/apps/kuaizhizao/production-plans/${id}/push-to-work-orders`, { method: 'POST' }),
    getStatistics: async () => apiRequest('/apps/kuaizhizao/production-plans/statistics', { method: 'GET' }),
    getPlanningConfig: async () =>
      apiRequest<{
        production_plan_enabled: boolean;
        production_plan_audit_required: boolean;
        can_direct_generate_work_order: boolean;
        planning_mode: 'direct' | 'via_plan';
      }>('/apps/kuaizhizao/production-plans/planning-config', { method: 'GET' }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/production-plans', { method: 'POST', data }),
    update: async (id: string, data: any) =>
      apiRequest(`/apps/kuaizhizao/production-plans/${id}`, { method: 'PUT', data }),
    delete: async (id: string) => apiRequest(`/apps/kuaizhizao/production-plans/${id}`, { method: 'DELETE' }),
  },
};
