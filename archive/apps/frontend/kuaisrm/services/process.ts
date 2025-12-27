/**
 * SRM 数据 API 服务
 * 
 * 提供采购订单、委外订单、供应商评估、采购合同等的 API 调用方法
 */

import { api } from '../../../services/api';
import type {
  PurchaseOrder,
  PurchaseOrderCreate,
  PurchaseOrderUpdate,
  OutsourcingOrder,
  OutsourcingOrderCreate,
  OutsourcingOrderUpdate,
  SupplierEvaluation,
  SupplierEvaluationCreate,
  SupplierEvaluationUpdate,
  PurchaseContract,
  PurchaseContractCreate,
  PurchaseContractUpdate,
} from '../types/process';

/**
 * 采购订单 API 服务
 */
export const purchaseOrderApi = {
  /**
   * 创建采购订单
   */
  create: async (data: PurchaseOrderCreate): Promise<PurchaseOrder> => {
    return api.post('/apps/kuaisrm/purchase-orders', data);
  },

  /**
   * 获取采购订单列表
   */
  list: async (params?: { skip?: number; limit?: number; status?: string; supplier_id?: number }): Promise<PurchaseOrder[]> => {
    return api.get('/apps/kuaisrm/purchase-orders', { params });
  },

  /**
   * 获取采购订单详情
   */
  get: async (uuid: string): Promise<PurchaseOrder> => {
    return api.get(`/apps/kuaisrm/purchase-orders/${uuid}`);
  },

  /**
   * 更新采购订单
   */
  update: async (uuid: string, data: PurchaseOrderUpdate): Promise<PurchaseOrder> => {
    return api.put(`/apps/kuaisrm/purchase-orders/${uuid}`, data);
  },

  /**
   * 删除采购订单
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaisrm/purchase-orders/${uuid}`);
  },

  /**
   * 提交采购订单审批
   */
  submitApproval: async (uuid: string, processCode: string): Promise<PurchaseOrder> => {
    return api.post(`/apps/kuaisrm/purchase-orders/${uuid}/submit-approval`, null, {
      params: { process_code: processCode },
    });
  },
};

/**
 * 委外订单 API 服务
 */
export const outsourcingOrderApi = {
  /**
   * 创建委外订单
   */
  create: async (data: OutsourcingOrderCreate): Promise<OutsourcingOrder> => {
    return api.post('/apps/kuaisrm/outsourcing-orders', data);
  },

  /**
   * 获取委外订单列表
   */
  list: async (params?: { skip?: number; limit?: number; status?: string; supplier_id?: number }): Promise<OutsourcingOrder[]> => {
    return api.get('/apps/kuaisrm/outsourcing-orders', { params });
  },

  /**
   * 获取委外订单详情
   */
  get: async (uuid: string): Promise<OutsourcingOrder> => {
    return api.get(`/apps/kuaisrm/outsourcing-orders/${uuid}`);
  },

  /**
   * 更新委外订单
   */
  update: async (uuid: string, data: OutsourcingOrderUpdate): Promise<OutsourcingOrder> => {
    return api.put(`/apps/kuaisrm/outsourcing-orders/${uuid}`, data);
  },

  /**
   * 删除委外订单
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaisrm/outsourcing-orders/${uuid}`);
  },

  /**
   * 更新委外订单进度
   */
  updateProgress: async (uuid: string, progress: number): Promise<OutsourcingOrder> => {
    return api.post(`/apps/kuaisrm/outsourcing-orders/${uuid}/update-progress`, null, {
      params: { progress },
    });
  },
};

/**
 * 供应商评估 API 服务
 */
export const supplierEvaluationApi = {
  /**
   * 创建供应商评估
   */
  create: async (data: SupplierEvaluationCreate): Promise<SupplierEvaluation> => {
    return api.post('/apps/kuaisrm/supplier-evaluations', data);
  },

  /**
   * 获取供应商评估列表
   */
  list: async (params?: { skip?: number; limit?: number; supplier_id?: number; evaluation_period?: string }): Promise<SupplierEvaluation[]> => {
    return api.get('/apps/kuaisrm/supplier-evaluations', { params });
  },

  /**
   * 获取供应商评估详情
   */
  get: async (uuid: string): Promise<SupplierEvaluation> => {
    return api.get(`/apps/kuaisrm/supplier-evaluations/${uuid}`);
  },

  /**
   * 更新供应商评估
   */
  update: async (uuid: string, data: SupplierEvaluationUpdate): Promise<SupplierEvaluation> => {
    return api.put(`/apps/kuaisrm/supplier-evaluations/${uuid}`, data);
  },

  /**
   * 删除供应商评估
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaisrm/supplier-evaluations/${uuid}`);
  },
};

/**
 * 采购合同 API 服务
 */
export const purchaseContractApi = {
  /**
   * 创建采购合同
   */
  create: async (data: PurchaseContractCreate): Promise<PurchaseContract> => {
    return api.post('/apps/kuaisrm/purchase-contracts', data);
  },

  /**
   * 获取采购合同列表
   */
  list: async (params?: { skip?: number; limit?: number; status?: string; supplier_id?: number }): Promise<PurchaseContract[]> => {
    return api.get('/apps/kuaisrm/purchase-contracts', { params });
  },

  /**
   * 获取采购合同详情
   */
  get: async (uuid: string): Promise<PurchaseContract> => {
    return api.get(`/apps/kuaisrm/purchase-contracts/${uuid}`);
  },

  /**
   * 更新采购合同
   */
  update: async (uuid: string, data: PurchaseContractUpdate): Promise<PurchaseContract> => {
    return api.put(`/apps/kuaisrm/purchase-contracts/${uuid}`, data);
  },

  /**
   * 删除采购合同
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaisrm/purchase-contracts/${uuid}`);
  },
};
