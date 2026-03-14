/**
 * 成本核算相关服务
 * 成本 API 仍由 kuaizhizao 提供
 */
import { apiRequest } from '../../../services/api';

const COST_BASE = '/apps/kuaicaiwu';

export const costRuleApi = {
  list: async (params?: any) => apiRequest(`${COST_BASE}/cost/rules`, { method: 'GET', params }),
  create: async (data: any) => apiRequest(`${COST_BASE}/cost/rules`, { method: 'POST', data }),
  update: async (uuid: string, data: any) => apiRequest(`${COST_BASE}/cost/rules/${uuid}`, { method: 'PUT', data }),
  delete: async (uuid: string) => apiRequest(`${COST_BASE}/cost/rules/${uuid}`, { method: 'DELETE' }),
  get: async (uuid: string) => apiRequest(`${COST_BASE}/cost/rules/${uuid}`, { method: 'GET' }),
};

export const costCalculationApi = {
  list: async (params?: any) => apiRequest(`${COST_BASE}/cost/calculations`, { method: 'GET', params }),
  calculateWorkOrderCost: async (data: any) => apiRequest(`${COST_BASE}/cost/calculations/work-order`, { method: 'POST', data }),
  calculateProductCost: async (data: any) => apiRequest(`${COST_BASE}/cost/calculations/product`, { method: 'POST', data }),
  get: async (uuid: string) => apiRequest(`${COST_BASE}/cost/calculations/${uuid}`, { method: 'GET' }),
  compareCosts: async (productId: number) => apiRequest(`${COST_BASE}/cost/calculations/product/${productId}/compare`, { method: 'GET' }),
  analyzeCost: async (productId: number) => apiRequest(`${COST_BASE}/cost/calculations/product/${productId}/analyze`, { method: 'GET' }),
  getOptimization: async (productId: number) => apiRequest(`${COST_BASE}/cost/calculations/product/${productId}/optimization`, { method: 'GET' }),
};

export const productionCostApi = {
  calculate: async (data: any) => apiRequest(`${COST_BASE}/production-cost/calculate`, { method: 'POST', data }),
};

export const outsourceCostApi = {
  calculate: async (data: any) => apiRequest(`${COST_BASE}/outsource-cost/calculate`, { method: 'POST', data }),
};

export const purchaseCostApi = {
  calculate: async (data: any) => apiRequest(`${COST_BASE}/purchase-cost/calculate`, { method: 'POST', data }),
};

export const qualityCostApi = {
  calculate: async (data: any) => apiRequest(`${COST_BASE}/quality-cost/calculate`, { method: 'POST', data }),
};

export const costComparisonApi = {
  compare: async (data: any) => apiRequest(`${COST_BASE}/cost-comparison/compare`, { method: 'POST', data }),
  compareBySourceType: async (data: any) => apiRequest(`${COST_BASE}/cost-comparison/compare-by-source-type`, { method: 'POST', data }),
};

export const costOptimizationApi = {
  getSuggestions: async (data: any) => apiRequest(`${COST_BASE}/cost-optimization/suggestions`, { method: 'POST', data }),
  getBatchSuggestions: async (data: any) => apiRequest(`${COST_BASE}/cost-optimization/suggestions/batch`, { method: 'POST', data }),
};

export const costReportApi = {
  analyzeTrend: async (data: any) => apiRequest(`${COST_BASE}/cost-report/trend`, { method: 'POST', data }),
  analyzeStructure: async (data: any) => apiRequest(`${COST_BASE}/cost-report/structure`, { method: 'POST', data }),
  generate: async (data: any) => apiRequest(`${COST_BASE}/cost-report/generate`, { method: 'POST', data }),
};
