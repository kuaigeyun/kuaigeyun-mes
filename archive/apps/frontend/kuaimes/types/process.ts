/**
 * MES 数据类型定义
 * 
 * 定义生产订单、工单、生产报工、生产追溯、返修工单等的数据类型
 */

// ==================== 生产订单相关 ====================

export interface Order {
  id: number;
  uuid: string;
  tenantId: number;
  orderNo: string;
  orderType: string;
  productId: number;
  productName: string;
  quantity: number;
  completedQuantity: number;
  status: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  sourceOrderId?: number;
  sourceOrderNo?: string;
  routeId?: number;
  routeName?: string;
  priority: string;
  ownerId?: number;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface OrderCreate {
  orderNo: string;
  orderType?: string;
  productId: number;
  productName: string;
  quantity: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  sourceOrderId?: number;
  sourceOrderNo?: string;
  routeId?: number;
  routeName?: string;
  priority?: string;
  remark?: string;
  ownerId?: number;
}

export interface OrderUpdate {
  orderType?: string;
  productId?: number;
  productName?: string;
  quantity?: number;
  status?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  routeId?: number;
  routeName?: string;
  priority?: string;
  remark?: string;
  ownerId?: number;
}

// ==================== 工单相关 ====================

export interface WorkOrder {
  id: number;
  uuid: string;
  tenantId: number;
  workOrderNo: string;
  orderId?: number;
  orderUuid?: string;
  productId: number;
  productName: string;
  quantity: number;
  completedQuantity: number;
  defectiveQuantity: number;
  routeId?: number;
  routeName?: string;
  currentOperation?: string;
  status: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  workCenterId?: number;
  workCenterName?: string;
  operatorId?: number;
  operatorName?: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface WorkOrderCreate {
  workOrderNo: string;
  orderId?: number;
  orderUuid?: string;
  productId: number;
  productName: string;
  quantity: number;
  routeId?: number;
  routeName?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  workCenterId?: number;
  workCenterName?: string;
  operatorId?: number;
  operatorName?: string;
  remark?: string;
}

export interface WorkOrderUpdate {
  productId?: number;
  productName?: string;
  quantity?: number;
  status?: string;
  currentOperation?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  workCenterId?: number;
  workCenterName?: string;
  operatorId?: number;
  operatorName?: string;
  remark?: string;
}

// ==================== 生产报工相关 ====================

export interface ProductionReport {
  id: number;
  uuid: string;
  tenantId: number;
  reportNo: string;
  workOrderId?: number;
  workOrderUuid?: string;
  operationId?: number;
  operationName?: string;
  reportDate: string;
  quantity: number;
  qualifiedQuantity: number;
  defectiveQuantity: number;
  defectiveReason?: string;
  workHours: number;
  operatorId?: number;
  operatorName?: string;
  workCenterId?: number;
  workCenterName?: string;
  batchNo?: string;
  serialNo?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ProductionReportCreate {
  reportNo: string;
  workOrderId?: number;
  workOrderUuid?: string;
  operationId?: number;
  operationName?: string;
  reportDate: string;
  quantity: number;
  qualifiedQuantity?: number;
  defectiveQuantity?: number;
  defectiveReason?: string;
  workHours?: number;
  operatorId?: number;
  operatorName?: string;
  workCenterId?: number;
  workCenterName?: string;
  batchNo?: string;
  serialNo?: string;
  remark?: string;
}

export interface ProductionReportUpdate {
  operationId?: number;
  operationName?: string;
  reportDate?: string;
  quantity?: number;
  qualifiedQuantity?: number;
  defectiveQuantity?: number;
  defectiveReason?: string;
  workHours?: number;
  status?: string;
  batchNo?: string;
  serialNo?: string;
  remark?: string;
}

// ==================== 生产追溯相关 ====================

export interface Traceability {
  id: number;
  uuid: string;
  tenantId: number;
  traceNo: string;
  traceType: string;
  batchNo?: string;
  serialNo?: string;
  productId: number;
  productName: string;
  workOrderId?: number;
  workOrderUuid?: string;
  operationId?: number;
  operationName?: string;
  materialId?: number;
  materialName?: string;
  materialBatchNo?: string;
  quantity: number;
  traceData?: any;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface TraceabilityCreate {
  traceNo: string;
  traceType: string;
  batchNo?: string;
  serialNo?: string;
  productId: number;
  productName: string;
  workOrderId?: number;
  workOrderUuid?: string;
  operationId?: number;
  operationName?: string;
  materialId?: number;
  materialName?: string;
  materialBatchNo?: string;
  quantity?: number;
  traceData?: any;
}

// ==================== 返修工单相关 ====================

export interface ReworkOrder {
  id: number;
  uuid: string;
  tenantId: number;
  reworkOrderNo: string;
  originalWorkOrderId?: number;
  originalWorkOrderUuid?: string;
  productId: number;
  productName: string;
  quantity: number;
  reworkReason: string;
  reworkType: string;
  routeId?: number;
  routeName?: string;
  status: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  workCenterId?: number;
  workCenterName?: string;
  operatorId?: number;
  operatorName?: string;
  cost: number;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ReworkOrderCreate {
  reworkOrderNo: string;
  originalWorkOrderId?: number;
  originalWorkOrderUuid?: string;
  productId: number;
  productName: string;
  quantity: number;
  reworkReason: string;
  reworkType: string;
  routeId?: number;
  routeName?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  workCenterId?: number;
  workCenterName?: string;
  operatorId?: number;
  operatorName?: string;
  remark?: string;
}

export interface ReworkOrderUpdate {
  productId?: number;
  productName?: string;
  quantity?: number;
  reworkReason?: string;
  reworkType?: string;
  status?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  workCenterId?: number;
  workCenterName?: string;
  operatorId?: number;
  operatorName?: string;
  cost?: number;
  remark?: string;
}
