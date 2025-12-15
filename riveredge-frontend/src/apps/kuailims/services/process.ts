/**
 * LIMS 数据 API 服务
 * 
 * 提供样品管理、实验管理、数据管理、报告管理等的 API 调用方法
 */

import { api } from '@/services/api';
import type {
  SampleManagement,
  SampleManagementCreate,
  SampleManagementUpdate,
  SampleManagementListParams,
  ExperimentManagement,
  ExperimentManagementCreate,
  ExperimentManagementUpdate,
  ExperimentManagementListParams,
  DataManagement,
  DataManagementCreate,
  DataManagementUpdate,
  DataManagementListParams,
  ReportManagement,
  ReportManagementCreate,
  ReportManagementUpdate,
  ReportManagementListParams,
} from '../types/process';

/**
 * 样品管理 API 服务
 */
export const sampleManagementApi = {
  /**
   * 创建样品管理
   */
  create: async (data: SampleManagementCreate): Promise<SampleManagement> => {
    return api.post('/apps/kuailims/sample-managements', data);
  },

  /**
   * 获取样品管理列表
   */
  list: async (params?: SampleManagementListParams): Promise<SampleManagement[]> => {
    return api.get('/apps/kuailims/sample-managements', { params });
  },

  /**
   * 获取样品管理详情
   */
  get: async (uuid: string): Promise<SampleManagement> => {
    return api.get(`/apps/kuailims/sample-managements/${uuid}`);
  },

  /**
   * 更新样品管理
   */
  update: async (uuid: string, data: SampleManagementUpdate): Promise<SampleManagement> => {
    return api.put(`/apps/kuailims/sample-managements/${uuid}`, data);
  },

  /**
   * 删除样品管理
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuailims/sample-managements/${uuid}`);
  },
};

/**
 * 实验管理 API 服务
 */
export const experimentManagementApi = {
  /**
   * 创建实验管理
   */
  create: async (data: ExperimentManagementCreate): Promise<ExperimentManagement> => {
    return api.post('/apps/kuailims/experiment-managements', data);
  },

  /**
   * 获取实验管理列表
   */
  list: async (params?: ExperimentManagementListParams): Promise<ExperimentManagement[]> => {
    return api.get('/apps/kuailims/experiment-managements', { params });
  },

  /**
   * 获取实验管理详情
   */
  get: async (uuid: string): Promise<ExperimentManagement> => {
    return api.get(`/apps/kuailims/experiment-managements/${uuid}`);
  },

  /**
   * 更新实验管理
   */
  update: async (uuid: string, data: ExperimentManagementUpdate): Promise<ExperimentManagement> => {
    return api.put(`/apps/kuailims/experiment-managements/${uuid}`, data);
  },

  /**
   * 删除实验管理
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuailims/experiment-managements/${uuid}`);
  },
};

/**
 * 数据管理 API 服务
 */
export const dataManagementApi = {
  /**
   * 创建数据管理
   */
  create: async (data: DataManagementCreate): Promise<DataManagement> => {
    return api.post('/apps/kuailims/data-managements', data);
  },

  /**
   * 获取数据管理列表
   */
  list: async (params?: DataManagementListParams): Promise<DataManagement[]> => {
    return api.get('/apps/kuailims/data-managements', { params });
  },

  /**
   * 获取数据管理详情
   */
  get: async (uuid: string): Promise<DataManagement> => {
    return api.get(`/apps/kuailims/data-managements/${uuid}`);
  },

  /**
   * 更新数据管理
   */
  update: async (uuid: string, data: DataManagementUpdate): Promise<DataManagement> => {
    return api.put(`/apps/kuailims/data-managements/${uuid}`, data);
  },

  /**
   * 删除数据管理
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuailims/data-managements/${uuid}`);
  },
};

/**
 * 报告管理 API 服务
 */
export const reportManagementApi = {
  /**
   * 创建报告管理
   */
  create: async (data: ReportManagementCreate): Promise<ReportManagement> => {
    return api.post('/apps/kuailims/report-managements', data);
  },

  /**
   * 获取报告管理列表
   */
  list: async (params?: ReportManagementListParams): Promise<ReportManagement[]> => {
    return api.get('/apps/kuailims/report-managements', { params });
  },

  /**
   * 获取报告管理详情
   */
  get: async (uuid: string): Promise<ReportManagement> => {
    return api.get(`/apps/kuailims/report-managements/${uuid}`);
  },

  /**
   * 更新报告管理
   */
  update: async (uuid: string, data: ReportManagementUpdate): Promise<ReportManagement> => {
    return api.put(`/apps/kuailims/report-managements/${uuid}`, data);
  },

  /**
   * 删除报告管理
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuailims/report-managements/${uuid}`);
  },
};

