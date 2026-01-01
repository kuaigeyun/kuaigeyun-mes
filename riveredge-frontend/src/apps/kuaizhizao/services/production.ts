/**
 * 生产执行相关服务
 */

import { apiRequest } from '../../../services/api';

// 工单相关接口
export const workOrderApi = {
  // 获取工单列表
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/work-orders', { method: 'GET', params });
  },

  // 创建工单
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/work-orders', { method: 'POST', data });
  },

  // 更新工单
  update: async (id: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/work-orders/${id}`, { method: 'PUT', data });
  },

  // 删除工单
  delete: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/work-orders/${id}`, { method: 'DELETE' });
  },

  // 获取工单详情
  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/work-orders/${id}`, { method: 'GET' });
  },

  // 下达工单
  release: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/work-orders/${id}/release`, { method: 'POST' });
  },
};

// 报工相关接口
export const reportingApi = {
  // 获取报工记录列表
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/reporting', { method: 'GET', params });
  },

  // 提交报工
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/reporting', { method: 'POST', data });
  },

  // 更新报工记录
  update: async (id: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/reporting/${id}`, { method: 'PUT', data });
  },

  // 删除报工记录
  delete: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/reporting/${id}`, { method: 'DELETE' });
  },

  // 获取报工详情
  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/reporting/${id}`, { method: 'GET' });
  },

  // 审核报工记录
  approve: async (id: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/reporting/${id}/approve`, { method: 'POST', data });
  },

  // 驳回报工记录
  reject: async (id: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/reporting/${id}/reject`, { method: 'POST', data });
  },

  // 获取报工统计
  getStatistics: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/reporting/statistics', { method: 'GET', params });
  },
};

// 仓储管理相关接口
export const warehouseApi = {
  // 生产领料单
  productionPicking: {
    list: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/production-pickings', { method: 'GET', params });
    },
    create: async (data: any) => {
      return apiRequest('/apps/kuaizhizao/production-pickings', { method: 'POST', data });
    },
    update: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/production-pickings/${id}`, { method: 'PUT', data });
    },
    delete: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/production-pickings/${id}`, { method: 'DELETE' });
    },
    get: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/production-pickings/${id}`, { method: 'GET' });
    },
    confirm: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/production-pickings/${id}/confirm`, { method: 'POST' });
    },
  },

  // 成品入库单
  finishedGoodsReceipt: {
    list: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/finished-goods-receipts', { method: 'GET', params });
    },
    create: async (data: any) => {
      return apiRequest('/apps/kuaizhizao/finished-goods-receipts', { method: 'POST', data });
    },
    update: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/finished-goods-receipts/${id}`, { method: 'PUT', data });
    },
    delete: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/finished-goods-receipts/${id}`, { method: 'DELETE' });
    },
    get: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/finished-goods-receipts/${id}`, { method: 'GET' });
    },
    confirm: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/finished-goods-receipts/${id}/confirm`, { method: 'POST' });
    },
  },

  // 销售出库单
  salesDelivery: {
    list: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/sales-deliveries', { method: 'GET', params });
    },
    create: async (data: any) => {
      return apiRequest('/apps/kuaizhizao/sales-deliveries', { method: 'POST', data });
    },
    update: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/sales-deliveries/${id}`, { method: 'PUT', data });
    },
    delete: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/sales-deliveries/${id}`, { method: 'DELETE' });
    },
    get: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/sales-deliveries/${id}`, { method: 'GET' });
    },
    confirm: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/sales-deliveries/${id}/confirm`, { method: 'POST' });
    },
  },

  // 采购入库单
  purchaseReceipt: {
    list: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/purchase-receipts', { method: 'GET', params });
    },
    create: async (data: any) => {
      return apiRequest('/apps/kuaizhizao/purchase-receipts', { method: 'POST', data });
    },
    update: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/purchase-receipts/${id}`, { method: 'PUT', data });
    },
    delete: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/purchase-receipts/${id}`, { method: 'DELETE' });
    },
    get: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/purchase-receipts/${id}`, { method: 'GET' });
    },
    confirm: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/purchase-receipts/${id}/confirm`, { method: 'POST' });
    },
  },
};

// 质量管理相关接口
export const qualityApi = {
  // 来料检验
  incomingInspection: {
    list: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/incoming-inspections', { method: 'GET', params });
    },
    create: async (data: any) => {
      return apiRequest('/apps/kuaizhizao/incoming-inspections', { method: 'POST', data });
    },
    update: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/incoming-inspections/${id}`, { method: 'PUT', data });
    },
    delete: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/incoming-inspections/${id}`, { method: 'DELETE' });
    },
    get: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/incoming-inspections/${id}`, { method: 'GET' });
    },
    conduct: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/incoming-inspections/${id}/conduct`, { method: 'POST', data });
    },
    approve: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/incoming-inspections/${id}/approve`, { method: 'POST', data });
    },
  },

  // 过程检验
  processInspection: {
    list: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/process-inspections', { method: 'GET', params });
    },
    create: async (data: any) => {
      return apiRequest('/apps/kuaizhizao/process-inspections', { method: 'POST', data });
    },
    update: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/process-inspections/${id}`, { method: 'PUT', data });
    },
    delete: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/process-inspections/${id}`, { method: 'DELETE' });
    },
    get: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/process-inspections/${id}`, { method: 'GET' });
    },
    conduct: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/process-inspections/${id}/conduct`, { method: 'POST', data });
    },
    approve: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/process-inspections/${id}/approve`, { method: 'POST', data });
    },
  },

  // 成品检验
  finishedGoodsInspection: {
    list: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/finished-goods-inspections', { method: 'GET', params });
    },
    create: async (data: any) => {
      return apiRequest('/apps/kuaizhizao/finished-goods-inspections', { method: 'POST', data });
    },
    update: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${id}`, { method: 'PUT', data });
    },
    delete: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${id}`, { method: 'DELETE' });
    },
    get: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${id}`, { method: 'GET' });
    },
    conduct: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${id}/conduct`, { method: 'POST', data });
    },
    approve: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${id}/approve`, { method: 'POST', data });
    },
    certificate: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${id}/certificate`, { method: 'POST', data });
    },
  },
};

// 财务协同相关接口
export const financeApi = {
  // 应付单
  payable: {
    list: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/payables', { method: 'GET', params });
    },
    create: async (data: any) => {
      return apiRequest('/apps/kuaizhizao/payables', { method: 'POST', data });
    },
    update: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/payables/${id}`, { method: 'PUT', data });
    },
    delete: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/payables/${id}`, { method: 'DELETE' });
    },
    get: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/payables/${id}`, { method: 'GET' });
    },
    recordPayment: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/payables/${id}/payment`, { method: 'POST', data });
    },
  },

  // 采购发票
  purchaseInvoice: {
    list: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/purchase-invoices', { method: 'GET', params });
    },
    create: async (data: any) => {
      return apiRequest('/apps/kuaizhizao/purchase-invoices', { method: 'POST', data });
    },
    update: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/purchase-invoices/${id}`, { method: 'PUT', data });
    },
    delete: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/purchase-invoices/${id}`, { method: 'DELETE' });
    },
    get: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/purchase-invoices/${id}`, { method: 'GET' });
    },
    approve: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/purchase-invoices/${id}/approve`, { method: 'POST', data });
    },
  },

  // 应收单
  receivable: {
    list: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/receivables', { method: 'GET', params });
    },
    create: async (data: any) => {
      return apiRequest('/apps/kuaizhizao/receivables', { method: 'POST', data });
    },
    update: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/receivables/${id}`, { method: 'PUT', data });
    },
    delete: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/receivables/${id}`, { method: 'DELETE' });
    },
    get: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/receivables/${id}`, { method: 'GET' });
    },
    recordReceipt: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/receivables/${id}/receipt`, { method: 'POST', data });
    },
  },
};

// 生产计划相关接口
export const planningApi = {
  // MRP运算
  mrp: {
    compute: async (data: any) => {
      return apiRequest('/apps/kuaizhizao/mrp-computation', { method: 'POST', data });
    },
  },

  // LRP运算
  lrp: {
    compute: async (data: any) => {
      return apiRequest('/apps/kuaizhizao/lrp-computation', { method: 'POST', data });
    },
  },

  // 生产计划
  productionPlan: {
    list: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/production-plans', { method: 'GET', params });
    },
    get: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/production-plans/${id}`, { method: 'GET' });
    },
    getItems: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/production-plans/${id}/items`, { method: 'GET' });
    },
    execute: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/production-plans/${id}/execute`, { method: 'POST' });
    },
  },
};

