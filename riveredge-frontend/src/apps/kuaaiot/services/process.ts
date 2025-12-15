/**
 * IOT 数据 API 服务
 * 
 * 提供设备数据采集、传感器数据、实时监控、数据接口等的 API 调用方法
 */

import { api } from '@/services/api';
import type {
  DeviceDataCollection,
  DeviceDataCollectionCreate,
  DeviceDataCollectionUpdate,
  DeviceDataCollectionListParams,
  SensorData,
  SensorDataCreate,
  SensorDataUpdate,
  SensorDataListParams,
  RealTimeMonitoring,
  RealTimeMonitoringCreate,
  RealTimeMonitoringUpdate,
  RealTimeMonitoringListParams,
  DataInterface,
  DataInterfaceCreate,
  DataInterfaceUpdate,
  DataInterfaceListParams,
} from '../types/process';

/**
 * 设备数据采集 API 服务
 */
export const deviceDataCollectionApi = {
  /**
   * 创建设备数据采集
   */
  create: async (data: DeviceDataCollectionCreate): Promise<DeviceDataCollection> => {
    return api.post('/apps/kuaaiot/device-data-collections', data);
  },

  /**
   * 获取设备数据采集列表
   */
  list: async (params?: DeviceDataCollectionListParams): Promise<DeviceDataCollection[]> => {
    return api.get('/apps/kuaaiot/device-data-collections', { params });
  },

  /**
   * 获取设备数据采集详情
   */
  get: async (uuid: string): Promise<DeviceDataCollection> => {
    return api.get(`/apps/kuaaiot/device-data-collections/${uuid}`);
  },

  /**
   * 更新设备数据采集
   */
  update: async (uuid: string, data: DeviceDataCollectionUpdate): Promise<DeviceDataCollection> => {
    return api.put(`/apps/kuaaiot/device-data-collections/${uuid}`, data);
  },

  /**
   * 删除设备数据采集
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaaiot/device-data-collections/${uuid}`);
  },
};

/**
 * 传感器数据 API 服务
 */
export const sensorDataApi = {
  /**
   * 创建传感器数据
   */
  create: async (data: SensorDataCreate): Promise<SensorData> => {
    return api.post('/apps/kuaaiot/sensor-datas', data);
  },

  /**
   * 获取传感器数据列表
   */
  list: async (params?: SensorDataListParams): Promise<SensorData[]> => {
    return api.get('/apps/kuaaiot/sensor-datas', { params });
  },

  /**
   * 获取传感器数据详情
   */
  get: async (uuid: string): Promise<SensorData> => {
    return api.get(`/apps/kuaaiot/sensor-datas/${uuid}`);
  },

  /**
   * 更新传感器数据
   */
  update: async (uuid: string, data: SensorDataUpdate): Promise<SensorData> => {
    return api.put(`/apps/kuaaiot/sensor-datas/${uuid}`, data);
  },

  /**
   * 删除传感器数据
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaaiot/sensor-datas/${uuid}`);
  },
};

/**
 * 实时监控 API 服务
 */
export const realTimeMonitoringApi = {
  /**
   * 创建实时监控
   */
  create: async (data: RealTimeMonitoringCreate): Promise<RealTimeMonitoring> => {
    return api.post('/apps/kuaaiot/real-time-monitorings', data);
  },

  /**
   * 获取实时监控列表
   */
  list: async (params?: RealTimeMonitoringListParams): Promise<RealTimeMonitoring[]> => {
    return api.get('/apps/kuaaiot/real-time-monitorings', { params });
  },

  /**
   * 获取实时监控详情
   */
  get: async (uuid: string): Promise<RealTimeMonitoring> => {
    return api.get(`/apps/kuaaiot/real-time-monitorings/${uuid}`);
  },

  /**
   * 更新实时监控
   */
  update: async (uuid: string, data: RealTimeMonitoringUpdate): Promise<RealTimeMonitoring> => {
    return api.put(`/apps/kuaaiot/real-time-monitorings/${uuid}`, data);
  },

  /**
   * 删除实时监控
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaaiot/real-time-monitorings/${uuid}`);
  },
};

/**
 * 数据接口 API 服务
 */
export const dataInterfaceApi = {
  /**
   * 创建数据接口
   */
  create: async (data: DataInterfaceCreate): Promise<DataInterface> => {
    return api.post('/apps/kuaaiot/data-interfaces', data);
  },

  /**
   * 获取数据接口列表
   */
  list: async (params?: DataInterfaceListParams): Promise<DataInterface[]> => {
    return api.get('/apps/kuaaiot/data-interfaces', { params });
  },

  /**
   * 获取数据接口详情
   */
  get: async (uuid: string): Promise<DataInterface> => {
    return api.get(`/apps/kuaaiot/data-interfaces/${uuid}`);
  },

  /**
   * 更新数据接口
   */
  update: async (uuid: string, data: DataInterfaceUpdate): Promise<DataInterface> => {
    return api.put(`/apps/kuaaiot/data-interfaces/${uuid}`, data);
  },

  /**
   * 删除数据接口
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaaiot/data-interfaces/${uuid}`);
  },
};

