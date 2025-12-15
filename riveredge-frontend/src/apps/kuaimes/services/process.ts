/**
 * MES 数据 API 服务
 * 
 * 提供生产订单、工单、生产报工、生产追溯、返修工单等的 API 调用方法
 */

import { api } from '@/services/api';
import type {
  Order,
  OrderCreate,
  OrderUpdate,
  WorkOrder,
  WorkOrderCreate,
  WorkOrderUpdate,
  ProductionReport,
  ProductionReportCreate,
  ProductionReportUpdate,
  Traceability,
  TraceabilityCreate,
  ReworkOrder,
  ReworkOrderCreate,
  ReworkOrderUpdate,
} from '../types/process';

/**
 * 生产订单 API 服务
 */
export const orderApi = {
  /**
   * 创建生产订单
   */
  create: async (data: OrderCreate): Promise<Order> => {
    return api.post('/apps/kuaimes/orders', data);
  },

  /**
   * 获取生产订单列表
   */
  list: async (params?: { skip?: number; limit?: number; status?: string; order_type?: string; product_id?: number }): Promise<Order[]> => {
    return api.get('/apps/kuaimes/orders', { params });
  },

  /**
   * 获取生产订单详情
   */
  get: async (uuid: string): Promise<Order> => {
    return api.get(`/apps/kuaimes/orders/${uuid}`);
  },

  /**
   * 更新生产订单
   */
  update: async (uuid: string, data: OrderUpdate): Promise<Order> => {
    return api.put(`/apps/kuaimes/orders/${uuid}`, data);
  },

  /**
   * 删除生产订单
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaimes/orders/${uuid}`);
  },

  /**
   * 确认生产订单（下发到车间）
   */
  confirm: async (uuid: string): Promise<Order> => {
    return api.post(`/apps/kuaimes/orders/${uuid}/confirm`);
  },
};

/**
 * 工单 API 服务
 */
export const workOrderApi = {
  /**
   * 创建工单
   */
  create: async (data: WorkOrderCreate): Promise<WorkOrder> => {
    return api.post('/apps/kuaimes/work-orders', data);
  },

  /**
   * 获取工单列表
   */
  list: async (params?: { skip?: number; limit?: number; status?: string; order_uuid?: string }): Promise<WorkOrder[]> => {
    return api.get('/apps/kuaimes/work-orders', { params });
  },

  /**
   * 获取工单详情
   */
  get: async (uuid: string): Promise<WorkOrder> => {
    return api.get(`/apps/kuaimes/work-orders/${uuid}`);
  },

  /**
   * 更新工单
   */
  update: async (uuid: string, data: WorkOrderUpdate): Promise<WorkOrder> => {
    return api.put(`/apps/kuaimes/work-orders/${uuid}`, data);
  },

  /**
   * 删除工单
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaimes/work-orders/${uuid}`);
  },
};

/**
 * 生产报工 API 服务
 */
export const productionReportApi = {
  /**
   * 创建生产报工
   */
  create: async (data: ProductionReportCreate): Promise<ProductionReport> => {
    return api.post('/apps/kuaimes/production-reports', data);
  },

  /**
   * 获取生产报工列表
   */
  list: async (params?: { skip?: number; limit?: number; work_order_uuid?: string; status?: string }): Promise<ProductionReport[]> => {
    return api.get('/apps/kuaimes/production-reports', { params });
  },

  /**
   * 获取生产报工详情
   */
  get: async (uuid: string): Promise<ProductionReport> => {
    return api.get(`/apps/kuaimes/production-reports/${uuid}`);
  },

  /**
   * 更新生产报工
   */
  update: async (uuid: string, data: ProductionReportUpdate): Promise<ProductionReport> => {
    return api.put(`/apps/kuaimes/production-reports/${uuid}`, data);
  },

  /**
   * 删除生产报工
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaimes/production-reports/${uuid}`);
  },
};

/**
 * 生产追溯 API 服务
 */
export const traceabilityApi = {
  /**
   * 创建生产追溯
   */
  create: async (data: TraceabilityCreate): Promise<Traceability> => {
    return api.post('/apps/kuaimes/traceabilities', data);
  },

  /**
   * 获取生产追溯列表
   */
  list: async (params?: { skip?: number; limit?: number; batch_no?: string; serial_no?: string }): Promise<Traceability[]> => {
    return api.get('/apps/kuaimes/traceabilities', { params });
  },

  /**
   * 获取生产追溯详情
   */
  get: async (uuid: string): Promise<Traceability> => {
    return api.get(`/apps/kuaimes/traceabilities/${uuid}`);
  },
};

/**
 * 返修工单 API 服务
 */
export const reworkOrderApi = {
  /**
   * 创建返修工单
   */
  create: async (data: ReworkOrderCreate): Promise<ReworkOrder> => {
    return api.post('/apps/kuaimes/rework-orders', data);
  },

  /**
   * 获取返修工单列表
   */
  list: async (params?: { skip?: number; limit?: number; status?: string }): Promise<ReworkOrder[]> => {
    return api.get('/apps/kuaimes/rework-orders', { params });
  },

  /**
   * 获取返修工单详情
   */
  get: async (uuid: string): Promise<ReworkOrder> => {
    return api.get(`/apps/kuaimes/rework-orders/${uuid}`);
  },

  /**
   * 更新返修工单
   */
  update: async (uuid: string, data: ReworkOrderUpdate): Promise<ReworkOrder> => {
    return api.put(`/apps/kuaimes/rework-orders/${uuid}`, data);
  },

  /**
   * 删除返修工单
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaimes/rework-orders/${uuid}`);
  },
};
