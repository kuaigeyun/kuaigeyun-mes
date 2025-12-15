/**
 * APS 数据 API 服务
 * 
 * 提供产能规划、生产计划、资源调度、计划调整等的 API 调用方法
 */

import { api } from '@/services/api';
import type {
  CapacityPlanning,
  CapacityPlanningCreate,
  CapacityPlanningUpdate,
  CapacityPlanningListParams,
  ProductionPlan,
  ProductionPlanCreate,
  ProductionPlanUpdate,
  ProductionPlanListParams,
  ResourceScheduling,
  ResourceSchedulingCreate,
  ResourceSchedulingUpdate,
  ResourceSchedulingListParams,
  PlanAdjustment,
  PlanAdjustmentCreate,
  PlanAdjustmentUpdate,
  PlanAdjustmentListParams,
} from '../types/process';

/**
 * 产能规划 API 服务
 */
export const capacityPlanningApi = {
  /**
   * 创建产能规划
   */
  create: async (data: CapacityPlanningCreate): Promise<CapacityPlanning> => {
    return api.post('/apps/kuaiaps/capacity-plannings', data);
  },

  /**
   * 获取产能规划列表
   */
  list: async (params?: CapacityPlanningListParams): Promise<CapacityPlanning[]> => {
    return api.get('/apps/kuaiaps/capacity-plannings', { params });
  },

  /**
   * 获取产能规划详情
   */
  get: async (uuid: string): Promise<CapacityPlanning> => {
    return api.get(`/apps/kuaiaps/capacity-plannings/${uuid}`);
  },

  /**
   * 更新产能规划
   */
  update: async (uuid: string, data: CapacityPlanningUpdate): Promise<CapacityPlanning> => {
    return api.put(`/apps/kuaiaps/capacity-plannings/${uuid}`, data);
  },

  /**
   * 删除产能规划
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiaps/capacity-plannings/${uuid}`);
  },
};

/**
 * 生产计划 API 服务
 */
export const productionPlanApi = {
  /**
   * 创建生产计划
   */
  create: async (data: ProductionPlanCreate): Promise<ProductionPlan> => {
    return api.post('/apps/kuaiaps/production-plans', data);
  },

  /**
   * 获取生产计划列表
   */
  list: async (params?: ProductionPlanListParams): Promise<ProductionPlan[]> => {
    return api.get('/apps/kuaiaps/production-plans', { params });
  },

  /**
   * 获取生产计划详情
   */
  get: async (uuid: string): Promise<ProductionPlan> => {
    return api.get(`/apps/kuaiaps/production-plans/${uuid}`);
  },

  /**
   * 更新生产计划
   */
  update: async (uuid: string, data: ProductionPlanUpdate): Promise<ProductionPlan> => {
    return api.put(`/apps/kuaiaps/production-plans/${uuid}`, data);
  },

  /**
   * 删除生产计划
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiaps/production-plans/${uuid}`);
  },
};

/**
 * 资源调度 API 服务
 */
export const resourceSchedulingApi = {
  /**
   * 创建资源调度
   */
  create: async (data: ResourceSchedulingCreate): Promise<ResourceScheduling> => {
    return api.post('/apps/kuaiaps/resource-schedulings', data);
  },

  /**
   * 获取资源调度列表
   */
  list: async (params?: ResourceSchedulingListParams): Promise<ResourceScheduling[]> => {
    return api.get('/apps/kuaiaps/resource-schedulings', { params });
  },

  /**
   * 获取资源调度详情
   */
  get: async (uuid: string): Promise<ResourceScheduling> => {
    return api.get(`/apps/kuaiaps/resource-schedulings/${uuid}`);
  },

  /**
   * 更新资源调度
   */
  update: async (uuid: string, data: ResourceSchedulingUpdate): Promise<ResourceScheduling> => {
    return api.put(`/apps/kuaiaps/resource-schedulings/${uuid}`, data);
  },

  /**
   * 删除资源调度
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiaps/resource-schedulings/${uuid}`);
  },
};

/**
 * 计划调整 API 服务
 */
export const planAdjustmentApi = {
  /**
   * 创建计划调整
   */
  create: async (data: PlanAdjustmentCreate): Promise<PlanAdjustment> => {
    return api.post('/apps/kuaiaps/plan-adjustments', data);
  },

  /**
   * 获取计划调整列表
   */
  list: async (params?: PlanAdjustmentListParams): Promise<PlanAdjustment[]> => {
    return api.get('/apps/kuaiaps/plan-adjustments', { params });
  },

  /**
   * 获取计划调整详情
   */
  get: async (uuid: string): Promise<PlanAdjustment> => {
    return api.get(`/apps/kuaiaps/plan-adjustments/${uuid}`);
  },

  /**
   * 更新计划调整
   */
  update: async (uuid: string, data: PlanAdjustmentUpdate): Promise<PlanAdjustment> => {
    return api.put(`/apps/kuaiaps/plan-adjustments/${uuid}`, data);
  },

  /**
   * 删除计划调整
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiaps/plan-adjustments/${uuid}`);
  },
};

