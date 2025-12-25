/**
 * QMS 数据类型定义
 * 
 * 定义质量检验、不合格品管理、质量追溯、ISO标准体系等的数据类型
 */

// ==================== 质量检验任务相关 ====================

export interface InspectionTask {
  id: number;
  uuid: string;
  tenantId: number;
  taskNo: string;
  inspectionType: string;
  sourceType?: string;
  sourceId?: number;
  sourceNo?: string;
  materialId: number;
  materialName: string;
  batchNo?: string;
  serialNo?: string;
  quantity: number;
  inspectorId?: number;
  inspectorName?: string;
  inspectionStandardId?: number;
  inspectionStandardName?: string;
  plannedInspectionDate?: string;
  status: string;
  priority: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface InspectionTaskCreate {
  taskNo: string;
  inspectionType: string;
  sourceType?: string;
  sourceId?: number;
  sourceNo?: string;
  materialId: number;
  materialName: string;
  batchNo?: string;
  serialNo?: string;
  quantity: number;
  inspectorId?: number;
  inspectorName?: string;
  inspectionStandardId?: number;
  inspectionStandardName?: string;
  plannedInspectionDate?: string;
  priority?: string;
  remark?: string;
}

export interface InspectionTaskUpdate {
  inspectionType?: string;
  materialId?: number;
  materialName?: string;
  quantity?: number;
  inspectorId?: number;
  inspectorName?: string;
  status?: string;
  plannedInspectionDate?: string;
  priority?: string;
  remark?: string;
}

// ==================== 质量检验记录相关 ====================

export interface InspectionRecord {
  id: number;
  uuid: string;
  tenantId: number;
  recordNo: string;
  taskId?: number;
  taskUuid?: string;
  inspectionType: string;
  materialId: number;
  materialName: string;
  batchNo?: string;
  serialNo?: string;
  quantity: number;
  qualifiedQuantity: number;
  defectiveQuantity: number;
  inspectionResult: string;
  inspectionDate: string;
  inspectorId?: number;
  inspectorName?: string;
  inspectionStandardId?: number;
  inspectionStandardName?: string;
  inspectionData?: any;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface InspectionRecordCreate {
  recordNo: string;
  taskId?: number;
  taskUuid?: string;
  inspectionType: string;
  materialId: number;
  materialName: string;
  batchNo?: string;
  serialNo?: string;
  quantity: number;
  qualifiedQuantity?: number;
  defectiveQuantity?: number;
  inspectionResult: string;
  inspectionDate: string;
  inspectorId?: number;
  inspectorName?: string;
  inspectionStandardId?: number;
  inspectionStandardName?: string;
  inspectionData?: any;
  remark?: string;
}

export interface InspectionRecordUpdate {
  quantity?: number;
  qualifiedQuantity?: number;
  defectiveQuantity?: number;
  inspectionResult?: string;
  inspectionData?: any;
  status?: string;
  remark?: string;
}

// ==================== 不合格品记录相关 ====================

export interface NonconformingProduct {
  id: number;
  uuid: string;
  tenantId: number;
  recordNo: string;
  sourceType?: string;
  sourceId?: number;
  sourceNo?: string;
  materialId: number;
  materialName: string;
  batchNo?: string;
  serialNo?: string;
  quantity: number;
  defectType?: number;
  defectTypeName?: string;
  defectDescription: string;
  defectCause?: string;
  impactAssessment?: string;
  impactScope?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface NonconformingProductCreate {
  recordNo: string;
  sourceType?: string;
  sourceId?: number;
  sourceNo?: string;
  materialId: number;
  materialName: string;
  batchNo?: string;
  serialNo?: string;
  quantity: number;
  defectType?: number;
  defectTypeName?: string;
  defectDescription: string;
  defectCause?: string;
  impactAssessment?: string;
  impactScope?: string;
  remark?: string;
}

export interface NonconformingProductUpdate {
  materialId?: number;
  materialName?: string;
  quantity?: number;
  defectType?: number;
  defectTypeName?: string;
  defectDescription?: string;
  defectCause?: string;
  impactAssessment?: string;
  impactScope?: string;
  status?: string;
  remark?: string;
}

// ==================== 不合格品处理相关 ====================

export interface NonconformingHandling {
  id: number;
  uuid: string;
  tenantId: number;
  handlingNo: string;
  nonconformingProductId?: number;
  nonconformingProductUuid?: string;
  handlingType: string;
  handlingPlan: string;
  handlingExecutorId?: number;
  handlingExecutorName?: string;
  handlingDate?: string;
  handlingResult?: string;
  handlingQuantity?: number;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface NonconformingHandlingCreate {
  handlingNo: string;
  nonconformingProductId?: number;
  nonconformingProductUuid?: string;
  handlingType: string;
  handlingPlan: string;
  handlingExecutorId?: number;
  handlingExecutorName?: string;
  handlingDate?: string;
  handlingResult?: string;
  handlingQuantity?: number;
  remark?: string;
}

export interface NonconformingHandlingUpdate {
  handlingType?: string;
  handlingPlan?: string;
  handlingExecutorId?: number;
  handlingExecutorName?: string;
  handlingDate?: string;
  handlingResult?: string;
  handlingQuantity?: number;
  status?: string;
  remark?: string;
}

// ==================== 质量追溯相关 ====================

export interface QualityTraceability {
  id: number;
  uuid: string;
  tenantId: number;
  traceNo: string;
  traceType: string;
  batchNo?: string;
  serialNo?: string;
  materialId: number;
  materialName: string;
  traceData?: any;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface QualityTraceabilityCreate {
  traceNo: string;
  traceType: string;
  batchNo?: string;
  serialNo?: string;
  materialId: number;
  materialName: string;
  traceData?: any;
  remark?: string;
}

// ==================== ISO质量审核相关 ====================

export interface ISOAudit {
  id: number;
  uuid: string;
  tenantId: number;
  auditNo: string;
  auditType: string;
  isoStandard?: string;
  auditScope?: string;
  auditDate?: string;
  auditorId?: number;
  auditorName?: string;
  auditResult?: string;
  findings?: any;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ISOAuditCreate {
  auditNo: string;
  auditType: string;
  isoStandard?: string;
  auditScope?: string;
  auditDate?: string;
  auditorId?: number;
  auditorName?: string;
  auditResult?: string;
  findings?: any;
  remark?: string;
}

export interface ISOAuditUpdate {
  auditType?: string;
  isoStandard?: string;
  auditScope?: string;
  auditDate?: string;
  auditorId?: number;
  auditorName?: string;
  auditResult?: string;
  findings?: any;
  status?: string;
  remark?: string;
}

// ==================== CAPA相关 ====================

export interface CAPA {
  id: number;
  uuid: string;
  tenantId: number;
  capaNo: string;
  capaType: string;
  sourceType?: string;
  sourceId?: number;
  sourceNo?: string;
  problemDescription: string;
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  responsiblePersonId?: number;
  responsiblePersonName?: string;
  plannedCompletionDate?: string;
  actualCompletionDate?: string;
  effectivenessEvaluation?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CAPACreate {
  capaNo: string;
  capaType: string;
  sourceType?: string;
  sourceId?: number;
  sourceNo?: string;
  problemDescription: string;
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  responsiblePersonId?: number;
  responsiblePersonName?: string;
  plannedCompletionDate?: string;
  actualCompletionDate?: string;
  effectivenessEvaluation?: string;
  remark?: string;
}

export interface CAPAUpdate {
  capaType?: string;
  problemDescription?: string;
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  responsiblePersonId?: number;
  responsiblePersonName?: string;
  plannedCompletionDate?: string;
  actualCompletionDate?: string;
  effectivenessEvaluation?: string;
  status?: string;
  remark?: string;
}

// ==================== 持续改进相关 ====================

export interface ContinuousImprovement {
  id: number;
  uuid: string;
  tenantId: number;
  improvementNo: string;
  improvementType: string;
  improvementTitle: string;
  improvementDescription: string;
  improvementPlan?: string;
  responsiblePersonId?: number;
  responsiblePersonName?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  improvementResult?: string;
  effectivenessEvaluation?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ContinuousImprovementCreate {
  improvementNo: string;
  improvementType: string;
  improvementTitle: string;
  improvementDescription: string;
  improvementPlan?: string;
  responsiblePersonId?: number;
  responsiblePersonName?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  improvementResult?: string;
  effectivenessEvaluation?: string;
  remark?: string;
}

export interface ContinuousImprovementUpdate {
  improvementType?: string;
  improvementTitle?: string;
  improvementDescription?: string;
  improvementPlan?: string;
  responsiblePersonId?: number;
  responsiblePersonName?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  improvementResult?: string;
  effectivenessEvaluation?: string;
  status?: string;
  remark?: string;
}

// ==================== 质量目标相关 ====================

export interface QualityObjective {
  id: number;
  uuid: string;
  tenantId: number;
  objectiveNo: string;
  objectiveName: string;
  objectiveDescription?: string;
  targetValue: number;
  currentValue: number;
  unit?: string;
  period: string;
  periodStartDate?: string;
  periodEndDate?: string;
  responsiblePersonId?: number;
  responsiblePersonName?: string;
  achievementRate: number;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface QualityObjectiveCreate {
  objectiveNo: string;
  objectiveName: string;
  objectiveDescription?: string;
  targetValue: number;
  currentValue?: number;
  unit?: string;
  period: string;
  periodStartDate?: string;
  periodEndDate?: string;
  responsiblePersonId?: number;
  responsiblePersonName?: string;
  achievementRate?: number;
  remark?: string;
}

export interface QualityObjectiveUpdate {
  objectiveName?: string;
  objectiveDescription?: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  period?: string;
  periodStartDate?: string;
  periodEndDate?: string;
  responsiblePersonId?: number;
  responsiblePersonName?: string;
  achievementRate?: number;
  status?: string;
  remark?: string;
}

// ==================== 质量指标相关 ====================

export interface QualityIndicator {
  id: number;
  uuid: string;
  tenantId: number;
  indicatorNo: string;
  indicatorName: string;
  indicatorDescription?: string;
  indicatorType: string;
  targetValue?: number;
  currentValue: number;
  unit?: string;
  calculationMethod?: string;
  dataSource?: string;
  monitoringFrequency?: string;
  alertThreshold?: number;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface QualityIndicatorCreate {
  indicatorNo: string;
  indicatorName: string;
  indicatorDescription?: string;
  indicatorType: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  calculationMethod?: string;
  dataSource?: string;
  monitoringFrequency?: string;
  alertThreshold?: number;
  remark?: string;
}

export interface QualityIndicatorUpdate {
  indicatorName?: string;
  indicatorDescription?: string;
  indicatorType?: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  calculationMethod?: string;
  dataSource?: string;
  monitoringFrequency?: string;
  alertThreshold?: number;
  status?: string;
  remark?: string;
}
