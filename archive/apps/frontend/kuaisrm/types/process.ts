/**
 * SRM 数据类型定义
 * 
 * 定义采购订单、委外订单、供应商评估、采购合同等的数据类型
 */

// ==================== 采购订单相关 ====================

export interface PurchaseOrder {
  id: number;
  uuid: string;
  tenantId: number;
  orderNo: string;
  orderDate: string;
  supplierId: number;
  status: string;
  totalAmount: number;
  currency: string;
  deliveryDate?: string;
  approvalInstanceId?: number;
  approvalStatus?: string;
  requirementId?: number;
  orderItems?: Array<{ materialId: number; quantity: number; price: number }>;
  remark?: string;
  ownerId?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface PurchaseOrderCreate {
  orderNo: string;
  orderDate: string;
  supplierId: number;
  totalAmount?: number;
  currency?: string;
  deliveryDate?: string;
  requirementId?: number;
  orderItems?: Array<{ materialId: number; quantity: number; price: number }>;
  remark?: string;
  ownerId?: number;
}

export interface PurchaseOrderUpdate {
  orderDate?: string;
  supplierId?: number;
  status?: string;
  totalAmount?: number;
  currency?: string;
  deliveryDate?: string;
  orderItems?: Array<{ materialId: number; quantity: number; price: number }>;
  remark?: string;
  ownerId?: number;
}

// ==================== 委外订单相关 ====================

export interface OutsourcingOrder {
  id: number;
  uuid: string;
  tenantId: number;
  orderNo: string;
  orderDate: string;
  supplierId: number;
  status: string;
  totalAmount: number;
  currency: string;
  deliveryDate?: string;
  progress: number;
  approvalInstanceId?: number;
  approvalStatus?: string;
  requirementId?: number;
  orderItems?: Array<{ materialId: number; quantity: number; price: number }>;
  remark?: string;
  ownerId?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface OutsourcingOrderCreate {
  orderNo: string;
  orderDate: string;
  supplierId: number;
  totalAmount?: number;
  currency?: string;
  deliveryDate?: string;
  requirementId?: number;
  orderItems?: Array<{ materialId: number; quantity: number; price: number }>;
  remark?: string;
  ownerId?: number;
}

export interface OutsourcingOrderUpdate {
  orderDate?: string;
  supplierId?: number;
  status?: string;
  totalAmount?: number;
  currency?: string;
  deliveryDate?: string;
  progress?: number;
  orderItems?: Array<{ materialId: number; quantity: number; price: number }>;
  remark?: string;
  ownerId?: number;
}

// ==================== 供应商评估相关 ====================

export interface SupplierEvaluation {
  id: number;
  uuid: string;
  tenantId: number;
  evaluationNo: string;
  supplierId: number;
  evaluationPeriod: string;
  evaluationDate: string;
  qualityScore: number;
  deliveryScore: number;
  priceScore: number;
  serviceScore: number;
  totalScore: number;
  evaluationLevel?: string;
  evaluationResult?: any;
  evaluatorId?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface SupplierEvaluationCreate {
  evaluationNo: string;
  supplierId: number;
  evaluationPeriod: string;
  evaluationDate: string;
  qualityScore?: number;
  deliveryScore?: number;
  priceScore?: number;
  serviceScore?: number;
  totalScore?: number;
  evaluationLevel?: string;
  evaluationResult?: any;
  evaluatorId?: number;
}

export interface SupplierEvaluationUpdate {
  evaluationPeriod?: string;
  evaluationDate?: string;
  qualityScore?: number;
  deliveryScore?: number;
  priceScore?: number;
  serviceScore?: number;
  totalScore?: number;
  evaluationLevel?: string;
  evaluationResult?: any;
  evaluatorId?: number;
}

// ==================== 采购合同相关 ====================

export interface PurchaseContract {
  id: number;
  uuid: string;
  tenantId: number;
  contractNo: string;
  contractName: string;
  supplierId: number;
  contractDate: string;
  startDate?: string;
  endDate?: string;
  status: string;
  totalAmount: number;
  currency: string;
  approvalInstanceId?: number;
  approvalStatus?: string;
  contractContent?: any;
  remark?: string;
  ownerId?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface PurchaseContractCreate {
  contractNo: string;
  contractName: string;
  supplierId: number;
  contractDate: string;
  startDate?: string;
  endDate?: string;
  totalAmount?: number;
  currency?: string;
  contractContent?: any;
  remark?: string;
  ownerId?: number;
}

export interface PurchaseContractUpdate {
  contractName?: string;
  supplierId?: number;
  contractDate?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  totalAmount?: number;
  currency?: string;
  contractContent?: any;
  remark?: string;
  ownerId?: number;
}
