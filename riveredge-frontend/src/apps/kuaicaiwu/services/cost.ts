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
  initPresets: async () => apiRequest(`${COST_BASE}/cost/rules/init-presets`, { method: 'POST' }),
};

export const costCalculationApi = {
  list: async (params?: any) => apiRequest(`${COST_BASE}/cost/calculations`, { method: 'GET', params }),
  calculateWorkOrderCost: async (data: any) => apiRequest(`${COST_BASE}/cost/calculations/work-order`, { method: 'POST', data }),
  calculateProductCost: async (data: any) => apiRequest(`${COST_BASE}/cost/calculations/product`, { method: 'POST', data }),
  previewWorkOrderReadiness: async (workOrderId: number) =>
    apiRequest(`${COST_BASE}/cost/calculations/work-order/${workOrderId}/readiness`, { method: 'GET' }),
  previewProductReadiness: async (productId: number, quantity: number) =>
    apiRequest(`${COST_BASE}/cost/calculations/product/${productId}/readiness`, {
      method: 'GET',
      params: { quantity },
    }),
  get: async (uuid: string) => apiRequest(`${COST_BASE}/cost/calculations/${uuid}`, { method: 'GET' }),
  compareCosts: async (productId: number) => apiRequest(`${COST_BASE}/cost/calculations/product/${productId}/compare`, { method: 'GET' }),
  analyzeCost: async (productId: number) => apiRequest(`${COST_BASE}/cost/calculations/product/${productId}/analyze`, { method: 'GET' }),
  getPeriodSummary: async (year: number, month: number) => apiRequest(`${COST_BASE}/cost/calculations/period-summary`, { method: 'GET', params: { year, month } }),
  performMonthlySettlement: async (data: any) => apiRequest(`${COST_BASE}/cost/calculations/monthly-settlement`, { method: 'POST', data }),
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
};

export const costOptimizationApi = {
  getSuggestions: async (data: any) => apiRequest(`${COST_BASE}/cost-optimization/suggestions`, { method: 'POST', data }),
  getBatchSuggestions: async (data: any) => apiRequest(`${COST_BASE}/cost-optimization/suggestions/batch`, { method: 'POST', data }),
};

export const costReportApi = {
  generate: async (data: any) => apiRequest(`${COST_BASE}/cost-report/generate`, { method: 'POST', data }),
};
