/**
 * MI 数据类型定义
 * 
 * 定义实时生产看板、设备综合效率分析、工艺参数优化、质量预测分析、系统应用绩效分析等的数据类型
 */

// ==================== 实时生产看板相关 ====================

export interface ProductionDashboard {
  id: number;
  uuid: string;
  tenantId?: number;
  dashboardNo: string;
  dashboardName: string;
  dashboardType: string;
  productionLineId?: number;
  productionLineName?: string;
  alertLevel: string;
  alertCategory?: string;
  alertStatus: string;
  alertTime?: string;
  alertDescription?: string;
  handlerId?: number;
  handlerName?: string;
  handleTime?: string;
  handleResult?: string;
  productionStatus: string;
  statusData?: any;
  statusTrend?: any;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionDashboardCreate {
  dashboardNo: string;
  dashboardName: string;
  dashboardType: string;
  productionLineId?: number;
  productionLineName?: string;
  alertLevel?: string;
  alertCategory?: string;
  alertStatus?: string;
  alertTime?: string;
  alertDescription?: string;
  handlerId?: number;
  handlerName?: string;
  handleTime?: string;
  handleResult?: string;
  productionStatus?: string;
  statusData?: any;
  statusTrend?: any;
  status?: string;
  remark?: string;
}

export interface ProductionDashboardUpdate {
  dashboardName?: string;
  dashboardType?: string;
  productionLineId?: number;
  productionLineName?: string;
  alertLevel?: string;
  alertCategory?: string;
  alertStatus?: string;
  alertTime?: string;
  alertDescription?: string;
  handlerId?: number;
  handlerName?: string;
  handleTime?: string;
  handleResult?: string;
  productionStatus?: string;
  statusData?: any;
  statusTrend?: any;
  status?: string;
  remark?: string;
}

export interface ProductionDashboardListParams {
  skip?: number;
  limit?: number;
  dashboardType?: string;
  alertLevel?: string;
  alertStatus?: string;
}

// ==================== 设备综合效率分析相关 ====================

export interface OEEAnalysis {
  id: number;
  uuid: string;
  tenantId?: number;
  analysisNo: string;
  analysisName: string;
  deviceId?: number;
  deviceName?: string;
  analysisPeriod?: string;
  analysisStartDate?: string;
  analysisEndDate?: string;
  availability?: number;
  performance?: number;
  quality?: number;
  oeeValue?: number;
  utilizationRate?: number;
  performanceIndicators?: any;
  optimizationSuggestions?: any;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OEEAnalysisCreate {
  analysisNo: string;
  analysisName: string;
  deviceId?: number;
  deviceName?: string;
  analysisPeriod?: string;
  analysisStartDate?: string;
  analysisEndDate?: string;
  availability?: number;
  performance?: number;
  quality?: number;
  oeeValue?: number;
  utilizationRate?: number;
  performanceIndicators?: any;
  optimizationSuggestions?: any;
  status?: string;
  remark?: string;
}

export interface OEEAnalysisUpdate {
  analysisName?: string;
  deviceId?: number;
  deviceName?: string;
  analysisPeriod?: string;
  analysisStartDate?: string;
  analysisEndDate?: string;
  availability?: number;
  performance?: number;
  quality?: number;
  oeeValue?: number;
  utilizationRate?: number;
  performanceIndicators?: any;
  optimizationSuggestions?: any;
  status?: string;
  remark?: string;
}

export interface OEEAnalysisListParams {
  skip?: number;
  limit?: number;
  deviceId?: number;
  analysisPeriod?: string;
  status?: string;
}

// ==================== 工艺参数优化相关 ====================

export interface ProcessParameterOptimization {
  id: number;
  uuid: string;
  tenantId?: number;
  optimizationNo: string;
  optimizationName: string;
  processId?: number;
  processName?: string;
  parameterAnalysis?: any;
  parameterStatistics?: any;
  parameterCorrelation?: any;
  optimizationSuggestions?: any;
  optimizationPlan?: any;
  optimizationEffect?: any;
  improvementPlan?: any;
  improvementStatus: string;
  improvementEffect?: any;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessParameterOptimizationCreate {
  optimizationNo: string;
  optimizationName: string;
  processId?: number;
  processName?: string;
  parameterAnalysis?: any;
  parameterStatistics?: any;
  parameterCorrelation?: any;
  optimizationSuggestions?: any;
  optimizationPlan?: any;
  optimizationEffect?: any;
  improvementPlan?: any;
  improvementStatus?: string;
  improvementEffect?: any;
  status?: string;
  remark?: string;
}

export interface ProcessParameterOptimizationUpdate {
  optimizationName?: string;
  processId?: number;
  processName?: string;
  parameterAnalysis?: any;
  parameterStatistics?: any;
  parameterCorrelation?: any;
  optimizationSuggestions?: any;
  optimizationPlan?: any;
  optimizationEffect?: any;
  improvementPlan?: any;
  improvementStatus?: string;
  improvementEffect?: any;
  status?: string;
  remark?: string;
}

export interface ProcessParameterOptimizationListParams {
  skip?: number;
  limit?: number;
  processId?: number;
  improvementStatus?: string;
  status?: string;
}

// ==================== 质量预测分析相关 ====================

export interface QualityPredictionAnalysis {
  id: number;
  uuid: string;
  tenantId?: number;
  analysisNo: string;
  analysisName: string;
  predictionModel?: string;
  predictionPeriod?: string;
  predictionStartDate?: string;
  predictionEndDate?: string;
  qualityTrend?: any;
  predictionAccuracy?: number;
  alertStatus: string;
  alertLevel?: string;
  alertDescription?: string;
  riskLevel?: string;
  rootCauseAnalysis?: any;
  rootCauseTrace?: any;
  improvementPlan?: any;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QualityPredictionAnalysisCreate {
  analysisNo: string;
  analysisName: string;
  predictionModel?: string;
  predictionPeriod?: string;
  predictionStartDate?: string;
  predictionEndDate?: string;
  qualityTrend?: any;
  predictionAccuracy?: number;
  alertStatus?: string;
  alertLevel?: string;
  alertDescription?: string;
  riskLevel?: string;
  rootCauseAnalysis?: any;
  rootCauseTrace?: any;
  improvementPlan?: any;
  status?: string;
  remark?: string;
}

export interface QualityPredictionAnalysisUpdate {
  analysisName?: string;
  predictionModel?: string;
  predictionPeriod?: string;
  predictionStartDate?: string;
  predictionEndDate?: string;
  qualityTrend?: any;
  predictionAccuracy?: number;
  alertStatus?: string;
  alertLevel?: string;
  alertDescription?: string;
  riskLevel?: string;
  rootCauseAnalysis?: any;
  rootCauseTrace?: any;
  improvementPlan?: any;
  status?: string;
  remark?: string;
}

export interface QualityPredictionAnalysisListParams {
  skip?: number;
  limit?: number;
  predictionModel?: string;
  alertStatus?: string;
  riskLevel?: string;
}

// ==================== 系统应用绩效分析相关 ====================

export interface SystemPerformanceAnalysis {
  id: number;
  uuid: string;
  tenantId?: number;
  analysisNo: string;
  analysisName: string;
  analysisType: string;
  analysisPeriod?: string;
  analysisStartDate?: string;
  analysisEndDate?: string;
  moduleUsageRate?: any;
  functionUsageFrequency?: any;
  userActivity?: any;
  efficiencyImprovement?: number;
  timeReduction?: number;
  costReduction?: number;
  roiValue?: number;
  costSaving?: number;
  beforeAfterComparison?: any;
  improvementQuantification?: any;
  valueContribution?: any;
  optimizationSuggestions?: any;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SystemPerformanceAnalysisCreate {
  analysisNo: string;
  analysisName: string;
  analysisType: string;
  analysisPeriod?: string;
  analysisStartDate?: string;
  analysisEndDate?: string;
  moduleUsageRate?: any;
  functionUsageFrequency?: any;
  userActivity?: any;
  efficiencyImprovement?: number;
  timeReduction?: number;
  costReduction?: number;
  roiValue?: number;
  costSaving?: number;
  beforeAfterComparison?: any;
  improvementQuantification?: any;
  valueContribution?: any;
  optimizationSuggestions?: any;
  status?: string;
  remark?: string;
}

export interface SystemPerformanceAnalysisUpdate {
  analysisName?: string;
  analysisType?: string;
  analysisPeriod?: string;
  analysisStartDate?: string;
  analysisEndDate?: string;
  moduleUsageRate?: any;
  functionUsageFrequency?: any;
  userActivity?: any;
  efficiencyImprovement?: number;
  timeReduction?: number;
  costReduction?: number;
  roiValue?: number;
  costSaving?: number;
  beforeAfterComparison?: any;
  improvementQuantification?: any;
  valueContribution?: any;
  optimizationSuggestions?: any;
  status?: string;
  remark?: string;
}

export interface SystemPerformanceAnalysisListParams {
  skip?: number;
  limit?: number;
  analysisType?: string;
  analysisPeriod?: string;
  status?: string;
}

