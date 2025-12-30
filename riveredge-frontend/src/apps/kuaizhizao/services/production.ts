/**
 * 生产执行相关服务
 */

import { api } from '../../../services/api';

// 工单相关接口
export const workOrderApi = {
  // 获取工单列表
  list: async (params?: any) => {
    return api.get('/apps/kuaizhizao/work-orders', { params });
  },

  // 创建工单
  create: async (data: any) => {
    return api.post('/apps/kuaizhizao/work-orders', data);
  },

  // 更新工单
  update: async (id: string, data: any) => {
    return api.put(`/apps/kuaizhizao/work-orders/${id}`, data);
  },

  // 删除工单
  delete: async (id: string) => {
    return api.delete(`/apps/kuaizhizao/work-orders/${id}`);
  },

  // 获取工单详情
  get: async (id: string) => {
    return api.get(`/apps/kuaizhizao/work-orders/${id}`);
  },

  // 下达工单
  release: async (id: string) => {
    return api.post(`/apps/kuaizhizao/work-orders/${id}/release`);
  },
};

// 报工相关接口
export const reportingApi = {
  // 获取报工记录列表
  list: async (params?: any) => {
    return api.get('/apps/kuaizhizao/reporting-records', { params });
  },

  // 提交报工
  create: async (data: any) => {
    return api.post('/apps/kuaizhizao/reporting-records', data);
  },

  // 更新报工记录
  update: async (id: string, data: any) => {
    return api.put(`/apps/kuaizhizao/reporting-records/${id}`, data);
  },

  // 删除报工记录
  delete: async (id: string) => {
    return api.delete(`/apps/kuaizhizao/reporting-records/${id}`);
  },

  // 获取报工详情
  get: async (id: string) => {
    return api.get(`/apps/kuaizhizao/reporting-records/${id}`);
  },

  // 审核报工记录
  approve: async (id: string, data: any) => {
    return api.post(`/apps/kuaizhizao/reporting-records/${id}/approve`, data);
  },

  // 获取报工统计
  getStatistics: async (params?: any) => {
    return api.get('/apps/kuaizhizao/reporting-records/statistics', { params });
  },
};

// 仓储管理相关接口
export const warehouseApi = {
  // 生产领料单
  productionPicking: {
    list: async (params?: any) => {
      return api.get('/apps/kuaizhizao/production-pickings', { params });
    },
    create: async (data: any) => {
      return api.post('/apps/kuaizhizao/production-pickings', data);
    },
    update: async (id: string, data: any) => {
      return api.put(`/apps/kuaizhizao/production-pickings/${id}`, data);
    },
    delete: async (id: string) => {
      return api.delete(`/apps/kuaizhizao/production-pickings/${id}`);
    },
    get: async (id: string) => {
      return api.get(`/apps/kuaizhizao/production-pickings/${id}`);
    },
    confirm: async (id: string) => {
      return api.post(`/apps/kuaizhizao/production-pickings/${id}/confirm`);
    },
  },

  // 成品入库单
  finishedGoodsReceipt: {
    list: async (params?: any) => {
      return api.get('/apps/kuaizhizao/finished-goods-receipts', { params });
    },
    create: async (data: any) => {
      return api.post('/apps/kuaizhizao/finished-goods-receipts', data);
    },
    update: async (id: string, data: any) => {
      return api.put(`/apps/kuaizhizao/finished-goods-receipts/${id}`, data);
    },
    delete: async (id: string) => {
      return api.delete(`/apps/kuaizhizao/finished-goods-receipts/${id}`);
    },
    get: async (id: string) => {
      return api.get(`/apps/kuaizhizao/finished-goods-receipts/${id}`);
    },
    confirm: async (id: string) => {
      return api.post(`/apps/kuaizhizao/finished-goods-receipts/${id}/confirm`);
    },
  },

  // 销售出库单
  salesDelivery: {
    list: async (params?: any) => {
      return api.get('/apps/kuaizhizao/sales-deliveries', { params });
    },
    create: async (data: any) => {
      return api.post('/apps/kuaizhizao/sales-deliveries', data);
    },
    update: async (id: string, data: any) => {
      return api.put(`/apps/kuaizhizao/sales-deliveries/${id}`, data);
    },
    delete: async (id: string) => {
      return api.delete(`/apps/kuaizhizao/sales-deliveries/${id}`);
    },
    get: async (id: string) => {
      return api.get(`/apps/kuaizhizao/sales-deliveries/${id}`);
    },
    confirm: async (id: string) => {
      return api.post(`/apps/kuaizhizao/sales-deliveries/${id}/confirm`);
    },
  },

  // 采购入库单
  purchaseReceipt: {
    list: async (params?: any) => {
      return api.get('/apps/kuaizhizao/purchase-receipts', { params });
    },
    create: async (data: any) => {
      return api.post('/apps/kuaizhizao/purchase-receipts', data);
    },
    update: async (id: string, data: any) => {
      return api.put(`/apps/kuaizhizao/purchase-receipts/${id}`, data);
    },
    delete: async (id: string) => {
      return api.delete(`/apps/kuaizhizao/purchase-receipts/${id}`);
    },
    get: async (id: string) => {
      return api.get(`/apps/kuaizhizao/purchase-receipts/${id}`);
    },
    confirm: async (id: string) => {
      return api.post(`/apps/kuaizhizao/purchase-receipts/${id}/confirm`);
    },
  },
};

// 质量管理相关接口
export const qualityApi = {
  // 来料检验
  incomingInspection: {
    list: async (params?: any) => {
      return api.get('/apps/kuaizhizao/incoming-inspections', { params });
    },
    create: async (data: any) => {
      return api.post('/apps/kuaizhizao/incoming-inspections', data);
    },
    update: async (id: string, data: any) => {
      return api.put(`/apps/kuaizhizao/incoming-inspections/${id}`, data);
    },
    delete: async (id: string) => {
      return api.delete(`/apps/kuaizhizao/incoming-inspections/${id}`);
    },
    get: async (id: string) => {
      return api.get(`/apps/kuaizhizao/incoming-inspections/${id}`);
    },
    conduct: async (id: string, data: any) => {
      return api.post(`/apps/kuaizhizao/incoming-inspections/${id}/conduct`, data);
    },
    approve: async (id: string, data: any) => {
      return api.post(`/apps/kuaizhizao/incoming-inspections/${id}/approve`, data);
    },
  },

  // 过程检验
  processInspection: {
    list: async (params?: any) => {
      return api.get('/apps/kuaizhizao/process-inspections', { params });
    },
    create: async (data: any) => {
      return api.post('/apps/kuaizhizao/process-inspections', data);
    },
    update: async (id: string, data: any) => {
      return api.put(`/apps/kuaizhizao/process-inspections/${id}`, data);
    },
    delete: async (id: string) => {
      return api.delete(`/apps/kuaizhizao/process-inspections/${id}`);
    },
    get: async (id: string) => {
      return api.get(`/apps/kuaizhizao/process-inspections/${id}`);
    },
    conduct: async (id: string, data: any) => {
      return api.post(`/apps/kuaizhizao/process-inspections/${id}/conduct`, data);
    },
    approve: async (id: string, data: any) => {
      return api.post(`/apps/kuaizhizao/process-inspections/${id}/approve`, data);
    },
  },

  // 成品检验
  finishedGoodsInspection: {
    list: async (params?: any) => {
      return api.get('/apps/kuaizhizao/finished-goods-inspections', { params });
    },
    create: async (data: any) => {
      return api.post('/apps/kuaizhizao/finished-goods-inspections', data);
    },
    update: async (id: string, data: any) => {
      return api.put(`/apps/kuaizhizao/finished-goods-inspections/${id}`, data);
    },
    delete: async (id: string) => {
      return api.delete(`/apps/kuaizhizao/finished-goods-inspections/${id}`);
    },
    get: async (id: string) => {
      return api.get(`/apps/kuaizhizao/finished-goods-inspections/${id}`);
    },
    conduct: async (id: string, data: any) => {
      return api.post(`/apps/kuaizhizao/finished-goods-inspections/${id}/conduct`, data);
    },
    approve: async (id: string, data: any) => {
      return api.post(`/apps/kuaizhizao/finished-goods-inspections/${id}/approve`, data);
    },
    certificate: async (id: string, data: any) => {
      return api.post(`/apps/kuaizhizao/finished-goods-inspections/${id}/certificate`, data);
    },
  },
};

// 财务协同相关接口
export const financeApi = {
  // 应付单
  payable: {
    list: async (params?: any) => {
      return api.get('/apps/kuaizhizao/payables', { params });
    },
    create: async (data: any) => {
      return api.post('/apps/kuaizhizao/payables', data);
    },
    update: async (id: string, data: any) => {
      return api.put(`/apps/kuaizhizao/payables/${id}`, data);
    },
    delete: async (id: string) => {
      return api.delete(`/apps/kuaizhizao/payables/${id}`);
    },
    get: async (id: string) => {
      return api.get(`/apps/kuaizhizao/payables/${id}`);
    },
    recordPayment: async (id: string, data: any) => {
      return api.post(`/apps/kuaizhizao/payables/${id}/payment`, data);
    },
  },

  // 采购发票
  purchaseInvoice: {
    list: async (params?: any) => {
      return api.get('/apps/kuaizhizao/purchase-invoices', { params });
    },
    create: async (data: any) => {
      return api.post('/apps/kuaizhizao/purchase-invoices', data);
    },
    update: async (id: string, data: any) => {
      return api.put(`/apps/kuaizhizao/purchase-invoices/${id}`, data);
    },
    delete: async (id: string) => {
      return api.delete(`/apps/kuaizhizao/purchase-invoices/${id}`);
    },
    get: async (id: string) => {
      return api.get(`/apps/kuaizhizao/purchase-invoices/${id}`);
    },
    approve: async (id: string, data: any) => {
      return api.post(`/apps/kuaizhizao/purchase-invoices/${id}/approve`, data);
    },
  },

  // 应收单
  receivable: {
    list: async (params?: any) => {
      return api.get('/apps/kuaizhizao/receivables', { params });
    },
    create: async (data: any) => {
      return api.post('/apps/kuaizhizao/receivables', data);
    },
    update: async (id: string, data: any) => {
      return api.put(`/apps/kuaizhizao/receivables/${id}`, data);
    },
    delete: async (id: string) => {
      return api.delete(`/apps/kuaizhizao/receivables/${id}`);
    },
    get: async (id: string) => {
      return api.get(`/apps/kuaizhizao/receivables/${id}`);
    },
    recordReceipt: async (id: string, data: any) => {
      return api.post(`/apps/kuaizhizao/receivables/${id}/receipt`, data);
    },
  },
};

// 生产计划相关接口
export const planningApi = {
  // MRP运算
  mrp: {
    compute: async (data: any) => {
      return api.post('/apps/kuaizhizao/mrp-computation', data);
    },
  },

  // LRP运算
  lrp: {
    compute: async (data: any) => {
      return api.post('/apps/kuaizhizao/lrp-computation', data);
    },
  },

  // 生产计划
  productionPlan: {
    list: async (params?: any) => {
      return api.get('/apps/kuaizhizao/production-plans', { params });
    },
    get: async (id: string) => {
      return api.get(`/apps/kuaizhizao/production-plans/${id}`);
    },
    getItems: async (id: string) => {
      return api.get(`/apps/kuaizhizao/production-plans/${id}/items`);
    },
    execute: async (id: string) => {
      return api.post(`/apps/kuaizhizao/production-plans/${id}/execute`);
    },
  },
};

// BOM管理相关接口
export const bomApi = {
  // 物料清单
  billOfMaterials: {
    list: async (params?: any) => {
      return api.get('/apps/kuaizhizao/bill-of-materials', { params });
    },
    create: async (data: any) => {
      return api.post('/apps/kuaizhizao/bill-of-materials', data);
    },
    update: async (id: string, data: any) => {
      return api.put(`/apps/kuaizhizao/bill-of-materials/${id}`, data);
    },
    delete: async (id: string) => {
      return api.delete(`/apps/kuaizhizao/bill-of-materials/${id}`);
    },
    get: async (id: string) => {
      return api.get(`/apps/kuaizhizao/bill-of-materials/${id}`);
    },
    expand: async (id: string, data: any) => {
      return api.post(`/apps/kuaizhizao/bill-of-materials/${id}/expand`, data);
    },
    calculateRequirements: async (id: string, data: any) => {
      return api.post(`/apps/kuaizhizao/bill-of-materials/${id}/calculate-requirements`, data);
    },
  },
};

  // 审核报工
  approve: async (id: string, data: any) => {
    return api.post(`/apps/kuaizhizao/production/reporting/${id}/approve`, data);
  },

  // 驳回报工
  reject: async (id: string, data: any) => {
    return api.post(`/apps/kuaizhizao/production/reporting/${id}/reject`, data);
  },

  // 获取报工统计
  getStatistics: async (params?: any) => {
    return api.get('/apps/kuaizhizao/production/reporting/statistics', { params });
  },
};
