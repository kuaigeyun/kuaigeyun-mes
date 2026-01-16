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

// 生产成本核算相关接口
export const productionCostApi = {
  // 核算生产成本
  calculate: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/production-cost/calculate', { method: 'POST', data });
  },
};

// 委外成本核算相关接口
export const outsourceCostApi = {
  // 核算委外成本
  calculate: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/outsource-cost/calculate', { method: 'POST', data });
  },
};

// 采购成本核算相关接口
export const purchaseCostApi = {
  // 核算采购成本
  calculate: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/purchase-cost/calculate', { method: 'POST', data });
  },
};

// 质量成本核算相关接口
export const qualityCostApi = {
  // 核算质量成本
  calculate: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/quality-cost/calculate', { method: 'POST', data });
  },
};

// 成本对比相关接口
export const costComparisonApi = {
  // 对比标准成本和实际成本
  compare: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/cost-comparison/compare', { method: 'POST', data });
  },
  // 按物料来源类型对比成本
  compareBySourceType: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/cost-comparison/compare-by-source-type', { method: 'POST', data });
  },
};

// 成本优化建议相关接口
export const costOptimizationApi = {
  // 生成单个物料的成本优化建议
  getSuggestions: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/cost-optimization/suggestions', { method: 'POST', data });
  },
  // 批量生成成本优化建议
  getBatchSuggestions: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/cost-optimization/suggestions/batch', { method: 'POST', data });
  },
};

// 成本报表分析相关接口
export const costReportApi = {
  // 分析成本趋势
  analyzeTrend: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/cost-report/trend', { method: 'POST', data });
  },
  // 分析成本结构
  analyzeStructure: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/cost-report/structure', { method: 'POST', data });
  },
  // 生成成本报表
  generate: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/cost-report/generate', { method: 'POST', data });
  },
};

