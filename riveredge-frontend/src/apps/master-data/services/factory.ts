/**
 * 工厂数据 API 服务
 * 
 * 提供车间、产线、工位的 API 调用方法
 */

import { api } from '../../../services/api';
import type {
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
} from '../types/factory';

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
};

