/**
 * MRP 数据类型定义
 * 
 * 定义MRP计划、LRP批次、物料需求、缺料预警等的数据类型
 */

// ==================== MRP计划相关 ====================

export interface MRPPlan {
  id: number;
  uuid: string;
  tenantId: number;
  planNo: string;
  planName: string;
  planType: string;
  planDate: string;
  status: string;
  startDate?: string;
  endDate?: string;
  calculationParams?: any;
  calculationResult?: any;
  ownerId?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface MRPPlanCreate {
  planNo: string;
  planName: string;
  planType?: string;
  planDate: string;
  startDate?: string;
  endDate?: string;
  calculationParams?: any;
  ownerId?: number;
}

export interface MRPPlanUpdate {
  planName?: string;
  planType?: string;
  planDate?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  calculationParams?: any;
  calculationResult?: any;
  ownerId?: number;
}

// ==================== LRP批次相关 ====================

export interface LRPBatch {
  id: number;
  uuid: string;
  tenantId: number;
  batchNo: string;
  batchName: string;
  orderIds?: number[];
  status: string;
  plannedDate?: string;
  deliveryDate?: string;
  batchParams?: any;
  ownerId?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface LRPBatchCreate {
  batchNo: string;
  batchName: string;
  orderIds?: number[];
  plannedDate?: string;
  deliveryDate?: string;
  batchParams?: any;
  ownerId?: number;
}

export interface LRPBatchUpdate {
  batchName?: string;
  orderIds?: number[];
  status?: string;
  plannedDate?: string;
  deliveryDate?: string;
  batchParams?: any;
  ownerId?: number;
}

// ==================== 物料需求相关 ====================

export interface MaterialRequirement {
  id: number;
  uuid: string;
  tenantId: number;
  requirementNo: string;
  materialId: number;
  requirementType: string;
  planId?: number;
  requirementDate: string;
  grossRequirement: number;
  availableStock: number;
  inTransitStock: number;
  safetyStock: number;
  netRequirement: number;
  suggestedOrderQty?: number;
  suggestedOrderDate?: string;
  suggestedType?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface MaterialRequirementCreate {
  requirementNo: string;
  materialId: number;
  requirementType: string;
  planId?: number;
  requirementDate: string;
  grossRequirement?: number;
  availableStock?: number;
  inTransitStock?: number;
  safetyStock?: number;
  netRequirement?: number;
  suggestedOrderQty?: number;
  suggestedOrderDate?: string;
  suggestedType?: string;
}

export interface MaterialRequirementUpdate {
  requirementType?: string;
  planId?: number;
  requirementDate?: string;
  grossRequirement?: number;
  availableStock?: number;
  inTransitStock?: number;
  safetyStock?: number;
  netRequirement?: number;
  suggestedOrderQty?: number;
  suggestedOrderDate?: string;
  suggestedType?: string;
  status?: string;
}

// ==================== 缺料预警相关 ====================

export interface ShortageAlert {
  id: number;
  uuid: string;
  tenantId: number;
  alertNo: string;
  materialId: number;
  requirementId?: number;
  shortageQty: number;
  shortageDate: string;
  alertLevel: string;
  alertReason?: string;
  alertStatus: string;
  suggestedAction?: string;
  handlerId?: number;
  handledAt?: string;
  handleResult?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ShortageAlertCreate {
  alertNo: string;
  materialId: number;
  requirementId?: number;
  shortageQty: number;
  shortageDate: string;
  alertLevel?: string;
  alertReason?: string;
  suggestedAction?: string;
}

export interface ShortageAlertUpdate {
  shortageQty?: number;
  shortageDate?: string;
  alertLevel?: string;
  alertReason?: string;
  alertStatus?: string;
  suggestedAction?: string;
  handlerId?: number;
  handledAt?: string;
  handleResult?: string;
}
