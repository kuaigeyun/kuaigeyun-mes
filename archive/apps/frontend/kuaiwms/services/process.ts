/**
 * WMS 数据 API 服务
 * 
 * 提供库存、入库单、出库单、盘点单、库存调整等的 API 调用方法
 */

import { api } from '../../../services/api';
import type {
  Inventory,
  InboundOrder,
  InboundOrderCreate,
  InboundOrderUpdate,
  OutboundOrder,
  OutboundOrderCreate,
  OutboundOrderUpdate,
  Stocktake,
  StocktakeCreate,
  StocktakeUpdate,
  InventoryAdjustment,
  InventoryAdjustmentCreate,
  InventoryAdjustmentUpdate,
} from '../types/process';

/**
 * 库存 API 服务
 */
export const inventoryApi = {
  /**
   * 获取库存列表
   */
  list: async (params?: { skip?: number; limit?: number; material_id?: number; warehouse_id?: number; location_id?: number }): Promise<Inventory[]> => {
    return api.get('/apps/kuaiwms/inventories', { params });
  },

  /**
   * 获取库存详情
   */
  get: async (uuid: string): Promise<Inventory> => {
    return api.get(`/apps/kuaiwms/inventories/${uuid}`);
  },
};

/**
 * 入库单 API 服务
 */
export const inboundOrderApi = {
  /**
   * 创建入库单
   */
  create: async (data: InboundOrderCreate): Promise<InboundOrder> => {
    return api.post('/apps/kuaiwms/inbound-orders', data);
  },

  /**
   * 获取入库单列表
   */
  list: async (params?: { skip?: number; limit?: number; status?: string; order_type?: string; warehouse_id?: number }): Promise<InboundOrder[]> => {
    return api.get('/apps/kuaiwms/inbound-orders', { params });
  },

  /**
   * 获取入库单详情
   */
  get: async (uuid: string): Promise<InboundOrder> => {
    return api.get(`/apps/kuaiwms/inbound-orders/${uuid}`);
  },

  /**
   * 更新入库单
   */
  update: async (uuid: string, data: InboundOrderUpdate): Promise<InboundOrder> => {
    return api.put(`/apps/kuaiwms/inbound-orders/${uuid}`, data);
  },

  /**
   * 删除入库单
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiwms/inbound-orders/${uuid}`);
  },

  /**
   * 确认入库
   */
  confirm: async (uuid: string): Promise<InboundOrder> => {
    return api.post(`/apps/kuaiwms/inbound-orders/${uuid}/confirm`);
  },
};

/**
 * 出库单 API 服务
 */
export const outboundOrderApi = {
  /**
   * 创建出库单
   */
  create: async (data: OutboundOrderCreate): Promise<OutboundOrder> => {
    return api.post('/apps/kuaiwms/outbound-orders', data);
  },

  /**
   * 获取出库单列表
   */
  list: async (params?: { skip?: number; limit?: number; status?: string; order_type?: string; warehouse_id?: number }): Promise<OutboundOrder[]> => {
    return api.get('/apps/kuaiwms/outbound-orders', { params });
  },

  /**
   * 获取出库单详情
   */
  get: async (uuid: string): Promise<OutboundOrder> => {
    return api.get(`/apps/kuaiwms/outbound-orders/${uuid}`);
  },

  /**
   * 更新出库单
   */
  update: async (uuid: string, data: OutboundOrderUpdate): Promise<OutboundOrder> => {
    return api.put(`/apps/kuaiwms/outbound-orders/${uuid}`, data);
  },

  /**
   * 删除出库单
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiwms/outbound-orders/${uuid}`);
  },

  /**
   * 确认出库
   */
  confirm: async (uuid: string): Promise<OutboundOrder> => {
    return api.post(`/apps/kuaiwms/outbound-orders/${uuid}/confirm`);
  },
};

/**
 * 盘点单 API 服务
 */
export const stocktakeApi = {
  /**
   * 创建盘点单
   */
  create: async (data: StocktakeCreate): Promise<Stocktake> => {
    return api.post('/apps/kuaiwms/stocktakes', data);
  },

  /**
   * 获取盘点单列表
   */
  list: async (params?: { skip?: number; limit?: number; status?: string; warehouse_id?: number }): Promise<Stocktake[]> => {
    return api.get('/apps/kuaiwms/stocktakes', { params });
  },

  /**
   * 获取盘点单详情
   */
  get: async (uuid: string): Promise<Stocktake> => {
    return api.get(`/apps/kuaiwms/stocktakes/${uuid}`);
  },

  /**
   * 更新盘点单
   */
  update: async (uuid: string, data: StocktakeUpdate): Promise<Stocktake> => {
    return api.put(`/apps/kuaiwms/stocktakes/${uuid}`, data);
  },

  /**
   * 删除盘点单
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiwms/stocktakes/${uuid}`);
  },

  /**
   * 完成盘点
   */
  complete: async (uuid: string): Promise<Stocktake> => {
    return api.post(`/apps/kuaiwms/stocktakes/${uuid}/complete`);
  },
};

/**
 * 库存调整 API 服务
 */
export const inventoryAdjustmentApi = {
  /**
   * 创建库存调整
   */
  create: async (data: InventoryAdjustmentCreate): Promise<InventoryAdjustment> => {
    return api.post('/apps/kuaiwms/inventory-adjustments', data);
  },

  /**
   * 获取库存调整列表
   */
  list: async (params?: { skip?: number; limit?: number; status?: string; warehouse_id?: number }): Promise<InventoryAdjustment[]> => {
    return api.get('/apps/kuaiwms/inventory-adjustments', { params });
  },

  /**
   * 获取库存调整详情
   */
  get: async (uuid: string): Promise<InventoryAdjustment> => {
    return api.get(`/apps/kuaiwms/inventory-adjustments/${uuid}`);
  },

  /**
   * 更新库存调整
   */
  update: async (uuid: string, data: InventoryAdjustmentUpdate): Promise<InventoryAdjustment> => {
    return api.put(`/apps/kuaiwms/inventory-adjustments/${uuid}`, data);
  },

  /**
   * 删除库存调整
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiwms/inventory-adjustments/${uuid}`);
  },

  /**
   * 提交库存调整审批
   */
  submitApproval: async (uuid: string, processCode: string): Promise<InventoryAdjustment> => {
    return api.post(`/apps/kuaiwms/inventory-adjustments/${uuid}/submit-approval`, null, {
      params: { process_code: processCode },
    });
  },
};
