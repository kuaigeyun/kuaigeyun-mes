/**
 * EPM数据 API 服务
 * 
 * 提供企业绩效管理的 API 调用方法
 */

import { api } from '../../../services/api';
import type {
  KPI,
  KPICreate,
  KPIUpdate,
  KPIListParams,
  KPIMonitoring,
  KPIMonitoringCreate,
  KPIMonitoringUpdate,
  KPIMonitoringListParams,
  KPIAnalysis,
  KPIAnalysisCreate,
  KPIAnalysisUpdate,
  KPIAnalysisListParams,
  KPIAlert,
  KPIAlertCreate,
  KPIAlertUpdate,
  KPIAlertListParams,
  StrategyMap,
  StrategyMapCreate,
  StrategyMapUpdate,
  StrategyMapListParams,
  Objective,
  ObjectiveCreate,
  ObjectiveUpdate,
  ObjectiveListParams,
  PerformanceEvaluation,
  PerformanceEvaluationCreate,
  PerformanceEvaluationUpdate,
  PerformanceEvaluationListParams,
  BusinessDashboard,
  BusinessDashboardCreate,
  BusinessDashboardUpdate,
  BusinessDashboardListParams,
  BusinessDataAnalysis,
  BusinessDataAnalysisCreate,
  BusinessDataAnalysisUpdate,
  BusinessDataAnalysisListParams,
  TrendAnalysis,
  TrendAnalysisCreate,
  TrendAnalysisUpdate,
  TrendAnalysisListParams,
  ComparisonAnalysis,
  ComparisonAnalysisCreate,
  ComparisonAnalysisUpdate,
  ComparisonAnalysisListParams,
  Budget,
  BudgetCreate,
  BudgetUpdate,
  BudgetListParams,
  BudgetVariance,
  BudgetVarianceCreate,
  BudgetVarianceUpdate,
  BudgetVarianceListParams,
  BudgetForecast,
  BudgetForecastCreate,
  BudgetForecastUpdate,
  BudgetForecastListParams,
} from '../types/process';

/**
 * KPI API 服务
 */
export const kpiApi = {
  create: async (data: KPICreate): Promise<KPI> => {
    return api.post('/kuaiepm/kpis', data);
  },
  list: async (params?: KPIListParams): Promise<KPI[]> => {
    return api.get('/kuaiepm/kpis', { params });
  },
  get: async (uuid: string): Promise<KPI> => {
    return api.get(`/kuaiepm/kpis/${uuid}`);
  },
  update: async (uuid: string, data: KPIUpdate): Promise<KPI> => {
    return api.put(`/kuaiepm/kpis/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiepm/kpis/${uuid}`);
  },
};

/**
 * KPI监控 API 服务
 */
export const kpiMonitoringApi = {
  create: async (data: KPIMonitoringCreate): Promise<KPIMonitoring> => {
    return api.post('/kuaiepm/kpi-monitorings', data);
  },
  list: async (params?: KPIMonitoringListParams): Promise<KPIMonitoring[]> => {
    return api.get('/kuaiepm/kpi-monitorings', { params });
  },
  get: async (uuid: string): Promise<KPIMonitoring> => {
    return api.get(`/kuaiepm/kpi-monitorings/${uuid}`);
  },
  update: async (uuid: string, data: KPIMonitoringUpdate): Promise<KPIMonitoring> => {
    return api.put(`/kuaiepm/kpi-monitorings/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiepm/kpi-monitorings/${uuid}`);
  },
};

/**
 * KPI分析 API 服务
 */
export const kpiAnalysisApi = {
  create: async (data: KPIAnalysisCreate): Promise<KPIAnalysis> => {
    return api.post('/kuaiepm/kpi-analysiss', data);
  },
  list: async (params?: KPIAnalysisListParams): Promise<KPIAnalysis[]> => {
    return api.get('/kuaiepm/kpi-analysiss', { params });
  },
  get: async (uuid: string): Promise<KPIAnalysis> => {
    return api.get(`/kuaiepm/kpi-analysiss/${uuid}`);
  },
  update: async (uuid: string, data: KPIAnalysisUpdate): Promise<KPIAnalysis> => {
    return api.put(`/kuaiepm/kpi-analysiss/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiepm/kpi-analysiss/${uuid}`);
  },
};

/**
 * KPI预警 API 服务
 */
export const kpiAlertApi = {
  create: async (data: KPIAlertCreate): Promise<KPIAlert> => {
    return api.post('/kuaiepm/kpi-alerts', data);
  },
  list: async (params?: KPIAlertListParams): Promise<KPIAlert[]> => {
    return api.get('/kuaiepm/kpi-alerts', { params });
  },
  get: async (uuid: string): Promise<KPIAlert> => {
    return api.get(`/kuaiepm/kpi-alerts/${uuid}`);
  },
  update: async (uuid: string, data: KPIAlertUpdate): Promise<KPIAlert> => {
    return api.put(`/kuaiepm/kpi-alerts/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiepm/kpi-alerts/${uuid}`);
  },
};

/**
 * 战略地图 API 服务
 */
export const strategyMapApi = {
  create: async (data: StrategyMapCreate): Promise<StrategyMap> => {
    return api.post('/kuaiepm/strategy-maps', data);
  },
  list: async (params?: StrategyMapListParams): Promise<StrategyMap[]> => {
    return api.get('/kuaiepm/strategy-maps', { params });
  },
  get: async (uuid: string): Promise<StrategyMap> => {
    return api.get(`/kuaiepm/strategy-maps/${uuid}`);
  },
  update: async (uuid: string, data: StrategyMapUpdate): Promise<StrategyMap> => {
    return api.put(`/kuaiepm/strategy-maps/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiepm/strategy-maps/${uuid}`);
  },
};

/**
 * 目标 API 服务
 */
export const objectiveApi = {
  create: async (data: ObjectiveCreate): Promise<Objective> => {
    return api.post('/kuaiepm/objectives', data);
  },
  list: async (params?: ObjectiveListParams): Promise<Objective[]> => {
    return api.get('/kuaiepm/objectives', { params });
  },
  get: async (uuid: string): Promise<Objective> => {
    return api.get(`/kuaiepm/objectives/${uuid}`);
  },
  update: async (uuid: string, data: ObjectiveUpdate): Promise<Objective> => {
    return api.put(`/kuaiepm/objectives/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiepm/objectives/${uuid}`);
  },
};

/**
 * 绩效评估 API 服务
 */
export const performanceEvaluationApi = {
  create: async (data: PerformanceEvaluationCreate): Promise<PerformanceEvaluation> => {
    return api.post('/kuaiepm/performance-evaluations', data);
  },
  list: async (params?: PerformanceEvaluationListParams): Promise<PerformanceEvaluation[]> => {
    return api.get('/kuaiepm/performance-evaluations', { params });
  },
  get: async (uuid: string): Promise<PerformanceEvaluation> => {
    return api.get(`/kuaiepm/performance-evaluations/${uuid}`);
  },
  update: async (uuid: string, data: PerformanceEvaluationUpdate): Promise<PerformanceEvaluation> => {
    return api.put(`/kuaiepm/performance-evaluations/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiepm/performance-evaluations/${uuid}`);
  },
};

/**
 * 经营仪表盘 API 服务
 */
export const businessDashboardApi = {
  create: async (data: BusinessDashboardCreate): Promise<BusinessDashboard> => {
    return api.post('/kuaiepm/business-dashboards', data);
  },
  list: async (params?: BusinessDashboardListParams): Promise<BusinessDashboard[]> => {
    return api.get('/kuaiepm/business-dashboards', { params });
  },
  get: async (uuid: string): Promise<BusinessDashboard> => {
    return api.get(`/kuaiepm/business-dashboards/${uuid}`);
  },
  update: async (uuid: string, data: BusinessDashboardUpdate): Promise<BusinessDashboard> => {
    return api.put(`/kuaiepm/business-dashboards/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiepm/business-dashboards/${uuid}`);
  },
};

/**
 * 经营数据分析 API 服务
 */
export const businessDataAnalysisApi = {
  create: async (data: BusinessDataAnalysisCreate): Promise<BusinessDataAnalysis> => {
    return api.post('/kuaiepm/business-data-analysiss', data);
  },
  list: async (params?: BusinessDataAnalysisListParams): Promise<BusinessDataAnalysis[]> => {
    return api.get('/kuaiepm/business-data-analysiss', { params });
  },
  get: async (uuid: string): Promise<BusinessDataAnalysis> => {
    return api.get(`/kuaiepm/business-data-analysiss/${uuid}`);
  },
  update: async (uuid: string, data: BusinessDataAnalysisUpdate): Promise<BusinessDataAnalysis> => {
    return api.put(`/kuaiepm/business-data-analysiss/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiepm/business-data-analysiss/${uuid}`);
  },
};

/**
 * 趋势分析 API 服务
 */
export const trendAnalysisApi = {
  create: async (data: TrendAnalysisCreate): Promise<TrendAnalysis> => {
    return api.post('/kuaiepm/trend-analysiss', data);
  },
  list: async (params?: TrendAnalysisListParams): Promise<TrendAnalysis[]> => {
    return api.get('/kuaiepm/trend-analysiss', { params });
  },
  get: async (uuid: string): Promise<TrendAnalysis> => {
    return api.get(`/kuaiepm/trend-analysiss/${uuid}`);
  },
  update: async (uuid: string, data: TrendAnalysisUpdate): Promise<TrendAnalysis> => {
    return api.put(`/kuaiepm/trend-analysiss/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiepm/trend-analysiss/${uuid}`);
  },
};

/**
 * 对比分析 API 服务
 */
export const comparisonAnalysisApi = {
  create: async (data: ComparisonAnalysisCreate): Promise<ComparisonAnalysis> => {
    return api.post('/kuaiepm/comparison-analysiss', data);
  },
  list: async (params?: ComparisonAnalysisListParams): Promise<ComparisonAnalysis[]> => {
    return api.get('/kuaiepm/comparison-analysiss', { params });
  },
  get: async (uuid: string): Promise<ComparisonAnalysis> => {
    return api.get(`/kuaiepm/comparison-analysiss/${uuid}`);
  },
  update: async (uuid: string, data: ComparisonAnalysisUpdate): Promise<ComparisonAnalysis> => {
    return api.put(`/kuaiepm/comparison-analysiss/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiepm/comparison-analysiss/${uuid}`);
  },
};

/**
 * 预算 API 服务
 */
export const budgetApi = {
  create: async (data: BudgetCreate): Promise<Budget> => {
    return api.post('/kuaiepm/budgets', data);
  },
  list: async (params?: BudgetListParams): Promise<Budget[]> => {
    return api.get('/kuaiepm/budgets', { params });
  },
  get: async (uuid: string): Promise<Budget> => {
    return api.get(`/kuaiepm/budgets/${uuid}`);
  },
  update: async (uuid: string, data: BudgetUpdate): Promise<Budget> => {
    return api.put(`/kuaiepm/budgets/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiepm/budgets/${uuid}`);
  },
};

/**
 * 预算差异 API 服务
 */
export const budgetVarianceApi = {
  create: async (data: BudgetVarianceCreate): Promise<BudgetVariance> => {
    return api.post('/kuaiepm/budget-variances', data);
  },
  list: async (params?: BudgetVarianceListParams): Promise<BudgetVariance[]> => {
    return api.get('/kuaiepm/budget-variances', { params });
  },
  get: async (uuid: string): Promise<BudgetVariance> => {
    return api.get(`/kuaiepm/budget-variances/${uuid}`);
  },
  update: async (uuid: string, data: BudgetVarianceUpdate): Promise<BudgetVariance> => {
    return api.put(`/kuaiepm/budget-variances/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiepm/budget-variances/${uuid}`);
  },
};

/**
 * 预算预测 API 服务
 */
export const budgetForecastApi = {
  create: async (data: BudgetForecastCreate): Promise<BudgetForecast> => {
    return api.post('/kuaiepm/budget-forecasts', data);
  },
  list: async (params?: BudgetForecastListParams): Promise<BudgetForecast[]> => {
    return api.get('/kuaiepm/budget-forecasts', { params });
  },
  get: async (uuid: string): Promise<BudgetForecast> => {
    return api.get(`/kuaiepm/budget-forecasts/${uuid}`);
  },
  update: async (uuid: string, data: BudgetForecastUpdate): Promise<BudgetForecast> => {
    return api.put(`/kuaiepm/budget-forecasts/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiepm/budget-forecasts/${uuid}`);
  },
};

