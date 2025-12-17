/**
 * CRM 数据 API 服务
 * 
 * 提供线索、商机、订单等的 API 调用方法
 */

import { api } from '@/services/api';
import type {
  Lead,
  LeadCreate,
  LeadUpdate,
  LeadListParams,
  Opportunity,
  OpportunityCreate,
  OpportunityUpdate,
  OpportunityListParams,
  SalesOrder,
  SalesOrderCreate,
  SalesOrderUpdate,
  SalesOrderListParams,
  Quotation,
  QuotationCreate,
  QuotationUpdate,
  QuotationListParams,
  FunnelView,
  FunnelForecast,
  ApprovalStatus,
  LeadFollowUp,
  LeadFollowUpCreate,
  OpportunityFollowUp,
  OpportunityFollowUpCreate,
} from '../types/process';

/**
 * 线索 API 服务
 */
export const leadApi = {
  /**
   * 创建线索
   */
  create: async (data: LeadCreate): Promise<Lead> => {
    return api.post('/apps/kuaicrm/leads', data);
  },

  /**
   * 获取线索列表
   */
  list: async (params?: LeadListParams): Promise<Lead[]> => {
    return api.get('/apps/kuaicrm/leads', { params });
  },

  /**
   * 获取线索详情
   */
  get: async (uuid: string): Promise<Lead> => {
    return api.get(`/apps/kuaicrm/leads/${uuid}`);
  },

  /**
   * 更新线索
   */
  update: async (uuid: string, data: LeadUpdate): Promise<Lead> => {
    return api.put(`/apps/kuaicrm/leads/${uuid}`, data);
  },

  /**
   * 删除线索
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaicrm/leads/${uuid}`);
  },

  /**
   * 线索评分
   */
  score: async (uuid: string): Promise<Lead> => {
    return api.post(`/apps/kuaicrm/leads/${uuid}/score`);
  },

  /**
   * 分配线索
   */
  assign: async (uuid: string, ownerId: number): Promise<Lead> => {
    return api.post(`/apps/kuaicrm/leads/${uuid}/assign`, { ownerId });
  },

  /**
   * 转化线索
   */
  convert: async (uuid: string, opportunityData?: Partial<OpportunityCreate>): Promise<Opportunity> => {
    return api.post(`/apps/kuaicrm/leads/${uuid}/convert`, opportunityData);
  },
};

/**
 * 商机 API 服务
 */
export const opportunityApi = {
  /**
   * 创建商机
   */
  create: async (data: OpportunityCreate): Promise<Opportunity> => {
    return api.post('/apps/kuaicrm/opportunities', data);
  },

  /**
   * 获取商机列表
   */
  list: async (params?: OpportunityListParams): Promise<Opportunity[]> => {
    return api.get('/apps/kuaicrm/opportunities', { params });
  },

  /**
   * 获取商机详情
   */
  get: async (uuid: string): Promise<Opportunity> => {
    return api.get(`/apps/kuaicrm/opportunities/${uuid}`);
  },

  /**
   * 更新商机
   */
  update: async (uuid: string, data: OpportunityUpdate): Promise<Opportunity> => {
    return api.put(`/apps/kuaicrm/opportunities/${uuid}`, data);
  },

  /**
   * 删除商机
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaicrm/opportunities/${uuid}`);
  },

  /**
   * 计算成交概率
   */
  calculateProbability: async (uuid: string): Promise<Opportunity> => {
    return api.post(`/apps/kuaicrm/opportunities/${uuid}/calculate-probability`);
  },

  /**
   * 变更商机阶段
   */
  changeStage: async (uuid: string, stage: string): Promise<Opportunity> => {
    return api.post(`/apps/kuaicrm/opportunities/${uuid}/change-stage`, { stage });
  },

  /**
   * 转化商机
   */
  convert: async (uuid: string, orderData?: Partial<SalesOrderCreate>): Promise<SalesOrder> => {
    return api.post(`/apps/kuaicrm/opportunities/${uuid}/convert`, orderData);
  },
};

/**
 * 销售订单 API 服务
 */
export const salesOrderApi = {
  /**
   * 创建订单
   */
  create: async (data: SalesOrderCreate): Promise<SalesOrder> => {
    return api.post('/apps/kuaicrm/sales-orders', data);
  },

  /**
   * 获取订单列表
   */
  list: async (params?: SalesOrderListParams): Promise<SalesOrder[]> => {
    return api.get('/apps/kuaicrm/sales-orders', { params });
  },

  /**
   * 获取订单详情
   */
  get: async (uuid: string): Promise<SalesOrder> => {
    return api.get(`/apps/kuaicrm/sales-orders/${uuid}`);
  },

  /**
   * 更新订单
   */
  update: async (uuid: string, data: SalesOrderUpdate): Promise<SalesOrder> => {
    return api.put(`/apps/kuaicrm/sales-orders/${uuid}`, data);
  },

  /**
   * 删除订单
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaicrm/sales-orders/${uuid}`);
  },

  /**
   * 订单跟踪
   */
  track: async (uuid: string): Promise<any> => {
    return api.get(`/apps/kuaicrm/sales-orders/${uuid}/tracking`);
  },

  /**
   * 订单变更
   */
  change: async (uuid: string, changeData: any, reason: string): Promise<SalesOrder> => {
    return api.post(`/apps/kuaicrm/sales-orders/${uuid}/change`, { changeData, changeReason: reason });
  },

  /**
   * 订单交付
   */
  deliver: async (uuid: string): Promise<SalesOrder> => {
    return api.post(`/apps/kuaicrm/sales-orders/${uuid}/deliver`);
  },

  /**
   * 提交订单审批
   */
  submitApproval: async (uuid: string, processCode: string): Promise<SalesOrder> => {
    return api.post(`/apps/kuaicrm/sales-orders/${uuid}/submit-approval`, null, {
      params: { process_code: processCode },
    });
  },

  /**
   * 获取订单审批状态
   */
  getApprovalStatus: async (uuid: string): Promise<ApprovalStatus> => {
    return api.get(`/apps/kuaicrm/sales-orders/${uuid}/approval-status`);
  },

  /**
   * 取消订单审批
   */
  cancelApproval: async (uuid: string): Promise<SalesOrder> => {
    return api.post(`/apps/kuaicrm/sales-orders/${uuid}/cancel-approval`);
  },
};

/**
 * 报价单 API 服务
 */
export const quotationApi = {
  /**
   * 创建报价单
   */
  create: async (data: QuotationCreate): Promise<Quotation> => {
    return api.post('/apps/kuaicrm/quotations', data);
  },

  /**
   * 获取报价单列表
   */
  list: async (params?: QuotationListParams): Promise<Quotation[]> => {
    return api.get('/apps/kuaicrm/quotations', { params });
  },

  /**
   * 获取报价单详情
   */
  get: async (uuid: string): Promise<Quotation> => {
    return api.get(`/apps/kuaicrm/quotations/${uuid}`);
  },

  /**
   * 更新报价单
   */
  update: async (uuid: string, data: QuotationUpdate): Promise<Quotation> => {
    return api.put(`/apps/kuaicrm/quotations/${uuid}`, data);
  },

  /**
   * 删除报价单
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaicrm/quotations/${uuid}`);
  },

  /**
   * 将报价单转化为销售订单
   */
  convertToOrder: async (uuid: string, orderData?: Partial<SalesOrderCreate>): Promise<{ quotation: Quotation; order: SalesOrder }> => {
    return api.post(`/apps/kuaicrm/quotations/${uuid}/convert-to-order`, orderData);
  },
};

/**
 * 销售漏斗 API 服务
 */
export const funnelApi = {
  /**
   * 获取漏斗视图
   */
  getView: async (params?: { startDate?: string; endDate?: string }): Promise<FunnelView> => {
    return api.get('/apps/kuaicrm/funnel/view', { params });
  },

  /**
   * 分析阶段数据
   */
  analyzeStage: async (stage: string): Promise<any> => {
    return api.get(`/apps/kuaicrm/funnel/stages/${stage}`);
  },

  /**
   * 计算转化率
   */
  getConversionRate: async (params?: { startDate?: string; endDate?: string }): Promise<any> => {
    return api.get('/apps/kuaicrm/funnel/conversion', { params });
  },

  /**
   * 销售预测
   */
  getForecast: async (params?: { days?: number }): Promise<FunnelForecast> => {
    return api.get('/apps/kuaicrm/funnel/forecast', { params });
  },

  /**
   * 分析瓶颈阶段
   */
  analyzeBottleneck: async (): Promise<any> => {
    return api.get('/apps/kuaicrm/funnel/bottleneck');
  },
};

/**
 * 线索跟进记录 API 服务
 */
export const leadFollowUpApi = {
  /**
   * 创建跟进记录
   */
  create: async (data: LeadFollowUpCreate): Promise<LeadFollowUp> => {
    return api.post('/apps/kuaicrm/lead-followups', data);
  },

  /**
   * 获取跟进记录列表
   */
  list: async (leadId: number, params?: { skip?: number; limit?: number }): Promise<LeadFollowUp[]> => {
    return api.get('/apps/kuaicrm/lead-followups', { params: { leadId, ...params } });
  },

  /**
   * 获取跟进记录详情
   */
  get: async (uuid: string): Promise<LeadFollowUp> => {
    return api.get(`/apps/kuaicrm/lead-followups/${uuid}`);
  },

  /**
   * 更新跟进记录
   */
  update: async (uuid: string, data: Partial<LeadFollowUpCreate>): Promise<LeadFollowUp> => {
    return api.put(`/apps/kuaicrm/lead-followups/${uuid}`, data);
  },

  /**
   * 删除跟进记录
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaicrm/lead-followups/${uuid}`);
  },
};

/**
 * 商机跟进记录 API 服务
 */
export const opportunityFollowUpApi = {
  /**
   * 创建跟进记录
   */
  create: async (data: OpportunityFollowUpCreate): Promise<OpportunityFollowUp> => {
    return api.post('/apps/kuaicrm/opportunity-followups', data);
  },

  /**
   * 获取跟进记录列表
   */
  list: async (opportunityId: number, params?: { skip?: number; limit?: number }): Promise<OpportunityFollowUp[]> => {
    return api.get('/apps/kuaicrm/opportunity-followups', { params: { opportunityId, ...params } });
  },

  /**
   * 获取跟进记录详情
   */
  get: async (uuid: string): Promise<OpportunityFollowUp> => {
    return api.get(`/apps/kuaicrm/opportunity-followups/${uuid}`);
  },

  /**
   * 更新跟进记录
   */
  update: async (uuid: string, data: Partial<OpportunityFollowUpCreate>): Promise<OpportunityFollowUp> => {
    return api.put(`/apps/kuaicrm/opportunity-followups/${uuid}`, data);
  },

  /**
   * 删除跟进记录
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaicrm/opportunity-followups/${uuid}`);
  },
};
