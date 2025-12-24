/**
 * MRP 数据 API 服务
 * 
 * 提供MRP计划、LRP批次、物料需求、缺料预警等的 API 调用方法
 */

import { api } from '../../../services/api';
import type {
  MRPPlan,
  MRPPlanCreate,
  MRPPlanUpdate,
  LRPBatch,
  LRPBatchCreate,
  LRPBatchUpdate,
  MaterialRequirement,
  MaterialRequirementCreate,
  MaterialRequirementUpdate,
  ShortageAlert,
  ShortageAlertCreate,
  ShortageAlertUpdate,
} from '../types/process';

/**
 * MRP计划 API 服务
 */
export const mrpPlanApi = {
  /**
   * 创建MRP计划
   */
  create: async (data: MRPPlanCreate): Promise<MRPPlan> => {
    return api.post('/apps/kuaimrp/mrp-plans', data);
  },

  /**
   * 获取MRP计划列表
   */
  list: async (params?: { skip?: number; limit?: number; status?: string; plan_type?: string }): Promise<MRPPlan[]> => {
    return api.get('/apps/kuaimrp/mrp-plans', { params });
  },

  /**
   * 获取MRP计划详情
   */
  get: async (uuid: string): Promise<MRPPlan> => {
    return api.get(`/apps/kuaimrp/mrp-plans/${uuid}`);
  },

  /**
   * 更新MRP计划
   */
  update: async (uuid: string, data: MRPPlanUpdate): Promise<MRPPlan> => {
    return api.put(`/apps/kuaimrp/mrp-plans/${uuid}`, data);
  },

  /**
   * 删除MRP计划
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaimrp/mrp-plans/${uuid}`);
  },

  /**
   * 执行MRP计算
   */
  calculate: async (uuid: string): Promise<MRPPlan> => {
    return api.post(`/apps/kuaimrp/mrp-plans/${uuid}/calculate`);
  },
};

/**
 * LRP批次 API 服务
 */
export const lrpBatchApi = {
  /**
   * 创建LRP批次
   */
  create: async (data: LRPBatchCreate): Promise<LRPBatch> => {
    return api.post('/apps/kuaimrp/lrp-batches', data);
  },

  /**
   * 获取LRP批次列表
   */
  list: async (params?: { skip?: number; limit?: number; status?: string }): Promise<LRPBatch[]> => {
    return api.get('/apps/kuaimrp/lrp-batches', { params });
  },

  /**
   * 获取LRP批次详情
   */
  get: async (uuid: string): Promise<LRPBatch> => {
    return api.get(`/apps/kuaimrp/lrp-batches/${uuid}`);
  },

  /**
   * 更新LRP批次
   */
  update: async (uuid: string, data: LRPBatchUpdate): Promise<LRPBatch> => {
    return api.put(`/apps/kuaimrp/lrp-batches/${uuid}`, data);
  },

  /**
   * 删除LRP批次
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaimrp/lrp-batches/${uuid}`);
  },

  /**
   * 执行LRP计算
   */
  calculate: async (uuid: string): Promise<LRPBatch> => {
    return api.post(`/apps/kuaimrp/lrp-batches/${uuid}/calculate`);
  },
};

/**
 * 物料需求 API 服务
 */
export const materialRequirementApi = {
  /**
   * 创建物料需求
   */
  create: async (data: MaterialRequirementCreate): Promise<MaterialRequirement> => {
    return api.post('/apps/kuaimrp/material-requirements', data);
  },

  /**
   * 获取物料需求列表
   */
  list: async (params?: { skip?: number; limit?: number; requirement_type?: string; plan_id?: number; material_id?: number; status?: string }): Promise<MaterialRequirement[]> => {
    return api.get('/apps/kuaimrp/material-requirements', { params });
  },

  /**
   * 获取物料需求详情
   */
  get: async (uuid: string): Promise<MaterialRequirement> => {
    return api.get(`/apps/kuaimrp/material-requirements/${uuid}`);
  },

  /**
   * 更新物料需求
   */
  update: async (uuid: string, data: MaterialRequirementUpdate): Promise<MaterialRequirement> => {
    return api.put(`/apps/kuaimrp/material-requirements/${uuid}`, data);
  },

  /**
   * 删除物料需求
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaimrp/material-requirements/${uuid}`);
  },
};

/**
 * 缺料预警 API 服务
 */
export const shortageAlertApi = {
  /**
   * 创建缺料预警
   */
  create: async (data: ShortageAlertCreate): Promise<ShortageAlert> => {
    return api.post('/apps/kuaimrp/shortage-alerts', data);
  },

  /**
   * 获取缺料预警列表
   */
  list: async (params?: { skip?: number; limit?: number; alert_level?: string; alert_status?: string; material_id?: number }): Promise<ShortageAlert[]> => {
    return api.get('/apps/kuaimrp/shortage-alerts', { params });
  },

  /**
   * 获取缺料预警详情
   */
  get: async (uuid: string): Promise<ShortageAlert> => {
    return api.get(`/apps/kuaimrp/shortage-alerts/${uuid}`);
  },

  /**
   * 更新缺料预警
   */
  update: async (uuid: string, data: ShortageAlertUpdate): Promise<ShortageAlert> => {
    return api.put(`/apps/kuaimrp/shortage-alerts/${uuid}`, data);
  },

  /**
   * 删除缺料预警
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaimrp/shortage-alerts/${uuid}`);
  },

  /**
   * 处理缺料预警
   */
  handle: async (uuid: string, handleResult: string): Promise<ShortageAlert> => {
    return api.post(`/apps/kuaimrp/shortage-alerts/${uuid}/handle`, null, {
      params: { handle_result: handleResult },
    });
  },
};
