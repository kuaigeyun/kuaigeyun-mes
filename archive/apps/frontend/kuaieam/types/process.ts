/**
 * EAM 数据类型定义
 * 
 * 定义维护计划、维护工单、故障报修等的数据类型
 */

// ==================== 维护计划相关 ====================

export interface MaintenancePlan {
  id: number;
  uuid: string;
  tenantId?: number;
  planNo: string;
  planName: string;
  equipmentId: number;
  equipmentName: string;
  planType: string;
  maintenanceType: string;
  cycleType?: string;
  cycleValue?: number;
  cycleUnit?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  responsiblePersonId?: number;
  responsiblePersonName?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenancePlanCreate {
  planNo: string;
  planName: string;
  equipmentId: number;
  equipmentName: string;
  planType: string;
  maintenanceType: string;
  cycleType?: string;
  cycleValue?: number;
  cycleUnit?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  responsiblePersonId?: number;
  responsiblePersonName?: string;
  remark?: string;
}

export interface MaintenancePlanUpdate {
  planName?: string;
  equipmentId?: number;
  equipmentName?: string;
  planType?: string;
  maintenanceType?: string;
  cycleType?: string;
  cycleValue?: number;
  cycleUnit?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  responsiblePersonId?: number;
  responsiblePersonName?: string;
  status?: string;
  remark?: string;
}

export interface MaintenancePlanListParams {
  skip?: number;
  limit?: number;
  planType?: string;
  status?: string;
}

// ==================== 维护工单相关 ====================

export interface MaintenanceWorkOrder {
  id: number;
  uuid: string;
  tenantId?: number;
  workorderNo: string;
  planId?: number;
  planUuid?: string;
  equipmentId: number;
  equipmentName: string;
  workorderType: string;
  maintenanceType: string;
  priority: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  assignedPersonId?: number;
  assignedPersonName?: string;
  executorId?: number;
  executorName?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceWorkOrderCreate {
  workorderNo: string;
  planId?: number;
  planUuid?: string;
  equipmentId: number;
  equipmentName: string;
  workorderType: string;
  maintenanceType: string;
  priority?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  assignedPersonId?: number;
  assignedPersonName?: string;
  executorId?: number;
  executorName?: string;
  remark?: string;
}

export interface MaintenanceWorkOrderUpdate {
  equipmentId?: number;
  equipmentName?: string;
  workorderType?: string;
  maintenanceType?: string;
  priority?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  assignedPersonId?: number;
  assignedPersonName?: string;
  executorId?: number;
  executorName?: string;
  status?: string;
  remark?: string;
}

export interface MaintenanceWorkOrderListParams {
  skip?: number;
  limit?: number;
  workorderType?: string;
  status?: string;
}

// ==================== 维护执行相关 ====================

export interface MaintenanceExecution {
  id: number;
  uuid: string;
  tenantId?: number;
  executionNo: string;
  workorderId?: number;
  workorderUuid?: string;
  equipmentId: number;
  equipmentName: string;
  executionDate: string;
  executorId?: number;
  executorName?: string;
  executionContent?: string;
  executionResult?: string;
  maintenanceCost?: number;
  sparePartsUsed?: any;
  acceptancePersonId?: number;
  acceptancePersonName?: string;
  acceptanceDate?: string;
  acceptanceResult?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceExecutionCreate {
  executionNo: string;
  workorderId?: number;
  workorderUuid?: string;
  equipmentId: number;
  equipmentName: string;
  executionDate: string;
  executorId?: number;
  executorName?: string;
  executionContent?: string;
  executionResult?: string;
  maintenanceCost?: number;
  sparePartsUsed?: any;
  acceptancePersonId?: number;
  acceptancePersonName?: string;
  acceptanceDate?: string;
  acceptanceResult?: string;
  remark?: string;
}

export interface MaintenanceExecutionUpdate {
  executionContent?: string;
  executionResult?: string;
  maintenanceCost?: number;
  sparePartsUsed?: any;
  status?: string;
  acceptancePersonId?: number;
  acceptancePersonName?: string;
  acceptanceDate?: string;
  acceptanceResult?: string;
  remark?: string;
}

export interface MaintenanceExecutionListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

// ==================== 故障报修相关 ====================

export interface FailureReport {
  id: number;
  uuid: string;
  tenantId?: number;
  reportNo: string;
  equipmentId: number;
  equipmentName: string;
  failureType: string;
  failureLevel: string;
  failureDescription: string;
  reporterId?: number;
  reporterName?: string;
  reportDate: string;
  assignedPersonId?: number;
  assignedPersonName?: string;
  assignedDate?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FailureReportCreate {
  reportNo: string;
  equipmentId: number;
  equipmentName: string;
  failureType: string;
  failureLevel?: string;
  failureDescription: string;
  reporterId?: number;
  reporterName?: string;
  reportDate: string;
  assignedPersonId?: number;
  assignedPersonName?: string;
  assignedDate?: string;
  remark?: string;
}

export interface FailureReportUpdate {
  equipmentId?: number;
  equipmentName?: string;
  failureType?: string;
  failureLevel?: string;
  failureDescription?: string;
  assignedPersonId?: number;
  assignedPersonName?: string;
  assignedDate?: string;
  status?: string;
  remark?: string;
}

export interface FailureReportListParams {
  skip?: number;
  limit?: number;
  status?: string;
  failureType?: string;
}

// ==================== 故障处理相关 ====================

export interface FailureHandling {
  id: number;
  uuid: string;
  tenantId?: number;
  handlingNo: string;
  reportId?: number;
  reportUuid?: string;
  equipmentId: number;
  equipmentName: string;
  handlingStartDate?: string;
  handlingEndDate?: string;
  handlerId?: number;
  handlerName?: string;
  handlingMethod?: string;
  handlingResult?: string;
  rootCause?: string;
  handlingCost?: number;
  sparePartsUsed?: any;
  acceptancePersonId?: number;
  acceptancePersonName?: string;
  acceptanceDate?: string;
  acceptanceResult?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FailureHandlingCreate {
  handlingNo: string;
  reportId?: number;
  reportUuid?: string;
  equipmentId: number;
  equipmentName: string;
  handlingStartDate?: string;
  handlingEndDate?: string;
  handlerId?: number;
  handlerName?: string;
  handlingMethod?: string;
  handlingResult?: string;
  rootCause?: string;
  handlingCost?: number;
  sparePartsUsed?: any;
  acceptancePersonId?: number;
  acceptancePersonName?: string;
  acceptanceDate?: string;
  acceptanceResult?: string;
  remark?: string;
}

export interface FailureHandlingUpdate {
  handlingStartDate?: string;
  handlingEndDate?: string;
  handlerId?: number;
  handlerName?: string;
  handlingMethod?: string;
  handlingResult?: string;
  rootCause?: string;
  handlingCost?: number;
  sparePartsUsed?: any;
  status?: string;
  acceptancePersonId?: number;
  acceptancePersonName?: string;
  acceptanceDate?: string;
  acceptanceResult?: string;
  remark?: string;
}

export interface FailureHandlingListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

// ==================== 备件需求相关 ====================

export interface SparePartDemand {
  id: number;
  uuid: string;
  tenantId?: number;
  demandNo: string;
  sourceType?: string;
  sourceId?: number;
  sourceNo?: string;
  materialId: number;
  materialName: string;
  materialCode?: string;
  demandQuantity: number;
  demandDate: string;
  requiredDate?: string;
  applicantId?: number;
  applicantName?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SparePartDemandCreate {
  demandNo: string;
  sourceType?: string;
  sourceId?: number;
  sourceNo?: string;
  materialId: number;
  materialName: string;
  materialCode?: string;
  demandQuantity: number;
  demandDate: string;
  requiredDate?: string;
  applicantId?: number;
  applicantName?: string;
  remark?: string;
}

export interface SparePartDemandUpdate {
  materialId?: number;
  materialName?: string;
  demandQuantity?: number;
  requiredDate?: string;
  status?: string;
  remark?: string;
}

export interface SparePartDemandListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

// ==================== 备件采购相关 ====================

export interface SparePartPurchase {
  id: number;
  uuid: string;
  tenantId?: number;
  purchaseNo: string;
  demandId?: number;
  demandUuid?: string;
  materialId: number;
  materialName: string;
  materialCode?: string;
  purchaseQuantity: number;
  unitPrice?: number;
  totalAmount?: number;
  supplierId?: number;
  supplierName?: string;
  purchaseDate: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  purchaserId?: number;
  purchaserName?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SparePartPurchaseCreate {
  purchaseNo: string;
  demandId?: number;
  demandUuid?: string;
  materialId: number;
  materialName: string;
  materialCode?: string;
  purchaseQuantity: number;
  unitPrice?: number;
  totalAmount?: number;
  supplierId?: number;
  supplierName?: string;
  purchaseDate: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  purchaserId?: number;
  purchaserName?: string;
  remark?: string;
}

export interface SparePartPurchaseUpdate {
  purchaseQuantity?: number;
  unitPrice?: number;
  totalAmount?: number;
  supplierId?: number;
  supplierName?: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  status?: string;
  remark?: string;
}

export interface SparePartPurchaseListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

// ==================== 工装夹具使用相关 ====================

export interface ToolingUsage {
  id: number;
  uuid: string;
  tenantId?: number;
  usageNo: string;
  toolingId: number;
  toolingName: string;
  toolingCode?: string;
  sourceType?: string;
  sourceId?: number;
  sourceNo?: string;
  usageDate: string;
  usageCount: number;
  totalUsageCount?: number;
  operatorId?: number;
  operatorName?: string;
  returnDate?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolingUsageCreate {
  usageNo: string;
  toolingId: number;
  toolingName: string;
  toolingCode?: string;
  sourceType?: string;
  sourceId?: number;
  sourceNo?: string;
  usageDate: string;
  usageCount?: number;
  totalUsageCount?: number;
  operatorId?: number;
  operatorName?: string;
  returnDate?: string;
  remark?: string;
}

export interface ToolingUsageUpdate {
  usageCount?: number;
  totalUsageCount?: number;
  status?: string;
  returnDate?: string;
  remark?: string;
}

export interface ToolingUsageListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

// ==================== 模具使用相关 ====================

export interface MoldUsage {
  id: number;
  uuid: string;
  tenantId?: number;
  usageNo: string;
  moldId: number;
  moldName: string;
  moldCode?: string;
  sourceType?: string;
  sourceId?: number;
  sourceNo?: string;
  usageDate: string;
  usageCount: number;
  totalUsageCount?: number;
  operatorId?: number;
  operatorName?: string;
  returnDate?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MoldUsageCreate {
  usageNo: string;
  moldId: number;
  moldName: string;
  moldCode?: string;
  sourceType?: string;
  sourceId?: number;
  sourceNo?: string;
  usageDate: string;
  usageCount?: number;
  totalUsageCount?: number;
  operatorId?: number;
  operatorName?: string;
  returnDate?: string;
  remark?: string;
}

export interface MoldUsageUpdate {
  usageCount?: number;
  totalUsageCount?: number;
  status?: string;
  returnDate?: string;
  remark?: string;
}

export interface MoldUsageListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

