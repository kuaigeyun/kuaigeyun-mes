/**
 * TMS 数据 API 服务
 * 
 * 提供运输需求、运输计划、车辆调度、运输执行、运费结算等的 API 调用方法
 */

import { api } from '../../../services/api';
import type {
  TransportDemand,
  TransportDemandCreate,
  TransportDemandUpdate,
  TransportDemandListParams,
  TransportPlan,
  TransportPlanCreate,
  TransportPlanUpdate,
  TransportPlanListParams,
  VehicleDispatch,
  VehicleDispatchCreate,
  VehicleDispatchUpdate,
  VehicleDispatchListParams,
  TransportExecution,
  TransportExecutionCreate,
  TransportExecutionUpdate,
  TransportExecutionListParams,
  FreightSettlement,
  FreightSettlementCreate,
  FreightSettlementUpdate,
  FreightSettlementListParams,
} from '../types/process';

/**
 * 运输需求 API 服务
 */
export const transportDemandApi = {
  /**
   * 创建运输需求
   */
  create: async (data: TransportDemandCreate): Promise<TransportDemand> => {
    return api.post('/apps/kuaitms/transport-demands', data);
  },

  /**
   * 获取运输需求列表
   */
  list: async (params?: TransportDemandListParams): Promise<TransportDemand[]> => {
    return api.get('/apps/kuaitms/transport-demands', { params });
  },

  /**
   * 获取运输需求详情
   */
  get: async (uuid: string): Promise<TransportDemand> => {
    return api.get(`/apps/kuaitms/transport-demands/${uuid}`);
  },

  /**
   * 更新运输需求
   */
  update: async (uuid: string, data: TransportDemandUpdate): Promise<TransportDemand> => {
    return api.put(`/apps/kuaitms/transport-demands/${uuid}`, data);
  },

  /**
   * 删除运输需求
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaitms/transport-demands/${uuid}`);
  },
};

/**
 * 运输计划 API 服务
 */
export const transportPlanApi = {
  /**
   * 创建运输计划
   */
  create: async (data: TransportPlanCreate): Promise<TransportPlan> => {
    return api.post('/apps/kuaitms/transport-plans', data);
  },

  /**
   * 获取运输计划列表
   */
  list: async (params?: TransportPlanListParams): Promise<TransportPlan[]> => {
    return api.get('/apps/kuaitms/transport-plans', { params });
  },

  /**
   * 获取运输计划详情
   */
  get: async (uuid: string): Promise<TransportPlan> => {
    return api.get(`/apps/kuaitms/transport-plans/${uuid}`);
  },

  /**
   * 更新运输计划
   */
  update: async (uuid: string, data: TransportPlanUpdate): Promise<TransportPlan> => {
    return api.put(`/apps/kuaitms/transport-plans/${uuid}`, data);
  },

  /**
   * 删除运输计划
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaitms/transport-plans/${uuid}`);
  },
};

/**
 * 车辆调度 API 服务
 */
export const vehicleDispatchApi = {
  /**
   * 创建车辆调度
   */
  create: async (data: VehicleDispatchCreate): Promise<VehicleDispatch> => {
    return api.post('/apps/kuaitms/vehicle-dispatches', data);
  },

  /**
   * 获取车辆调度列表
   */
  list: async (params?: VehicleDispatchListParams): Promise<VehicleDispatch[]> => {
    return api.get('/apps/kuaitms/vehicle-dispatches', { params });
  },

  /**
   * 获取车辆调度详情
   */
  get: async (uuid: string): Promise<VehicleDispatch> => {
    return api.get(`/apps/kuaitms/vehicle-dispatches/${uuid}`);
  },

  /**
   * 更新车辆调度
   */
  update: async (uuid: string, data: VehicleDispatchUpdate): Promise<VehicleDispatch> => {
    return api.put(`/apps/kuaitms/vehicle-dispatches/${uuid}`, data);
  },

  /**
   * 删除车辆调度
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaitms/vehicle-dispatches/${uuid}`);
  },
};

/**
 * 运输执行 API 服务
 */
export const transportExecutionApi = {
  /**
   * 创建运输执行
   */
  create: async (data: TransportExecutionCreate): Promise<TransportExecution> => {
    return api.post('/apps/kuaitms/transport-executions', data);
  },

  /**
   * 获取运输执行列表
   */
  list: async (params?: TransportExecutionListParams): Promise<TransportExecution[]> => {
    return api.get('/apps/kuaitms/transport-executions', { params });
  },

  /**
   * 获取运输执行详情
   */
  get: async (uuid: string): Promise<TransportExecution> => {
    return api.get(`/apps/kuaitms/transport-executions/${uuid}`);
  },

  /**
   * 更新运输执行
   */
  update: async (uuid: string, data: TransportExecutionUpdate): Promise<TransportExecution> => {
    return api.put(`/apps/kuaitms/transport-executions/${uuid}`, data);
  },

  /**
   * 删除运输执行
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaitms/transport-executions/${uuid}`);
  },
};

/**
 * 运费结算 API 服务
 */
export const freightSettlementApi = {
  /**
   * 创建运费结算
   */
  create: async (data: FreightSettlementCreate): Promise<FreightSettlement> => {
    return api.post('/apps/kuaitms/freight-settlements', data);
  },

  /**
   * 获取运费结算列表
   */
  list: async (params?: FreightSettlementListParams): Promise<FreightSettlement[]> => {
    return api.get('/apps/kuaitms/freight-settlements', { params });
  },

  /**
   * 获取运费结算详情
   */
  get: async (uuid: string): Promise<FreightSettlement> => {
    return api.get(`/apps/kuaitms/freight-settlements/${uuid}`);
  },

  /**
   * 更新运费结算
   */
  update: async (uuid: string, data: FreightSettlementUpdate): Promise<FreightSettlement> => {
    return api.put(`/apps/kuaitms/freight-settlements/${uuid}`, data);
  },

  /**
   * 删除运费结算
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaitms/freight-settlements/${uuid}`);
  },
};

