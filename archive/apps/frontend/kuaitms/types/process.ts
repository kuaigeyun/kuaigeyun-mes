/**
 * TMS 数据类型定义
 * 
 * 定义运输需求、运输计划、车辆调度、运输执行、运费结算等的数据类型
 */

// ==================== 运输需求相关 ====================

export interface TransportDemand {
  id: number;
  uuid: string;
  tenantId?: number;
  demandNo: string;
  sourceType?: string;
  sourceId?: number;
  sourceNo?: string;
  customerId?: number;
  customerName?: string;
  deliveryAddress?: string;
  contactPerson?: string;
  contactPhone?: string;
  materialId?: number;
  materialName?: string;
  materialCode?: string;
  quantity?: number;
  unit?: string;
  requiredDate?: string;
  priority: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransportDemandCreate {
  demandNo: string;
  sourceType?: string;
  sourceId?: number;
  sourceNo?: string;
  customerId?: number;
  customerName?: string;
  deliveryAddress?: string;
  contactPerson?: string;
  contactPhone?: string;
  materialId?: number;
  materialName?: string;
  materialCode?: string;
  quantity?: number;
  unit?: string;
  requiredDate?: string;
  priority?: string;
  remark?: string;
}

export interface TransportDemandUpdate {
  customerId?: number;
  customerName?: string;
  deliveryAddress?: string;
  contactPerson?: string;
  contactPhone?: string;
  materialId?: number;
  materialName?: string;
  quantity?: number;
  requiredDate?: string;
  priority?: string;
  status?: string;
  remark?: string;
}

export interface TransportDemandListParams {
  skip?: number;
  limit?: number;
  status?: string;
  sourceType?: string;
}

// ==================== 运输计划相关 ====================

export interface TransportPlan {
  id: number;
  uuid: string;
  tenantId?: number;
  planNo: string;
  planName: string;
  vehicleId?: number;
  vehicleNo?: string;
  driverId?: number;
  driverName?: string;
  routeInfo?: any;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransportPlanCreate {
  planNo: string;
  planName: string;
  vehicleId?: number;
  vehicleNo?: string;
  driverId?: number;
  driverName?: string;
  routeInfo?: any;
  plannedStartDate?: string;
  plannedEndDate?: string;
  remark?: string;
}

export interface TransportPlanUpdate {
  planName?: string;
  vehicleId?: number;
  vehicleNo?: string;
  driverId?: number;
  driverName?: string;
  routeInfo?: any;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  status?: string;
  remark?: string;
}

export interface TransportPlanListParams {
  skip?: number;
  limit?: number;
  status?: string;
  vehicleId?: number;
}

// ==================== 车辆调度相关 ====================

export interface VehicleDispatch {
  id: number;
  uuid: string;
  tenantId?: number;
  dispatchNo: string;
  vehicleId?: number;
  vehicleNo?: string;
  driverId?: number;
  driverName?: string;
  planId?: number;
  planUuid?: string;
  dispatchDate?: string;
  dispatchType: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleDispatchCreate {
  dispatchNo: string;
  vehicleId?: number;
  vehicleNo?: string;
  driverId?: number;
  driverName?: string;
  planId?: number;
  planUuid?: string;
  dispatchDate?: string;
  dispatchType?: string;
  remark?: string;
}

export interface VehicleDispatchUpdate {
  vehicleId?: number;
  vehicleNo?: string;
  driverId?: number;
  driverName?: string;
  dispatchDate?: string;
  dispatchType?: string;
  status?: string;
  remark?: string;
}

export interface VehicleDispatchListParams {
  skip?: number;
  limit?: number;
  status?: string;
  vehicleId?: number;
}

// ==================== 运输执行相关 ====================

export interface TransportExecution {
  id: number;
  uuid: string;
  tenantId?: number;
  executionNo: string;
  planId?: number;
  planUuid?: string;
  vehicleId?: number;
  vehicleNo?: string;
  driverId?: number;
  driverName?: string;
  loadingDate?: string;
  loadingStatus: string;
  departureDate?: string;
  currentLocation?: string;
  trackingStatus: string;
  arrivalDate?: string;
  signDate?: string;
  signPerson?: string;
  signStatus: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransportExecutionCreate {
  executionNo: string;
  planId?: number;
  planUuid?: string;
  vehicleId?: number;
  vehicleNo?: string;
  driverId?: number;
  driverName?: string;
  loadingDate?: string;
  loadingStatus?: string;
  departureDate?: string;
  currentLocation?: string;
  trackingStatus?: string;
  arrivalDate?: string;
  signDate?: string;
  signPerson?: string;
  signStatus?: string;
  remark?: string;
}

export interface TransportExecutionUpdate {
  loadingDate?: string;
  loadingStatus?: string;
  departureDate?: string;
  currentLocation?: string;
  trackingStatus?: string;
  arrivalDate?: string;
  signDate?: string;
  signPerson?: string;
  signStatus?: string;
  status?: string;
  remark?: string;
}

export interface TransportExecutionListParams {
  skip?: number;
  limit?: number;
  status?: string;
  trackingStatus?: string;
}

// ==================== 运费结算相关 ====================

export interface FreightSettlement {
  id: number;
  uuid: string;
  tenantId?: number;
  settlementNo: string;
  executionId?: number;
  executionUuid?: string;
  vehicleId?: number;
  vehicleNo?: string;
  driverId?: number;
  driverName?: string;
  distance?: number;
  freightAmount?: number;
  calculationRule?: any;
  settlementDate?: string;
  settlementStatus: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FreightSettlementCreate {
  settlementNo: string;
  executionId?: number;
  executionUuid?: string;
  vehicleId?: number;
  vehicleNo?: string;
  driverId?: number;
  driverName?: string;
  distance?: number;
  freightAmount?: number;
  calculationRule?: any;
  settlementDate?: string;
  settlementStatus?: string;
  remark?: string;
}

export interface FreightSettlementUpdate {
  distance?: number;
  freightAmount?: number;
  calculationRule?: any;
  settlementDate?: string;
  settlementStatus?: string;
  status?: string;
  remark?: string;
}

export interface FreightSettlementListParams {
  skip?: number;
  limit?: number;
  status?: string;
  settlementStatus?: string;
}

