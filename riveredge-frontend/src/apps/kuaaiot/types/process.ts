/**
 * IOT 数据类型定义
 * 
 * 定义设备数据采集、传感器数据、实时监控、数据接口等的数据类型
 */

// ==================== 设备数据采集相关 ====================

export interface DeviceDataCollection {
  id: number;
  uuid: string;
  tenantId?: number;
  collectionNo: string;
  collectionName: string;
  deviceId?: number;
  deviceName?: string;
  collectionPoint?: string;
  collectionFrequency?: number;
  collectionStatus: string;
  dataQuality: string;
  lastCollectionTime?: string;
  collectionCount: number;
  errorCount: number;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceDataCollectionCreate {
  collectionNo: string;
  collectionName: string;
  deviceId?: number;
  deviceName?: string;
  collectionPoint?: string;
  collectionFrequency?: number;
  collectionStatus?: string;
  dataQuality?: string;
  lastCollectionTime?: string;
  collectionCount?: number;
  errorCount?: number;
  status?: string;
  remark?: string;
}

export interface DeviceDataCollectionUpdate {
  collectionName?: string;
  deviceId?: number;
  deviceName?: string;
  collectionPoint?: string;
  collectionFrequency?: number;
  collectionStatus?: string;
  dataQuality?: string;
  lastCollectionTime?: string;
  collectionCount?: number;
  errorCount?: number;
  status?: string;
  remark?: string;
}

export interface DeviceDataCollectionListParams {
  skip?: number;
  limit?: number;
  deviceId?: number;
  collectionStatus?: string;
  dataQuality?: string;
}

// ==================== 传感器数据相关 ====================

export interface SensorData {
  id: number;
  uuid: string;
  tenantId?: number;
  sensorNo: string;
  sensorName: string;
  sensorType: string;
  deviceId?: number;
  deviceName?: string;
  collectionFrequency?: number;
  parameterConfig?: any;
  lastCollectionTime?: string;
  collectionStatus: string;
  dataQuality: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SensorDataCreate {
  sensorNo: string;
  sensorName: string;
  sensorType: string;
  deviceId?: number;
  deviceName?: string;
  collectionFrequency?: number;
  parameterConfig?: any;
  lastCollectionTime?: string;
  collectionStatus?: string;
  dataQuality?: string;
  status?: string;
  remark?: string;
}

export interface SensorDataUpdate {
  sensorName?: string;
  sensorType?: string;
  deviceId?: number;
  deviceName?: string;
  collectionFrequency?: number;
  parameterConfig?: any;
  lastCollectionTime?: string;
  collectionStatus?: string;
  dataQuality?: string;
  status?: string;
  remark?: string;
}

export interface SensorDataListParams {
  skip?: number;
  limit?: number;
  sensorType?: string;
  deviceId?: number;
  collectionStatus?: string;
}

// ==================== 实时监控相关 ====================

export interface RealTimeMonitoring {
  id: number;
  uuid: string;
  tenantId?: number;
  monitoringNo: string;
  monitoringName: string;
  monitoringType: string;
  deviceId?: number;
  deviceName?: string;
  monitoringConfig?: any;
  alertRules?: any;
  currentStatus?: string;
  alertStatus: string;
  lastUpdateTime?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RealTimeMonitoringCreate {
  monitoringNo: string;
  monitoringName: string;
  monitoringType: string;
  deviceId?: number;
  deviceName?: string;
  monitoringConfig?: any;
  alertRules?: any;
  currentStatus?: string;
  alertStatus?: string;
  lastUpdateTime?: string;
  status?: string;
  remark?: string;
}

export interface RealTimeMonitoringUpdate {
  monitoringName?: string;
  monitoringType?: string;
  deviceId?: number;
  deviceName?: string;
  monitoringConfig?: any;
  alertRules?: any;
  currentStatus?: string;
  alertStatus?: string;
  lastUpdateTime?: string;
  status?: string;
  remark?: string;
}

export interface RealTimeMonitoringListParams {
  skip?: number;
  limit?: number;
  monitoringType?: string;
  deviceId?: number;
  alertStatus?: string;
}

// ==================== 数据接口相关 ====================

export interface DataInterface {
  id: number;
  uuid: string;
  tenantId?: number;
  interfaceNo: string;
  interfaceName: string;
  interfaceType: string;
  interfaceUrl?: string;
  interfaceMethod?: string;
  requestConfig?: any;
  responseConfig?: any;
  subscriptionConfig?: any;
  performanceMetrics?: any;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DataInterfaceCreate {
  interfaceNo: string;
  interfaceName: string;
  interfaceType: string;
  interfaceUrl?: string;
  interfaceMethod?: string;
  requestConfig?: any;
  responseConfig?: any;
  subscriptionConfig?: any;
  performanceMetrics?: any;
  status?: string;
  remark?: string;
}

export interface DataInterfaceUpdate {
  interfaceName?: string;
  interfaceType?: string;
  interfaceUrl?: string;
  interfaceMethod?: string;
  requestConfig?: any;
  responseConfig?: any;
  subscriptionConfig?: any;
  performanceMetrics?: any;
  status?: string;
  remark?: string;
}

export interface DataInterfaceListParams {
  skip?: number;
  limit?: number;
  interfaceType?: string;
  status?: string;
}

