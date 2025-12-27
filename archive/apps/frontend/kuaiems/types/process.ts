/**
 * EMS 数据类型定义
 * 
 * 定义能源监测、能耗分析、节能管理、能源报表等的数据类型
 */

// ==================== 能源监测相关 ====================

export interface EnergyMonitoring {
  id: number;
  uuid: string;
  tenantId?: number;
  monitoringNo: string;
  monitoringName: string;
  energyType: string;
  deviceId?: number;
  deviceName?: string;
  collectionFrequency?: number;
  currentConsumption?: number;
  unit?: string;
  collectionStatus: string;
  dataQuality: string;
  lastCollectionTime?: string;
  alertStatus: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnergyMonitoringCreate {
  monitoringNo: string;
  monitoringName: string;
  energyType: string;
  deviceId?: number;
  deviceName?: string;
  collectionFrequency?: number;
  currentConsumption?: number;
  unit?: string;
  collectionStatus?: string;
  dataQuality?: string;
  lastCollectionTime?: string;
  alertStatus?: string;
  status?: string;
  remark?: string;
}

export interface EnergyMonitoringUpdate {
  monitoringName?: string;
  energyType?: string;
  deviceId?: number;
  deviceName?: string;
  collectionFrequency?: number;
  currentConsumption?: number;
  unit?: string;
  collectionStatus?: string;
  dataQuality?: string;
  lastCollectionTime?: string;
  alertStatus?: string;
  status?: string;
  remark?: string;
}

export interface EnergyMonitoringListParams {
  skip?: number;
  limit?: number;
  energyType?: string;
  collectionStatus?: string;
  alertStatus?: string;
}

// ==================== 能耗分析相关 ====================

export interface EnergyConsumptionAnalysis {
  id: number;
  uuid: string;
  tenantId?: number;
  analysisNo: string;
  analysisName: string;
  analysisType: string;
  energyType?: string;
  analysisPeriod?: string;
  analysisStartDate?: string;
  analysisEndDate?: string;
  totalConsumption?: number;
  averageConsumption?: number;
  peakConsumption?: number;
  consumptionTrend?: string;
  comparisonResult?: string;
  analysisResult?: any;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnergyConsumptionAnalysisCreate {
  analysisNo: string;
  analysisName: string;
  analysisType: string;
  energyType?: string;
  analysisPeriod?: string;
  analysisStartDate?: string;
  analysisEndDate?: string;
  totalConsumption?: number;
  averageConsumption?: number;
  peakConsumption?: number;
  consumptionTrend?: string;
  comparisonResult?: string;
  analysisResult?: any;
  status?: string;
  remark?: string;
}

export interface EnergyConsumptionAnalysisUpdate {
  analysisName?: string;
  analysisType?: string;
  energyType?: string;
  analysisPeriod?: string;
  analysisStartDate?: string;
  analysisEndDate?: string;
  totalConsumption?: number;
  averageConsumption?: number;
  peakConsumption?: number;
  consumptionTrend?: string;
  comparisonResult?: string;
  analysisResult?: any;
  status?: string;
  remark?: string;
}

export interface EnergyConsumptionAnalysisListParams {
  skip?: number;
  limit?: number;
  analysisType?: string;
  energyType?: string;
  status?: string;
}

// ==================== 节能管理相关 ====================

export interface EnergySavingManagement {
  id: number;
  uuid: string;
  tenantId?: number;
  managementNo: string;
  managementName: string;
  managementType: string;
  energyType?: string;
  targetValue?: number;
  currentValue?: number;
  achievementRate?: number;
  savingAmount?: number;
  savingRate?: number;
  measureDescription?: string;
  measureStatus: string;
  effectEvaluation?: any;
  startDate?: string;
  endDate?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnergySavingManagementCreate {
  managementNo: string;
  managementName: string;
  managementType: string;
  energyType?: string;
  targetValue?: number;
  currentValue?: number;
  achievementRate?: number;
  savingAmount?: number;
  savingRate?: number;
  measureDescription?: string;
  measureStatus?: string;
  effectEvaluation?: any;
  startDate?: string;
  endDate?: string;
  status?: string;
  remark?: string;
}

export interface EnergySavingManagementUpdate {
  managementName?: string;
  managementType?: string;
  energyType?: string;
  targetValue?: number;
  currentValue?: number;
  achievementRate?: number;
  savingAmount?: number;
  savingRate?: number;
  measureDescription?: string;
  measureStatus?: string;
  effectEvaluation?: any;
  startDate?: string;
  endDate?: string;
  status?: string;
  remark?: string;
}

export interface EnergySavingManagementListParams {
  skip?: number;
  limit?: number;
  managementType?: string;
  energyType?: string;
  measureStatus?: string;
}

// ==================== 能源报表相关 ====================

export interface EnergyReport {
  id: number;
  uuid: string;
  tenantId?: number;
  reportNo: string;
  reportName: string;
  reportType: string;
  reportPeriod?: string;
  reportStartDate?: string;
  reportEndDate?: string;
  energyType?: string;
  totalConsumption?: number;
  totalCost?: number;
  carbonEmission?: number;
  carbonEmissionRate?: number;
  reportData?: any;
  reportConfig?: any;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnergyReportCreate {
  reportNo: string;
  reportName: string;
  reportType: string;
  reportPeriod?: string;
  reportStartDate?: string;
  reportEndDate?: string;
  energyType?: string;
  totalConsumption?: number;
  totalCost?: number;
  carbonEmission?: number;
  carbonEmissionRate?: number;
  reportData?: any;
  reportConfig?: any;
  status?: string;
  remark?: string;
}

export interface EnergyReportUpdate {
  reportName?: string;
  reportType?: string;
  reportPeriod?: string;
  reportStartDate?: string;
  reportEndDate?: string;
  energyType?: string;
  totalConsumption?: number;
  totalCost?: number;
  carbonEmission?: number;
  carbonEmissionRate?: number;
  reportData?: any;
  reportConfig?: any;
  status?: string;
  remark?: string;
}

export interface EnergyReportListParams {
  skip?: number;
  limit?: number;
  reportType?: string;
  energyType?: string;
  status?: string;
}

