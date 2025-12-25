/**
 * WMS 数据类型定义
 * 
 * 定义库存、入库单、出库单、盘点单、库存调整等的数据类型
 */

// ==================== 库存相关 ====================

export interface Inventory {
  id: number;
  uuid: string;
  tenantId: number;
  materialId: number;
  warehouseId: number;
  locationId?: number;
  quantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  inTransitQuantity: number;
  unit?: string;
  batchNo?: string;
  lotNo?: string;
  expiryDate?: string;
  costPrice: number;
  totalCost: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// ==================== 入库单相关 ====================

export interface InboundOrder {
  id: number;
  uuid: string;
  tenantId: number;
  orderNo: string;
  orderDate: string;
  orderType: string;
  warehouseId: number;
  status: string;
  totalAmount: number;
  sourceOrderId?: number;
  sourceOrderNo?: string;
  orderItems?: Array<{ materialId: number; quantity: number; price: number; locationId?: number }>;
  remark?: string;
  ownerId?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface InboundOrderCreate {
  orderNo: string;
  orderDate: string;
  orderType: string;
  warehouseId: number;
  totalAmount?: number;
  sourceOrderId?: number;
  sourceOrderNo?: string;
  orderItems?: Array<{ materialId: number; quantity: number; price: number; locationId?: number }>;
  remark?: string;
  ownerId?: number;
}

export interface InboundOrderUpdate {
  orderDate?: string;
  orderType?: string;
  warehouseId?: number;
  status?: string;
  totalAmount?: number;
  orderItems?: Array<{ materialId: number; quantity: number; price: number; locationId?: number }>;
  remark?: string;
  ownerId?: number;
}

// ==================== 出库单相关 ====================

export interface OutboundOrder {
  id: number;
  uuid: string;
  tenantId: number;
  orderNo: string;
  orderDate: string;
  orderType: string;
  warehouseId: number;
  status: string;
  totalAmount: number;
  sourceOrderId?: number;
  sourceOrderNo?: string;
  pickingStatus?: string;
  orderItems?: Array<{ materialId: number; quantity: number; price: number; locationId?: number }>;
  remark?: string;
  ownerId?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface OutboundOrderCreate {
  orderNo: string;
  orderDate: string;
  orderType: string;
  warehouseId: number;
  totalAmount?: number;
  sourceOrderId?: number;
  sourceOrderNo?: string;
  orderItems?: Array<{ materialId: number; quantity: number; price: number; locationId?: number }>;
  remark?: string;
  ownerId?: number;
}

export interface OutboundOrderUpdate {
  orderDate?: string;
  orderType?: string;
  warehouseId?: number;
  status?: string;
  totalAmount?: number;
  pickingStatus?: string;
  orderItems?: Array<{ materialId: number; quantity: number; price: number; locationId?: number }>;
  remark?: string;
  ownerId?: number;
}

// ==================== 盘点单相关 ====================

export interface Stocktake {
  id: number;
  uuid: string;
  tenantId: number;
  stocktakeNo: string;
  stocktakeDate: string;
  warehouseId: number;
  locationId?: number;
  status: string;
  stocktakeType: string;
  stocktakeItems?: Array<{ materialId: number; bookQuantity: number; actualQuantity: number; difference: number }>;
  differenceAmount: number;
  remark?: string;
  ownerId?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface StocktakeCreate {
  stocktakeNo: string;
  stocktakeDate: string;
  warehouseId: number;
  locationId?: number;
  stocktakeType?: string;
  stocktakeItems?: Array<{ materialId: number; bookQuantity: number; actualQuantity: number; difference: number }>;
  remark?: string;
  ownerId?: number;
}

export interface StocktakeUpdate {
  stocktakeDate?: string;
  warehouseId?: number;
  locationId?: number;
  status?: string;
  stocktakeType?: string;
  stocktakeItems?: Array<{ materialId: number; bookQuantity: number; actualQuantity: number; difference: number }>;
  differenceAmount?: number;
  remark?: string;
  ownerId?: number;
}

// ==================== 库存调整相关 ====================

export interface InventoryAdjustment {
  id: number;
  uuid: string;
  tenantId: number;
  adjustmentNo: string;
  adjustmentDate: string;
  warehouseId: number;
  adjustmentType: string;
  adjustmentReason: string;
  status: string;
  approvalInstanceId?: number;
  approvalStatus?: string;
  adjustmentItems?: Array<{ materialId: number; quantity: number; adjustmentType: string }>;
  totalAmount: number;
  ownerId?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface InventoryAdjustmentCreate {
  adjustmentNo: string;
  adjustmentDate: string;
  warehouseId: number;
  adjustmentType: string;
  adjustmentReason: string;
  adjustmentItems?: Array<{ materialId: number; quantity: number; adjustmentType: string }>;
  totalAmount?: number;
  ownerId?: number;
}

export interface InventoryAdjustmentUpdate {
  adjustmentDate?: string;
  warehouseId?: number;
  adjustmentType?: string;
  adjustmentReason?: string;
  status?: string;
  adjustmentItems?: Array<{ materialId: number; quantity: number; adjustmentType: string }>;
  totalAmount?: number;
  ownerId?: number;
}
