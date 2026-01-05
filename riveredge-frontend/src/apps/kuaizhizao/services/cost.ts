/**
 * 成本核算相关服务
 *
 * 提供成本核算规则、成本核算记录等相关的API接口。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import { apiRequest } from '../../../services/api';

// 成本核算规则相关接口
export const costRuleApi = {
  // 获取成本核算规则列表
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/cost/rules', { method: 'GET', params });
  },

  // 创建成本核算规则
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/cost/rules', { method: 'POST', data });
  },

  // 更新成本核算规则
  update: async (uuid: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/cost/rules/${uuid}`, { method: 'PUT', data });
  },

  // 删除成本核算规则
  delete: async (uuid: string) => {
    return apiRequest(`/apps/kuaizhizao/cost/rules/${uuid}`, { method: 'DELETE' });
  },

  // 获取成本核算规则详情
  get: async (uuid: string) => {
    return apiRequest(`/apps/kuaizhizao/cost/rules/${uuid}`, { method: 'GET' });
  },
};

// 成本核算记录相关接口
export const costCalculationApi = {
  // 获取成本核算记录列表
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/cost/calculations', { method: 'GET', params });
  },

  // 核算工单成本
  calculateWorkOrderCost: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/cost/calculations/work-order', { method: 'POST', data });
  },

  // 核算产品成本
  calculateProductCost: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/cost/calculations/product', { method: 'POST', data });
  },

  // 获取成本核算记录详情
  get: async (uuid: string) => {
    return apiRequest(`/apps/kuaizhizao/cost/calculations/${uuid}`, { method: 'GET' });
  },

  // 对比标准成本和实际成本
  compareCosts: async (productId: number) => {
    return apiRequest(`/apps/kuaizhizao/cost/calculations/product/${productId}/compare`, { method: 'GET' });
  },

  // 分析产品成本
  analyzeCost: async (productId: number) => {
    return apiRequest(`/apps/kuaizhizao/cost/calculations/product/${productId}/analyze`, { method: 'GET' });
  },

  // 获取成本优化建议
  getOptimization: async (productId: number) => {
    return apiRequest(`/apps/kuaizhizao/cost/calculations/product/${productId}/optimization`, { method: 'GET' });
  },
};

