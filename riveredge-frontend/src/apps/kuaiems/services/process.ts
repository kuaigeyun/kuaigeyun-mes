/**
 * EMS 数据 API 服务
 * 
 * 提供能源监测、能耗分析、节能管理、能源报表等的 API 调用方法
 */

import { api } from '../../../services/api';
import type {
  EnergyMonitoring,
  EnergyMonitoringCreate,
  EnergyMonitoringUpdate,
  EnergyMonitoringListParams,
  EnergyConsumptionAnalysis,
  EnergyConsumptionAnalysisCreate,
  EnergyConsumptionAnalysisUpdate,
  EnergyConsumptionAnalysisListParams,
  EnergySavingManagement,
  EnergySavingManagementCreate,
  EnergySavingManagementUpdate,
  EnergySavingManagementListParams,
  EnergyReport,
  EnergyReportCreate,
  EnergyReportUpdate,
  EnergyReportListParams,
} from '../types/process';

/**
 * 能源监测 API 服务
 */
export const energyMonitoringApi = {
  /**
   * 创建能源监测
   */
  create: async (data: EnergyMonitoringCreate): Promise<EnergyMonitoring> => {
    return api.post('/apps/kuaiems/energy-monitorings', data);
  },

  /**
   * 获取能源监测列表
   */
  list: async (params?: EnergyMonitoringListParams): Promise<EnergyMonitoring[]> => {
    return api.get('/apps/kuaiems/energy-monitorings', { params });
  },

  /**
   * 获取能源监测详情
   */
  get: async (uuid: string): Promise<EnergyMonitoring> => {
    return api.get(`/apps/kuaiems/energy-monitorings/${uuid}`);
  },

  /**
   * 更新能源监测
   */
  update: async (uuid: string, data: EnergyMonitoringUpdate): Promise<EnergyMonitoring> => {
    return api.put(`/apps/kuaiems/energy-monitorings/${uuid}`, data);
  },

  /**
   * 删除能源监测
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiems/energy-monitorings/${uuid}`);
  },
};

/**
 * 能耗分析 API 服务
 */
export const energyConsumptionAnalysisApi = {
  /**
   * 创建能耗分析
   */
  create: async (data: EnergyConsumptionAnalysisCreate): Promise<EnergyConsumptionAnalysis> => {
    return api.post('/apps/kuaiems/energy-consumption-analyses', data);
  },

  /**
   * 获取能耗分析列表
   */
  list: async (params?: EnergyConsumptionAnalysisListParams): Promise<EnergyConsumptionAnalysis[]> => {
    return api.get('/apps/kuaiems/energy-consumption-analyses', { params });
  },

  /**
   * 获取能耗分析详情
   */
  get: async (uuid: string): Promise<EnergyConsumptionAnalysis> => {
    return api.get(`/apps/kuaiems/energy-consumption-analyses/${uuid}`);
  },

  /**
   * 更新能耗分析
   */
  update: async (uuid: string, data: EnergyConsumptionAnalysisUpdate): Promise<EnergyConsumptionAnalysis> => {
    return api.put(`/apps/kuaiems/energy-consumption-analyses/${uuid}`, data);
  },

  /**
   * 删除能耗分析
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiems/energy-consumption-analyses/${uuid}`);
  },
};

/**
 * 节能管理 API 服务
 */
export const energySavingManagementApi = {
  /**
   * 创建节能管理
   */
  create: async (data: EnergySavingManagementCreate): Promise<EnergySavingManagement> => {
    return api.post('/apps/kuaiems/energy-saving-managements', data);
  },

  /**
   * 获取节能管理列表
   */
  list: async (params?: EnergySavingManagementListParams): Promise<EnergySavingManagement[]> => {
    return api.get('/apps/kuaiems/energy-saving-managements', { params });
  },

  /**
   * 获取节能管理详情
   */
  get: async (uuid: string): Promise<EnergySavingManagement> => {
    return api.get(`/apps/kuaiems/energy-saving-managements/${uuid}`);
  },

  /**
   * 更新节能管理
   */
  update: async (uuid: string, data: EnergySavingManagementUpdate): Promise<EnergySavingManagement> => {
    return api.put(`/apps/kuaiems/energy-saving-managements/${uuid}`, data);
  },

  /**
   * 删除节能管理
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiems/energy-saving-managements/${uuid}`);
  },
};

/**
 * 能源报表 API 服务
 */
export const energyReportApi = {
  /**
   * 创建能源报表
   */
  create: async (data: EnergyReportCreate): Promise<EnergyReport> => {
    return api.post('/apps/kuaiems/energy-reports', data);
  },

  /**
   * 获取能源报表列表
   */
  list: async (params?: EnergyReportListParams): Promise<EnergyReport[]> => {
    return api.get('/apps/kuaiems/energy-reports', { params });
  },

  /**
   * 获取能源报表详情
   */
  get: async (uuid: string): Promise<EnergyReport> => {
    return api.get(`/apps/kuaiems/energy-reports/${uuid}`);
  },

  /**
   * 更新能源报表
   */
  update: async (uuid: string, data: EnergyReportUpdate): Promise<EnergyReport> => {
    return api.put(`/apps/kuaiems/energy-reports/${uuid}`, data);
  },

  /**
   * 删除能源报表
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiems/energy-reports/${uuid}`);
  },
};

