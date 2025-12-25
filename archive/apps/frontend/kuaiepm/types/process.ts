/**
 * EPM数据类型定义
 * 
 * 定义企业绩效管理的数据类型
 */

// ==================== KPI管理相关 ====================

export interface KPI {
  id: number;
  uuid: string;
  tenantId?: number;
  kpiCode: string;
  kpiName: string;
  kpiCategory: string;
  kpiType: string;
  calculationFormula?: string;
  dataSource?: string;
  targetValue?: number;
  unit?: string;
  frequency?: string;
  ownerId?: number;
  ownerName?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface KPICreate {
  kpiCode: string;
  kpiName: string;
  kpiCategory: string;
  kpiType: string;
  status?: string;
}

export interface KPIUpdate {
  status?: string;
}

export interface KPIListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface KPIMonitoring {
  id: number;
  uuid: string;
  tenantId?: number;
  monitoringNo: string;
  kpiId?: number;
  monitoringDate: string;
  actualValue?: number;
  targetValue?: number;
  variance?: number;
  varianceRate?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface KPIMonitoringCreate {
  monitoringNo: string;
  kpiId?: number;
  monitoringDate: string;
  status?: string;
}

export interface KPIMonitoringUpdate {
  status?: string;
}

export interface KPIMonitoringListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface KPIAnalysis {
  id: number;
  uuid: string;
  tenantId?: number;
  analysisNo: string;
  kpiId?: number;
  analysisDate: string;
  analysisType: string;
  analysisContent?: string;
  conclusion?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface KPIAnalysisCreate {
  analysisNo: string;
  kpiId?: number;
  analysisDate: string;
  analysisType: string;
  status?: string;
}

export interface KPIAnalysisUpdate {
  status?: string;
}

export interface KPIAnalysisListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface KPIAlert {
  id: number;
  uuid: string;
  tenantId?: number;
  alertNo: string;
  kpiId?: number;
  alertDate: string;
  alertType: string;
  alertLevel: string;
  alertContent?: string;
  isHandled: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface KPIAlertCreate {
  alertNo: string;
  kpiId?: number;
  alertDate: string;
  alertType: string;
  alertLevel: string;
  status?: string;
}

export interface KPIAlertUpdate {
  status?: string;
}

export interface KPIAlertListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

// ==================== 平衡计分卡相关 ====================

export interface StrategyMap {
  id: number;
  uuid: string;
  tenantId?: number;
  mapNo: string;
  mapName: string;
  mapType: string;
  mapContent?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyMapCreate {
  mapNo: string;
  mapName: string;
  mapType: string;
  status?: string;
}

export interface StrategyMapUpdate {
  status?: string;
}

export interface StrategyMapListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface Objective {
  id: number;
  uuid: string;
  tenantId?: number;
  objectiveNo: string;
  strategyMapId?: number;
  objectiveName: string;
  objectiveType: string;
  targetValue?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ObjectiveCreate {
  objectiveNo: string;
  strategyMapId?: number;
  objectiveName: string;
  objectiveType: string;
  status?: string;
}

export interface ObjectiveUpdate {
  status?: string;
}

export interface ObjectiveListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface PerformanceEvaluation {
  id: number;
  uuid: string;
  tenantId?: number;
  evaluationNo: string;
  objectiveId?: number;
  evaluationDate: string;
  evaluationScore?: number;
  evaluationResult?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceEvaluationCreate {
  evaluationNo: string;
  objectiveId?: number;
  evaluationDate: string;
  status?: string;
}

export interface PerformanceEvaluationUpdate {
  status?: string;
}

export interface PerformanceEvaluationListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

// ==================== 经营分析相关 ====================

export interface BusinessDashboard {
  id: number;
  uuid: string;
  tenantId?: number;
  dashboardNo: string;
  dashboardName: string;
  dashboardType: string;
  dashboardConfig?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessDashboardCreate {
  dashboardNo: string;
  dashboardName: string;
  dashboardType: string;
  status?: string;
}

export interface BusinessDashboardUpdate {
  status?: string;
}

export interface BusinessDashboardListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface BusinessDataAnalysis {
  id: number;
  uuid: string;
  tenantId?: number;
  analysisNo: string;
  analysisDate: string;
  analysisType: string;
  analysisContent?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessDataAnalysisCreate {
  analysisNo: string;
  analysisDate: string;
  analysisType: string;
  status?: string;
}

export interface BusinessDataAnalysisUpdate {
  status?: string;
}

export interface BusinessDataAnalysisListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface TrendAnalysis {
  id: number;
  uuid: string;
  tenantId?: number;
  analysisNo: string;
  analysisDate: string;
  analysisType: string;
  analysisContent?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrendAnalysisCreate {
  analysisNo: string;
  analysisDate: string;
  analysisType: string;
  status?: string;
}

export interface TrendAnalysisUpdate {
  status?: string;
}

export interface TrendAnalysisListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface ComparisonAnalysis {
  id: number;
  uuid: string;
  tenantId?: number;
  analysisNo: string;
  analysisDate: string;
  analysisType: string;
  analysisContent?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComparisonAnalysisCreate {
  analysisNo: string;
  analysisDate: string;
  analysisType: string;
  status?: string;
}

export interface ComparisonAnalysisUpdate {
  status?: string;
}

export interface ComparisonAnalysisListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

// ==================== 预算分析相关 ====================

export interface Budget {
  id: number;
  uuid: string;
  tenantId?: number;
  budgetNo: string;
  budgetName: string;
  budgetType: string;
  budgetPeriod?: string;
  budgetAmount?: number;
  departmentId?: number;
  budgetCategory?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetCreate {
  budgetNo: string;
  budgetName: string;
  budgetType: string;
  budgetPeriod?: string;
  status?: string;
}

export interface BudgetUpdate {
  status?: string;
}

export interface BudgetListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface BudgetVariance {
  id: number;
  uuid: string;
  tenantId?: number;
  varianceNo: string;
  budgetId?: number;
  varianceDate: string;
  varianceAmount?: number;
  varianceRate?: number;
  varianceReason?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetVarianceCreate {
  varianceNo: string;
  budgetId?: number;
  varianceDate: string;
  status?: string;
}

export interface BudgetVarianceUpdate {
  status?: string;
}

export interface BudgetVarianceListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface BudgetForecast {
  id: number;
  uuid: string;
  tenantId?: number;
  forecastNo: string;
  budgetId?: number;
  forecastDate: string;
  forecastAmount?: number;
  forecastMethod?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetForecastCreate {
  forecastNo: string;
  budgetId?: number;
  forecastDate: string;
  status?: string;
}

export interface BudgetForecastUpdate {
  status?: string;
}

export interface BudgetForecastListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

