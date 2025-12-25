/**
 * IOT数据 API 服务
 * 
 * 提供数据采集的 API 调用方法
 */

import { api } from '../../../services/api';
import type {
  DeviceDataCollection,
  DeviceDataCollectionCreate,
  DeviceDataCollectionUpdate,
  DeviceDataCollectionListParams,
  SensorConfiguration,
  SensorConfigurationCreate,
  SensorConfigurationUpdate,
  SensorConfigurationListParams,
  SensorData,
  SensorDataCreate,
  SensorDataUpdate,
  SensorDataListParams,
  RealTimeMonitoring,
  RealTimeMonitoringCreate,
  RealTimeMonitoringUpdate,
  RealTimeMonitoringListParams,
  DataAlert,
  DataAlertCreate,
  DataAlertUpdate,
  DataAlertListParams,
} from '../types/process';

/**
 * 设备数据采集 API 服务
 */
export const deviceDataCollectionApi = {
  create: async (data: DeviceDataCollectionCreate): Promise<DeviceDataCollection> => {
    return api.post('/kuaiiot/device-data-collections', data);
  },
  list: async (params?: DeviceDataCollectionListParams): Promise<DeviceDataCollection[]> => {
    return api.get('/kuaiiot/device-data-collections', { params });
  },
  get: async (uuid: string): Promise<DeviceDataCollection> => {
    return api.get(`/kuaiiot/device-data-collections/${uuid}`);
  },
  update: async (uuid: string, data: DeviceDataCollectionUpdate): Promise<DeviceDataCollection> => {
    return api.put(`/kuaiiot/device-data-collections/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiiot/device-data-collections/${uuid}`);
  },
};

/**
 * 传感器配置 API 服务
 */
export const sensorConfigurationApi = {
  create: async (data: SensorConfigurationCreate): Promise<SensorConfiguration> => {
    return api.post('/kuaiiot/sensor-configurations', data);
  },
  list: async (params?: SensorConfigurationListParams): Promise<SensorConfiguration[]> => {
    return api.get('/kuaiiot/sensor-configurations', { params });
  },
  get: async (uuid: string): Promise<SensorConfiguration> => {
    return api.get(`/kuaiiot/sensor-configurations/${uuid}`);
  },
  update: async (uuid: string, data: SensorConfigurationUpdate): Promise<SensorConfiguration> => {
    return api.put(`/kuaiiot/sensor-configurations/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiiot/sensor-configurations/${uuid}`);
  },
};

/**
 * 传感器数据 API 服务
 */
export const sensorDataApi = {
  create: async (data: SensorDataCreate): Promise<SensorData> => {
    return api.post('/kuaiiot/sensor-data', data);
  },
  list: async (params?: SensorDataListParams): Promise<SensorData[]> => {
    return api.get('/kuaiiot/sensor-data', { params });
  },
  get: async (uuid: string): Promise<SensorData> => {
    return api.get(`/kuaiiot/sensor-data/${uuid}`);
  },
  update: async (uuid: string, data: SensorDataUpdate): Promise<SensorData> => {
    return api.put(`/kuaiiot/sensor-data/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiiot/sensor-data/${uuid}`);
  },
};

/**
 * 实时监控 API 服务
 */
export const realTimeMonitoringApi = {
  create: async (data: RealTimeMonitoringCreate): Promise<RealTimeMonitoring> => {
    return api.post('/kuaiiot/real-time-monitorings', data);
  },
  list: async (params?: RealTimeMonitoringListParams): Promise<RealTimeMonitoring[]> => {
    return api.get('/kuaiiot/real-time-monitorings', { params });
  },
  get: async (uuid: string): Promise<RealTimeMonitoring> => {
    return api.get(`/kuaiiot/real-time-monitorings/${uuid}`);
  },
  update: async (uuid: string, data: RealTimeMonitoringUpdate): Promise<RealTimeMonitoring> => {
    return api.put(`/kuaiiot/real-time-monitorings/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiiot/real-time-monitorings/${uuid}`);
  },
};

/**
 * 数据预警 API 服务
 */
export const dataAlertApi = {
  create: async (data: DataAlertCreate): Promise<DataAlert> => {
    return api.post('/kuaiiot/data-alerts', data);
  },
  list: async (params?: DataAlertListParams): Promise<DataAlert[]> => {
    return api.get('/kuaiiot/data-alerts', { params });
  },
  get: async (uuid: string): Promise<DataAlert> => {
    return api.get(`/kuaiiot/data-alerts/${uuid}`);
  },
  update: async (uuid: string, data: DataAlertUpdate): Promise<DataAlert> => {
    return api.put(`/kuaiiot/data-alerts/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiiot/data-alerts/${uuid}`);
  },
};

