/**
 * SCM 数据 API 服务
 * 
 * 提供供应链网络、需求预测、供应链风险、全局库存视图等的 API 调用方法
 */

import { api } from '@/services/api';
import type {
  SupplyChainNetwork,
  SupplyChainNetworkCreate,
  SupplyChainNetworkUpdate,
  SupplyChainNetworkListParams,
  DemandForecast,
  DemandForecastCreate,
  DemandForecastUpdate,
  DemandForecastListParams,
  SupplyChainRisk,
  SupplyChainRiskCreate,
  SupplyChainRiskUpdate,
  SupplyChainRiskListParams,
  GlobalInventoryView,
  GlobalInventoryViewCreate,
  GlobalInventoryViewUpdate,
  GlobalInventoryViewListParams,
} from '../types/process';

/**
 * 供应链网络 API 服务
 */
export const supplyChainNetworkApi = {
  /**
   * 创建供应链网络
   */
  create: async (data: SupplyChainNetworkCreate): Promise<SupplyChainNetwork> => {
    return api.post('/apps/kuaiscm/supply-chain-networks', data);
  },

  /**
   * 获取供应链网络列表
   */
  list: async (params?: SupplyChainNetworkListParams): Promise<SupplyChainNetwork[]> => {
    return api.get('/apps/kuaiscm/supply-chain-networks', { params });
  },

  /**
   * 获取供应链网络详情
   */
  get: async (uuid: string): Promise<SupplyChainNetwork> => {
    return api.get(`/apps/kuaiscm/supply-chain-networks/${uuid}`);
  },

  /**
   * 更新供应链网络
   */
  update: async (uuid: string, data: SupplyChainNetworkUpdate): Promise<SupplyChainNetwork> => {
    return api.put(`/apps/kuaiscm/supply-chain-networks/${uuid}`, data);
  },

  /**
   * 删除供应链网络
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiscm/supply-chain-networks/${uuid}`);
  },
};

/**
 * 需求预测 API 服务
 */
export const demandForecastApi = {
  /**
   * 创建需求预测
   */
  create: async (data: DemandForecastCreate): Promise<DemandForecast> => {
    return api.post('/apps/kuaiscm/demand-forecasts', data);
  },

  /**
   * 获取需求预测列表
   */
  list: async (params?: DemandForecastListParams): Promise<DemandForecast[]> => {
    return api.get('/apps/kuaiscm/demand-forecasts', { params });
  },

  /**
   * 获取需求预测详情
   */
  get: async (uuid: string): Promise<DemandForecast> => {
    return api.get(`/apps/kuaiscm/demand-forecasts/${uuid}`);
  },

  /**
   * 更新需求预测
   */
  update: async (uuid: string, data: DemandForecastUpdate): Promise<DemandForecast> => {
    return api.put(`/apps/kuaiscm/demand-forecasts/${uuid}`, data);
  },

  /**
   * 删除需求预测
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiscm/demand-forecasts/${uuid}`);
  },
};

/**
 * 供应链风险 API 服务
 */
export const supplyChainRiskApi = {
  /**
   * 创建供应链风险
   */
  create: async (data: SupplyChainRiskCreate): Promise<SupplyChainRisk> => {
    return api.post('/apps/kuaiscm/supply-chain-risks', data);
  },

  /**
   * 获取供应链风险列表
   */
  list: async (params?: SupplyChainRiskListParams): Promise<SupplyChainRisk[]> => {
    return api.get('/apps/kuaiscm/supply-chain-risks', { params });
  },

  /**
   * 获取供应链风险详情
   */
  get: async (uuid: string): Promise<SupplyChainRisk> => {
    return api.get(`/apps/kuaiscm/supply-chain-risks/${uuid}`);
  },

  /**
   * 更新供应链风险
   */
  update: async (uuid: string, data: SupplyChainRiskUpdate): Promise<SupplyChainRisk> => {
    return api.put(`/apps/kuaiscm/supply-chain-risks/${uuid}`, data);
  },

  /**
   * 删除供应链风险
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiscm/supply-chain-risks/${uuid}`);
  },
};

/**
 * 全局库存视图 API 服务
 */
export const globalInventoryViewApi = {
  /**
   * 创建全局库存视图
   */
  create: async (data: GlobalInventoryViewCreate): Promise<GlobalInventoryView> => {
    return api.post('/apps/kuaiscm/global-inventory-views', data);
  },

  /**
   * 获取全局库存视图列表
   */
  list: async (params?: GlobalInventoryViewListParams): Promise<GlobalInventoryView[]> => {
    return api.get('/apps/kuaiscm/global-inventory-views', { params });
  },

  /**
   * 获取全局库存视图详情
   */
  get: async (uuid: string): Promise<GlobalInventoryView> => {
    return api.get(`/apps/kuaiscm/global-inventory-views/${uuid}`);
  },

  /**
   * 更新全局库存视图
   */
  update: async (uuid: string, data: GlobalInventoryViewUpdate): Promise<GlobalInventoryView> => {
    return api.put(`/apps/kuaiscm/global-inventory-views/${uuid}`, data);
  },

  /**
   * 删除全局库存视图
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiscm/global-inventory-views/${uuid}`);
  },
};

