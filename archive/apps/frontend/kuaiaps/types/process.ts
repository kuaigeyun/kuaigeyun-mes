/**
 * APS 数据类型定义
 * 
 * 定义产能规划、生产计划、资源调度、计划调整等的数据类型
 */

// ==================== 产能规划相关 ====================

export interface CapacityPlanning {
  id: number;
  uuid: string;
  tenantId?: number;
  planningNo: string;
  planningName: string;
  resourceType: string;
  resourceId?: number;
  resourceName?: string;
  planningPeriod?: string;
  planningStartDate?: string;
  planningEndDate?: string;
  plannedCapacity?: number;
  actualCapacity?: number;
  utilizationRate?: number;
  bottleneckStatus: string;
  optimizationSuggestion?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CapacityPlanningCreate {
  planningNo: string;
  planningName: string;
  resourceType: string;
  resourceId?: number;
  resourceName?: string;
  planningPeriod?: string;
  planningStartDate?: string;
  planningEndDate?: string;
  plannedCapacity?: number;
  actualCapacity?: number;
  utilizationRate?: number;
  bottleneckStatus?: string;
  optimizationSuggestion?: string;
  status?: string;
  remark?: string;
}

export interface CapacityPlanningUpdate {
  planningName?: string;
  resourceType?: string;
  resourceId?: number;
  resourceName?: string;
  planningPeriod?: string;
  planningStartDate?: string;
  planningEndDate?: string;
  plannedCapacity?: number;
  actualCapacity?: number;
  utilizationRate?: number;
  bottleneckStatus?: string;
  optimizationSuggestion?: string;
  status?: string;
  remark?: string;
}

export interface CapacityPlanningListParams {
  skip?: number;
  limit?: number;
  resourceType?: string;
  bottleneckStatus?: string;
  status?: string;
}

// ==================== 生产计划相关 ====================

export interface ProductionPlan {
  id: number;
  uuid: string;
  tenantId?: number;
  planNo: string;
  planName: string;
  planType: string;
  sourceType?: string;
  sourceId?: number;
  sourceNo?: string;
  productId?: number;
  productName?: string;
  productCode?: string;
  plannedQuantity?: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  priority: string;
  optimizationTarget?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionPlanCreate {
  planNo: string;
  planName: string;
  planType: string;
  sourceType?: string;
  sourceId?: number;
  sourceNo?: string;
  productId?: number;
  productName?: string;
  productCode?: string;
  plannedQuantity?: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  priority?: string;
  optimizationTarget?: string;
  status?: string;
  remark?: string;
}

export interface ProductionPlanUpdate {
  planName?: string;
  planType?: string;
  sourceType?: string;
  sourceId?: number;
  sourceNo?: string;
  productId?: number;
  productName?: string;
  productCode?: string;
  plannedQuantity?: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  priority?: string;
  optimizationTarget?: string;
  status?: string;
  remark?: string;
}

export interface ProductionPlanListParams {
  skip?: number;
  limit?: number;
  planType?: string;
  priority?: string;
  status?: string;
}

// ==================== 资源调度相关 ====================

export interface ResourceScheduling {
  id: number;
  uuid: string;
  tenantId?: number;
  schedulingNo: string;
  schedulingName: string;
  resourceType: string;
  resourceId?: number;
  resourceName?: string;
  planId?: number;
  planUuid?: string;
  planNo?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  availabilityStatus: string;
  schedulingStatus: string;
  optimizationSuggestion?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceSchedulingCreate {
  schedulingNo: string;
  schedulingName: string;
  resourceType: string;
  resourceId?: number;
  resourceName?: string;
  planId?: number;
  planUuid?: string;
  planNo?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  availabilityStatus?: string;
  schedulingStatus?: string;
  optimizationSuggestion?: string;
  status?: string;
  remark?: string;
}

export interface ResourceSchedulingUpdate {
  schedulingName?: string;
  resourceType?: string;
  resourceId?: number;
  resourceName?: string;
  planId?: number;
  planUuid?: string;
  planNo?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  availabilityStatus?: string;
  schedulingStatus?: string;
  optimizationSuggestion?: string;
  status?: string;
  remark?: string;
}

export interface ResourceSchedulingListParams {
  skip?: number;
  limit?: number;
  resourceType?: string;
  availabilityStatus?: string;
  schedulingStatus?: string;
}

// ==================== 计划调整相关 ====================

export interface PlanAdjustment {
  id: number;
  uuid: string;
  tenantId?: number;
  adjustmentNo: string;
  adjustmentName: string;
  adjustmentType: string;
  planId?: number;
  planUuid?: string;
  planNo?: string;
  adjustmentReason?: string;
  impactAnalysis?: any;
  originalPlanData?: any;
  adjustedPlanData?: any;
  approvalStatus: string;
  approvalPersonId?: number;
  approvalPersonName?: string;
  approvalDate?: string;
  adjustmentStatus: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanAdjustmentCreate {
  adjustmentNo: string;
  adjustmentName: string;
  adjustmentType: string;
  planId?: number;
  planUuid?: string;
  planNo?: string;
  adjustmentReason?: string;
  impactAnalysis?: any;
  originalPlanData?: any;
  adjustedPlanData?: any;
  approvalStatus?: string;
  approvalPersonId?: number;
  approvalPersonName?: string;
  approvalDate?: string;
  adjustmentStatus?: string;
  status?: string;
  remark?: string;
}

export interface PlanAdjustmentUpdate {
  adjustmentName?: string;
  adjustmentType?: string;
  planId?: number;
  planUuid?: string;
  planNo?: string;
  adjustmentReason?: string;
  impactAnalysis?: any;
  originalPlanData?: any;
  adjustedPlanData?: any;
  approvalStatus?: string;
  approvalPersonId?: number;
  approvalPersonName?: string;
  approvalDate?: string;
  adjustmentStatus?: string;
  status?: string;
  remark?: string;
}

export interface PlanAdjustmentListParams {
  skip?: number;
  limit?: number;
  adjustmentType?: string;
  approvalStatus?: string;
  adjustmentStatus?: string;
}

