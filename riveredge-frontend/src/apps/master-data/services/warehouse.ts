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
} from '../types/warehouse';

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
  list: async (params?: WarehouseListParams): Promise<Warehouse[]> => {
    return api.get('/apps/master-data/warehouse/warehouses', { params });
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
  list: async (params?: StorageAreaListParams): Promise<StorageArea[]> => {
    return api.get('/apps/master-data/warehouse/storage-areas', { params });
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
  list: async (params?: StorageLocationListParams): Promise<StorageLocation[]> => {
    return api.get('/apps/master-data/warehouse/storage-locations', { params });
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

