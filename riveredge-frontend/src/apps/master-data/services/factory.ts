/**
 * 工厂数据 API 服务
 * 
 * 提供厂区、车间、产线、工位的 API 调用方法
 */

import { api, apiRequest } from '../../../services/api';
import type {
  Plant,
  PlantCreate,
  PlantUpdate,
  PlantListParams,
  Workshop,
  WorkshopCreate,
  WorkshopUpdate,
  WorkshopListParams,
  ProductionLine,
  ProductionLineCreate,
  ProductionLineUpdate,
  ProductionLineListParams,
  Workstation,
  WorkstationCreate,
  WorkstationUpdate,
  WorkstationListParams,
  WorkCenter,
  WorkCenterCreate,
  WorkCenterUpdate,
  WorkCenterListParams,
} from '../types/factory';

/**
 * 厂区 API 服务
 */
export const plantApi = {
  /**
   * 创建厂区
   */
  create: async (data: PlantCreate): Promise<Plant> => {
    return api.post('/apps/master-data/factory/plants', data);
  },

  /**
   * 获取厂区列表
   */
  list: async (params?: PlantListParams): Promise<Plant[]> => {
    return api.get('/apps/master-data/factory/plants', { params });
  },

  /**
   * 获取厂区详情
   */
  get: async (uuid: string): Promise<Plant> => {
    return api.get(`/apps/master-data/factory/plants/${uuid}`);
  },

  /**
   * 更新厂区
   */
  update: async (uuid: string, data: PlantUpdate): Promise<Plant> => {
    return api.put(`/apps/master-data/factory/plants/${uuid}`, data);
  },

  /**
   * 删除厂区
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/factory/plants/${uuid}`);
  },

  /**
   * 批量删除厂区
   */
  batchDelete: async (uuids: string[]): Promise<{
    success: boolean;
    message: string;
    data: {
      success_count: number;
      failed_count: number;
      success_records: Array<{ uuid: string; code?: string; name?: string }>;
      failed_records: Array<{ uuid: string; code?: string; name?: string; reason: string }>;
    };
  }> => {
    return apiRequest('/apps/master-data/factory/plants/batch-delete', {
      method: 'DELETE',
      data: { uuids },
    });
  },
};

/**
 * 车间 API 服务
 */
export const workshopApi = {
  /**
   * 创建车间
   */
  create: async (data: WorkshopCreate): Promise<Workshop> => {
    return api.post('/apps/master-data/factory/workshops', data);
  },

  /**
   * 获取车间列表
   */
  list: async (params?: WorkshopListParams): Promise<Workshop[]> => {
    return api.get('/apps/master-data/factory/workshops', { params });
  },

  /**
   * 获取车间详情
   */
  get: async (uuid: string): Promise<Workshop> => {
    return api.get(`/apps/master-data/factory/workshops/${uuid}`);
  },

  /**
   * 更新车间
   */
  update: async (uuid: string, data: WorkshopUpdate): Promise<Workshop> => {
    return api.put(`/apps/master-data/factory/workshops/${uuid}`, data);
  },

  /**
   * 删除车间
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/factory/workshops/${uuid}`);
  },

  /**
   * 批量删除车间
   */
  batchDelete: async (uuids: string[]): Promise<{
    success: boolean;
    message: string;
    data: {
      success_count: number;
      failed_count: number;
      success_records: Array<{ uuid: string; code?: string; name?: string }>;
      failed_records: Array<{ uuid: string; code?: string; name?: string; reason: string }>;
    };
  }> => {
    return apiRequest('/apps/master-data/factory/workshops/batch-delete', {
      method: 'DELETE',
      data: { uuids },
    });
  },
};

/**
 * 产线 API 服务
 */
export const productionLineApi = {
  /**
   * 创建产线
   */
  create: async (data: ProductionLineCreate): Promise<ProductionLine> => {
    return api.post('/apps/master-data/factory/production-lines', data);
  },

  /**
   * 获取产线列表
   */
  list: async (params?: ProductionLineListParams): Promise<ProductionLine[]> => {
    return api.get('/apps/master-data/factory/production-lines', { params });
  },

  /**
   * 获取产线详情
   */
  get: async (uuid: string): Promise<ProductionLine> => {
    return api.get(`/apps/master-data/factory/production-lines/${uuid}`);
  },

  /**
   * 更新产线
   */
  update: async (uuid: string, data: ProductionLineUpdate): Promise<ProductionLine> => {
    return api.put(`/apps/master-data/factory/production-lines/${uuid}`, data);
  },

  /**
   * 删除产线
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/factory/production-lines/${uuid}`);
  },

  /**
   * 批量删除产线
   */
  batchDelete: async (uuids: string[]): Promise<{
    success: boolean;
    message: string;
    data: {
      success_count: number;
      failed_count: number;
      success_records: Array<{ uuid: string; code?: string; name?: string }>;
      failed_records: Array<{ uuid: string; code?: string; name?: string; reason: string }>;
    };
  }> => {
    return apiRequest('/apps/master-data/factory/production-lines/batch-delete', {
      method: 'DELETE',
      data: { uuids },
    });
  },
};

/**
 * 工位 API 服务
 */
export const workstationApi = {
  /**
   * 创建工位
   */
  create: async (data: WorkstationCreate): Promise<Workstation> => {
    return api.post('/apps/master-data/factory/workstations', data);
  },

  /**
   * 获取工位列表
   */
  list: async (params?: WorkstationListParams): Promise<Workstation[]> => {
    return api.get('/apps/master-data/factory/workstations', { params });
  },

  /**
   * 获取工位详情
   */
  get: async (uuid: string): Promise<Workstation> => {
    return api.get(`/apps/master-data/factory/workstations/${uuid}`);
  },

  /**
   * 更新工位
   */
  update: async (uuid: string, data: WorkstationUpdate): Promise<Workstation> => {
    return api.put(`/apps/master-data/factory/workstations/${uuid}`, data);
  },

  /**
   * 删除工位
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/factory/workstations/${uuid}`);
  },

  /**
   * 批量删除工位
   */
  batchDelete: async (uuids: string[]): Promise<{
    success: boolean;
    message: string;
    data: {
      success_count: number;
      failed_count: number;
      success_records: Array<{ uuid: string; code?: string; name?: string }>;
      failed_records: Array<{ uuid: string; code?: string; name?: string; reason: string }>;
    };
  }> => {
    return apiRequest('/apps/master-data/factory/workstations/batch-delete', {
      method: 'DELETE',
      data: { uuids },
    });
  },
};

/**
 * 工作中心 API 服务
 */
export const workCenterApi = {
  create: async (data: WorkCenterCreate): Promise<WorkCenter> => {
    return api.post('/apps/master-data/factory/work-centers', data);
  },

  list: async (params?: WorkCenterListParams): Promise<WorkCenter[]> => {
    return api.get('/apps/master-data/factory/work-centers', { params });
  },

  get: async (uuid: string): Promise<WorkCenter> => {
    return api.get(`/apps/master-data/factory/work-centers/${uuid}`);
  },

  update: async (uuid: string, data: WorkCenterUpdate): Promise<WorkCenter> => {
    return api.put(`/apps/master-data/factory/work-centers/${uuid}`, data);
  },

  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/factory/work-centers/${uuid}`);
  },

  batchDelete: async (uuids: string[]): Promise<{
    success: boolean;
    message: string;
    data: {
      success_count: number;
      failed_count: number;
      success_records: Array<{ uuid: string; code?: string; name?: string }>;
      failed_records: Array<{ uuid: string; code?: string; name?: string; reason: string }>;
    };
  }> => {
    return apiRequest('/apps/master-data/factory/work-centers/batch-delete', {
      method: 'DELETE',
      data: { uuids },
    });
  },
};

