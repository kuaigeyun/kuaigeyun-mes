/**
 * 生产执行相关类型定义
 */

// 工单状态枚举
export type WorkOrderStatus = 'draft' | 'released' | 'in_progress' | 'completed' | 'cancelled';

// 生产模式枚举
export type ProductionMode = 'MTS' | 'MTO';

// 报工状态枚举
export type ReportingStatus = 'pending' | 'approved' | 'rejected';

// 工单接口
export interface WorkOrder {
  id: number;
  uuid: string;
  code: string;
  name: string;
  productId: number;
  productName: string;
  quantity: number;
  status: WorkOrderStatus;
  productionMode: ProductionMode;
  processRouteId?: number;
  processRouteName?: string;
  startDate?: string;
  endDate?: string;
  priority: number;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  tenantId: number;
}

// 工单创建接口
export interface WorkOrderCreate {
  code: string;
  name: string;
  productId: number;
  quantity: number;
  productionMode: ProductionMode;
  processRouteId?: number;
  startDate?: string;
  endDate?: string;
  priority?: number;
  remarks?: string;
}

// 工单更新接口
export interface WorkOrderUpdate {
  name?: string;
  quantity?: number;
  processRouteId?: number;
  startDate?: string;
  endDate?: string;
  priority?: number;
  remarks?: string;
}

// 工单列表查询参数
export interface WorkOrderListParams {
  skip?: number;
  limit?: number;
  code?: string;
  name?: string;
  status?: WorkOrderStatus;
  productionMode?: ProductionMode;
  productId?: number;
  startDate?: string;
  endDate?: string;
}

// 工单列表响应
export interface WorkOrderListResponse {
  items: WorkOrder[];
  total: number;
  skip: number;
  limit: number;
}

// 报工记录接口
export interface ReportingRecord {
  id: number;
  uuid: string;
  workOrderId: number;
  workOrderCode: string;
  workOrderName: string;
  operationId: number;
  operationName: string;
  workerId: number;
  workerName: string;
  reportedQuantity: number;
  qualifiedQuantity: number;
  unqualifiedQuantity: number;
  workHours: number;
  status: ReportingStatus;
  reportedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  remarks?: string;
  tenantId: number;
}

// 报工创建接口
export interface ReportingCreate {
  workOrderId: number;
  operationId: number;
  workerId: number;
  reportedQuantity: number;
  qualifiedQuantity: number;
  unqualifiedQuantity: number;
  workHours: number;
  remarks?: string;
}

// 报工审核接口
export interface ReportingApprove {
  approved: boolean;
  remarks?: string;
}

// 报工列表查询参数
export interface ReportingListParams {
  skip?: number;
  limit?: number;
  workOrderId?: number;
  operationId?: number;
  workerId?: number;
  status?: ReportingStatus;
  startDate?: string;
  endDate?: string;
}

// 报工列表响应
export interface ReportingListResponse {
  items: ReportingRecord[];
  total: number;
  skip: number;
  limit: number;
}

// 报工统计接口
export interface ReportingStatistics {
  totalReports: number;
  pendingApprovals: number;
  approvedReports: number;
  rejectedReports: number;
  totalWorkHours: number;
  averageQualityRate: number;
  todayReports: number;
  todayWorkHours: number;
}
