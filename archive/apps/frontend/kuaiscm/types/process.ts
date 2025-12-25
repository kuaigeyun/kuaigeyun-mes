/**
 * SCM 数据类型定义
 * 
 * 定义供应链网络、需求预测、供应链风险、全局库存视图等的数据类型
 */

// ==================== 供应链网络相关 ====================

export interface SupplyChainNetwork {
  id: number;
  uuid: string;
  tenantId?: number;
  networkNo: string;
  networkName: string;
  nodeType: string;
  nodeId?: number;
  nodeName?: string;
  nodeCode?: string;
  parentNodeId?: number;
  parentNodeUuid?: string;
  level: number;
  relationshipType?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplyChainNetworkCreate {
  networkNo: string;
  networkName: string;
  nodeType: string;
  nodeId?: number;
  nodeName?: string;
  nodeCode?: string;
  parentNodeId?: number;
  parentNodeUuid?: string;
  level?: number;
  relationshipType?: string;
  status?: string;
  remark?: string;
}

export interface SupplyChainNetworkUpdate {
  networkName?: string;
  nodeType?: string;
  nodeId?: number;
  nodeName?: string;
  nodeCode?: string;
  parentNodeId?: number;
  parentNodeUuid?: string;
  level?: number;
  relationshipType?: string;
  status?: string;
  remark?: string;
}

export interface SupplyChainNetworkListParams {
  skip?: number;
  limit?: number;
  nodeType?: string;
  status?: string;
}

// ==================== 需求预测相关 ====================

export interface DemandForecast {
  id: number;
  uuid: string;
  tenantId?: number;
  forecastNo: string;
  forecastName: string;
  supplierId?: number;
  supplierName?: string;
  materialId?: number;
  materialName?: string;
  materialCode?: string;
  forecastPeriod?: string;
  forecastStartDate?: string;
  forecastEndDate?: string;
  forecastQuantity?: number;
  actualQuantity?: number;
  accuracyRate?: number;
  sharedStatus: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DemandForecastCreate {
  forecastNo: string;
  forecastName: string;
  supplierId?: number;
  supplierName?: string;
  materialId?: number;
  materialName?: string;
  materialCode?: string;
  forecastPeriod?: string;
  forecastStartDate?: string;
  forecastEndDate?: string;
  forecastQuantity?: number;
  actualQuantity?: number;
  accuracyRate?: number;
  sharedStatus?: string;
  status?: string;
  remark?: string;
}

export interface DemandForecastUpdate {
  forecastName?: string;
  supplierId?: number;
  supplierName?: string;
  materialId?: number;
  materialName?: string;
  materialCode?: string;
  forecastPeriod?: string;
  forecastStartDate?: string;
  forecastEndDate?: string;
  forecastQuantity?: number;
  actualQuantity?: number;
  accuracyRate?: number;
  sharedStatus?: string;
  status?: string;
  remark?: string;
}

export interface DemandForecastListParams {
  skip?: number;
  limit?: number;
  supplierId?: number;
  status?: string;
}

// ==================== 供应链风险相关 ====================

export interface SupplyChainRisk {
  id: number;
  uuid: string;
  tenantId?: number;
  riskNo: string;
  riskName: string;
  riskType: string;
  riskCategory?: string;
  supplierId?: number;
  supplierName?: string;
  riskLevel: string;
  riskProbability?: number;
  riskImpact?: string;
  riskDescription?: string;
  warningStatus: string;
  contingencyPlan?: any;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplyChainRiskCreate {
  riskNo: string;
  riskName: string;
  riskType: string;
  riskCategory?: string;
  supplierId?: number;
  supplierName?: string;
  riskLevel?: string;
  riskProbability?: number;
  riskImpact?: string;
  riskDescription?: string;
  warningStatus?: string;
  contingencyPlan?: any;
  status?: string;
  remark?: string;
}

export interface SupplyChainRiskUpdate {
  riskName?: string;
  riskType?: string;
  riskCategory?: string;
  supplierId?: number;
  supplierName?: string;
  riskLevel?: string;
  riskProbability?: number;
  riskImpact?: string;
  riskDescription?: string;
  warningStatus?: string;
  contingencyPlan?: any;
  status?: string;
  remark?: string;
}

export interface SupplyChainRiskListParams {
  skip?: number;
  limit?: number;
  riskType?: string;
  riskLevel?: string;
  warningStatus?: string;
}

// ==================== 全局库存视图相关 ====================

export interface GlobalInventoryView {
  id: number;
  uuid: string;
  tenantId?: number;
  viewNo: string;
  viewName: string;
  materialId?: number;
  materialName?: string;
  materialCode?: string;
  inventoryType?: string;
  warehouseId?: number;
  warehouseName?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  totalValue?: number;
  turnoverRate?: number;
  alertStatus: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GlobalInventoryViewCreate {
  viewNo: string;
  viewName: string;
  materialId?: number;
  materialName?: string;
  materialCode?: string;
  inventoryType?: string;
  warehouseId?: number;
  warehouseName?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  totalValue?: number;
  turnoverRate?: number;
  alertStatus?: string;
  status?: string;
  remark?: string;
}

export interface GlobalInventoryViewUpdate {
  viewName?: string;
  materialId?: number;
  materialName?: string;
  materialCode?: string;
  inventoryType?: string;
  warehouseId?: number;
  warehouseName?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  totalValue?: number;
  turnoverRate?: number;
  alertStatus?: string;
  status?: string;
  remark?: string;
}

export interface GlobalInventoryViewListParams {
  skip?: number;
  limit?: number;
  inventoryType?: string;
  alertStatus?: string;
  status?: string;
}

