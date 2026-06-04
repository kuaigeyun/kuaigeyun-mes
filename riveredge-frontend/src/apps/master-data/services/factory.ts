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
  WorkGroup,
  WorkGroupCreate,
  WorkGroupUpdate,
  WorkGroupListParams,
  FactoryPaginatedList,
} from '../types/factory';

/** 列表行数据（兼容旧调用方仍传入数组的情况） */
export function factoryListItems<T>(res: FactoryPaginatedList<T> | T[]): T[] {
  return Array.isArray(res) ? res : (res.items ?? []);
}

/** UniTable 工具栏关键词 → 查询参数 keyword */
export function applyFactoryKeyword(
  apiParams: Record<string, unknown>,
  searchFormValues?: Record<string, unknown>
): void {
  const kw = searchFormValues?.keyword;
  if (kw !== undefined && kw !== null && String(kw).trim() !== '') {
    apiParams.keyword = String(kw).trim();
  }
}

/** ProTable 列排序 → 后端 sort_field / sort_order */
export function applyFactoryTableSort(
  apiParams: Record<string, unknown>,
  sort: Record<string, 'ascend' | 'descend' | null | undefined>
): void {
  const entries = Object.entries(sort || {}).filter(
    ([, order]) => order === 'ascend' || order === 'descend'
  );
  if (entries.length === 0) return;
  const [sortKey, order] = entries[0];
  apiParams.sort_field = sortKey;
  apiParams.sort_order = order === 'descend' ? 'desc' : 'asc';
}

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
  list: async (params?: PlantListParams): Promise<FactoryPaginatedList<Plant>> => {
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
  list: async (params?: WorkshopListParams): Promise<FactoryPaginatedList<Workshop>> => {
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
  list: async (params?: ProductionLineListParams): Promise<FactoryPaginatedList<ProductionLine>> => {
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
  list: async (params?: WorkstationListParams): Promise<FactoryPaginatedList<Workstation>> => {
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

  list: async (params?: WorkCenterListParams): Promise<FactoryPaginatedList<WorkCenter>> => {
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

/**
 * 工作小组 API 服务
 */
export const workGroupApi = {
  create: async (data: WorkGroupCreate): Promise<WorkGroup> => {
    return api.post('/apps/master-data/factory/work-groups', data);
  },

  list: async (params?: WorkGroupListParams): Promise<FactoryPaginatedList<WorkGroup>> => {
    return api.get('/apps/master-data/factory/work-groups', { params });
  },

  get: async (uuid: string): Promise<WorkGroup> => {
    return api.get(`/apps/master-data/factory/work-groups/${uuid}`);
  },

  update: async (uuid: string, data: WorkGroupUpdate): Promise<WorkGroup> => {
    return api.put(`/apps/master-data/factory/work-groups/${uuid}`, data);
  },

  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/factory/work-groups/${uuid}`);
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
    return apiRequest('/apps/master-data/factory/work-groups/batch-delete', {
      method: 'DELETE',
      data: { uuids },
    });
  },
};
