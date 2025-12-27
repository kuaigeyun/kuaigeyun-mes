/**
 * IOT数据类型定义
 * 
 * 定义数据采集的数据类型
 */

// ==================== 设备数据采集相关 ====================

export interface DeviceDataCollection {
  id: number;
  uuid: string;
  tenantId?: number;
  collectionNo: string;
  deviceId?: number;
  deviceName?: string;
  collectionType: string;
  collectionFrequency?: number;
  collectionParams?: string;
  collectionStatus: string;
  lastCollectionTime?: string;
  collectionCount: number;
  errorCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceDataCollectionCreate {
  collectionNo: string;
  collectionType: string;
  status?: string;
}

export interface DeviceDataCollectionUpdate {
  status?: string;
}

export interface DeviceDataCollectionListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

// ==================== 传感器配置相关 ====================

export interface SensorConfiguration {
  id: number;
  uuid: string;
  tenantId?: number;
  configNo: string;
  sensorId?: number;
  sensorName?: string;
  sensorType: string;
  parameterName: string;
  parameterUnit?: string;
  collectionFrequency?: number;
  dataRangeMin?: number;
  dataRangeMax?: number;
  alarmThresholdMin?: number;
  alarmThresholdMax?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SensorConfigurationCreate {
  configNo: string;
  sensorType: string;
  parameterName: string;
  status?: string;
}

export interface SensorConfigurationUpdate {
  status?: string;
}

export interface SensorConfigurationListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

// ==================== 传感器数据相关 ====================

export interface SensorData {
  id: number;
  uuid: string;
  tenantId?: number;
  dataNo: string;
  sensorId?: number;
  sensorName?: string;
  configId?: number;
  collectionTime: string;
  dataValue: number;
  dataUnit?: string;
  dataQuality: string;
  isAlarm: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SensorDataCreate {
  dataNo: string;
  collectionTime: string;
  dataValue: number;
  status?: string;
}

export interface SensorDataUpdate {
  status?: string;
}

export interface SensorDataListParams {
  skip?: number;
  limit?: number;
  status?: string;
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
  monitoringConfig?: string;
  refreshInterval?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface RealTimeMonitoringCreate {
  monitoringNo: string;
  monitoringName: string;
  monitoringType: string;
  status?: string;
}

export interface RealTimeMonitoringUpdate {
  status?: string;
}

export interface RealTimeMonitoringListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

// ==================== 数据预警相关 ====================

export interface DataAlert {
  id: number;
  uuid: string;
  tenantId?: number;
  alertNo: string;
  alertType: string;
  alertLevel: string;
  sensorId?: number;
  sensorName?: string;
  deviceId?: number;
  deviceName?: string;
  alertContent?: string;
  alertTime: string;
  isHandled: boolean;
  handlerId?: number;
  handlerName?: string;
  handlingTime?: string;
  handlingResult?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DataAlertCreate {
  alertNo: string;
  alertType: string;
  alertLevel: string;
  alertTime: string;
  status?: string;
}

export interface DataAlertUpdate {
  status?: string;
}

export interface DataAlertListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

