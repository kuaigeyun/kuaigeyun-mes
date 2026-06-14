/**
 * 仓库数据 API 服务
 * 
 * 提供仓库、库区、库位的 API 调用方法
 */

import { api, apiRequest } from '../../../services/api';
import type {
  Warehouse,
  WarehouseCreate,
  WarehouseUpdate,
  WarehouseListParams,
  StorageArea,
  StorageAreaCreate,
  StorageAreaUpdate,
  StorageAreaListParams,
  StorageLocation,
  StorageLocationCreate,
  StorageLocationUpdate,
  StorageLocationListParams,
  WarehouseListResponse,
  StorageAreaListResponse,
  StorageLocationListResponse,
} from '../types/warehouse';

const MASTER_DATA_API_LIMIT_MAX = 1000;

function clampMasterDataLimit<T extends { limit?: number } | undefined>(params: T): T {
  if (!params || params.limit == null) return params;
  const n = Number(params.limit);
  const safe = Number.isFinite(n) ? Math.max(1, Math.min(MASTER_DATA_API_LIMIT_MAX, n)) : MASTER_DATA_API_LIMIT_MAX;
  return { ...params, limit: safe } as T;
}

/**
 * 仓库 API 服务
 */
export const warehouseApi = {
  /**
   * 创建仓库
   */
  create: async (data: WarehouseCreate): Promise<Warehouse> => {
    return api.post('/apps/master-data/warehouse/warehouses', data);
  },

  /**
   * 获取仓库列表
   */
  list: async (params?: WarehouseListParams): Promise<WarehouseListResponse> => {
    return api.get('/apps/master-data/warehouse/warehouses', {
      params: clampMasterDataLimit(params),
    });
  },

  /**
   * 获取仓库详情
   */
  get: async (uuid: string): Promise<Warehouse> => {
    return api.get(`/apps/master-data/warehouse/warehouses/${uuid}`);
  },

  /**
   * 更新仓库
   */
  update: async (uuid: string, data: WarehouseUpdate): Promise<Warehouse> => {
    return api.put(`/apps/master-data/warehouse/warehouses/${uuid}`, data);
  },

  /**
   * 删除仓库
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/warehouse/warehouses/${uuid}`);
  },

  /**
   * 获取仓库预设列表（用于预览与勾选）
   */
  getPresetPreview: async (): Promise<PresetWarehouseItem[]> => {
    return api.get('/apps/master-data/warehouse/warehouses/preset-preview');
  },

  /**
   * 加载仓库预设（可仅创建选中的 names）
   */
  loadPreset: async (names?: string[]): Promise<{ created: number; message: string }> => {
    return api.post(
      '/apps/master-data/warehouse/warehouses/load-preset',
      names != null ? { names } : undefined
    );
  },

  /**
   * 同步线边仓：根据车间/工位/工作中心自动建立线边仓
   */
  syncLineSide: async (): Promise<{ created: number; skipped?: number; message: string }> => {
    return apiRequest<{ created: number; skipped?: number; message: string }>(
      '/apps/master-data/warehouse/warehouses/sync-line-side',
      { method: 'POST' }
    );
  },

  /**
   * 批量删除仓库
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
    return apiRequest('/apps/master-data/warehouse/warehouses/batch-delete', {
      method: 'DELETE',
      data: { uuids },
    });
  },
};

/**
 * 库区 API 服务
 */
export const storageAreaApi = {
  /**
   * 创建库区
   */
  create: async (data: StorageAreaCreate): Promise<StorageArea> => {
    return api.post('/apps/master-data/warehouse/storage-areas', data);
  },

  /**
   * 获取库区列表
   */
  list: async (params?: StorageAreaListParams): Promise<StorageAreaListResponse> => {
    return api.get('/apps/master-data/warehouse/storage-areas', {
      params: clampMasterDataLimit(params),
    });
  },

  /**
   * 获取库区详情
   */
  get: async (uuid: string): Promise<StorageArea> => {
    return api.get(`/apps/master-data/warehouse/storage-areas/${uuid}`);
  },

  /**
   * 更新库区
   */
  update: async (uuid: string, data: StorageAreaUpdate): Promise<StorageArea> => {
    return api.put(`/apps/master-data/warehouse/storage-areas/${uuid}`, data);
  },

  /**
   * 删除库区
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/warehouse/storage-areas/${uuid}`);
  },

  /**
   * 批量删除库区
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
    return apiRequest('/apps/master-data/warehouse/storage-areas/batch-delete', {
      method: 'DELETE',
      data: { uuids },
    });
  },
};

/**
 * 库位 API 服务
 */
export const storageLocationApi = {
  /**
   * 创建库位
   */
  create: async (data: StorageLocationCreate): Promise<StorageLocation> => {
    return api.post('/apps/master-data/warehouse/storage-locations', data);
  },

  /**
   * 获取库位列表
   */
  list: async (params?: StorageLocationListParams): Promise<StorageLocationListResponse> => {
    return api.get('/apps/master-data/warehouse/storage-locations', {
      params: clampMasterDataLimit(params),
    });
  },

  /**
   * 获取库位详情
   */
  get: async (uuid: string): Promise<StorageLocation> => {
    return api.get(`/apps/master-data/warehouse/storage-locations/${uuid}`);
  },

  /**
   * 更新库位
   */
  update: async (uuid: string, data: StorageLocationUpdate): Promise<StorageLocation> => {
    return api.put(`/apps/master-data/warehouse/storage-locations/${uuid}`, data);
  },

  /**
   * 删除库位
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/warehouse/storage-locations/${uuid}`);
  },

  /**
   * 批量删除库位
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
    return apiRequest('/apps/master-data/warehouse/storage-locations/batch-delete', {
      method: 'DELETE',
      data: { uuids },
    });
  },
};

/** 仓库预设项（与后端 PRESET_WAREHOUSES 结构一致） */
export interface PresetWarehouseItem {
  name: string;
  description?: string;
  warehouse_type?: string;
}

