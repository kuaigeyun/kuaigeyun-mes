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

  // 拆分工单
  split: async (id: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/work-orders/${id}/split`, { method: 'POST', data });
  },

  // 获取工单工序列表
  getOperations: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/work-orders/${id}/operations`, { method: 'GET' });
  },

  // 更新工单工序
  updateOperations: async (id: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/work-orders/${id}/operations`, { method: 'PUT', data });
  },

  // 冻结工单
  freeze: async (id: string, data: { freeze_reason: string }) => {
    return apiRequest(`/apps/kuaizhizao/work-orders/${id}/freeze`, { method: 'POST', data });
  },

  // 解冻工单
  unfreeze: async (id: string, data?: { unfreeze_reason?: string }) => {
    return apiRequest(`/apps/kuaizhizao/work-orders/${id}/unfreeze`, { method: 'POST', data: data || {} });
  },

  // 设置工单优先级
  setPriority: async (id: string, data: { priority: string }) => {
    return apiRequest(`/apps/kuaizhizao/work-orders/${id}/priority`, { method: 'PUT', data });
  },

  // 批量设置工单优先级
  batchSetPriority: async (data: { work_order_ids: number[]; priority: string }) => {
    return apiRequest('/apps/kuaizhizao/work-orders/batch-priority', { method: 'PUT', data });
  },

  // 合并工单
  merge: async (data: { work_order_ids: number[]; remarks?: string }) => {
    return apiRequest('/apps/kuaizhizao/work-orders/merge', { method: 'POST', data });
  },
};

// 返工单相关接口
export const reworkOrderApi = {
  // 获取返工单列表
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/rework-orders', { method: 'GET', params });
  },

  // 创建返工单
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/rework-orders', { method: 'POST', data });
  },

  // 更新返工单
  update: async (id: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/rework-orders/${id}`, { method: 'PUT', data });
  },

  // 删除返工单
  delete: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/rework-orders/${id}`, { method: 'DELETE' });
  },

  // 获取返工单详情
  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/rework-orders/${id}`, { method: 'GET' });
  },

  // 从工单创建返工单
  createFromWorkOrder: async (workOrderId: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/work-orders/${workOrderId}/rework`, { method: 'POST', data });
  },
};

// 委外单相关接口
export const outsourceOrderApi = {
  // 获取委外单列表
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/outsource-orders', { method: 'GET', params });
  },

  // 创建委外单
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/outsource-orders', { method: 'POST', data });
  },

  // 更新委外单
  update: async (id: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/outsource-orders/${id}`, { method: 'PUT', data });
  },

  // 删除委外单
  delete: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/outsource-orders/${id}`, { method: 'DELETE' });
  },

  // 获取委外单详情
  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/outsource-orders/${id}`, { method: 'GET' });
  },

  // 从工单创建委外单
  createFromWorkOrder: async (workOrderId: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/work-orders/${workOrderId}/outsource`, { method: 'POST', data });
  },

  // 关联采购入库单
  linkPurchaseReceipt: async (outsourceOrderId: string, purchaseReceiptId: number) => {
    return apiRequest(`/apps/kuaizhizao/outsource-orders/${outsourceOrderId}/link-purchase-receipt`, {
      method: 'POST',
      params: { purchase_receipt_id: purchaseReceiptId },
    });
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

  // 从报工记录创建报废记录
  recordScrap: async (recordId: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/reporting/${recordId}/scrap`, { method: 'POST', data });
  },

  // 从报工记录创建不良品记录
  recordDefect: async (recordId: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/reporting/${recordId}/defect`, { method: 'POST', data });
  },

  // 修正报工数据
  correct: async (recordId: string, data: any, correctionReason: string) => {
    return apiRequest(`/apps/kuaizhizao/reporting/${recordId}/correct`, {
      method: 'PUT',
      data,
      params: { correction_reason: correctionReason },
    });
  },
};

// 物料绑定相关接口
export const materialBindingApi = {
  // 创建上料绑定
  createFeeding: async (recordId: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/reporting/${recordId}/material-binding/feeding`, {
      method: 'POST',
      data,
    });
  },

  // 创建下料绑定
  createDischarging: async (recordId: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/reporting/${recordId}/material-binding/discharging`, {
      method: 'POST',
      data,
    });
  },

  // 获取报工记录的物料绑定列表
  getByReportingRecord: async (recordId: string) => {
    return apiRequest(`/apps/kuaizhizao/reporting/${recordId}/material-binding`, { method: 'GET' });
  },

  // 删除物料绑定记录
  delete: async (bindingId: string) => {
    return apiRequest(`/apps/kuaizhizao/material-binding/${bindingId}`, { method: 'DELETE' });
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
    import: async (data: any[][]) => {
      return apiRequest<{ success: boolean; message: string; data?: any }>({
        url: '/apps/kuaizhizao/sales-deliveries/import',
        method: 'POST',
        data: { data },
      });
    },
    export: async (params?: any) => {
      return apiRequest<Blob>({
        url: '/apps/kuaizhizao/sales-deliveries/export',
        method: 'GET',
        params,
        responseType: 'blob',
      });
    },
    print: async (id: string, templateUuid?: string) => {
      return apiRequest<{ success: boolean; content?: string; data?: any; message?: string }>({
        url: `/apps/kuaizhizao/sales-deliveries/${id}/print`,
        method: 'GET',
        params: templateUuid ? { template_uuid: templateUuid } : undefined,
      });
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
    import: async (data: any[][]) => {
      return apiRequest<{ success: boolean; message: string; data?: any }>({
        url: '/apps/kuaizhizao/purchase-receipts/import',
        method: 'POST',
        data: { data },
      });
    },
    export: async (params?: any) => {
      return apiRequest<Blob>({
        url: '/apps/kuaizhizao/purchase-receipts/export',
        method: 'GET',
        params,
        responseType: 'blob',
      });
    },
  },

  // 客户来料登记
  customerMaterialRegistration: {
    // 解析条码
    parseBarcode: async (data: { barcode: string; barcode_type?: string; customer_id?: number }) => {
      return apiRequest('/apps/kuaizhizao/inventory/customer-material-registration/parse-barcode', {
        method: 'POST',
        data,
      });
    },
    // 获取登记列表
    list: async (params?: {
      skip?: number;
      limit?: number;
      customer_id?: number;
      status?: string;
      registration_date_start?: string;
      registration_date_end?: string;
    }) => {
      return apiRequest('/apps/kuaizhizao/inventory/customer-material-registration', {
        method: 'GET',
        params,
      });
    },
    // 创建登记
    create: async (data: any) => {
      return apiRequest('/apps/kuaizhizao/inventory/customer-material-registration', {
        method: 'POST',
        data,
      });
    },
    // 获取登记详情
    get: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/inventory/customer-material-registration/${id}`, {
        method: 'GET',
      });
    },
  },

  // 条码映射规则
  barcodeMappingRule: {
    // 获取映射规则列表
    list: async (params?: {
      skip?: number;
      limit?: number;
      customer_id?: number;
      is_enabled?: boolean;
    }) => {
      return apiRequest('/apps/kuaizhizao/inventory/customer-material-registration/mapping-rules', {
        method: 'GET',
        params,
      });
    },
    // 创建映射规则
    create: async (data: any) => {
      return apiRequest('/apps/kuaizhizao/inventory/customer-material-registration/mapping-rules', {
        method: 'POST',
        data,
      });
    },
    // 获取映射规则详情
    get: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/inventory/customer-material-registration/mapping-rules/${id}`, {
        method: 'GET',
      });
    },
    // 更新映射规则
    update: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/inventory/customer-material-registration/mapping-rules/${id}`, {
        method: 'PUT',
        data,
      });
    },
    // 删除映射规则
    delete: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/inventory/customer-material-registration/mapping-rules/${id}`, {
        method: 'DELETE',
      });
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
    createFromPurchaseReceipt: async (purchaseReceiptId: string) => {
      return apiRequest(`/apps/kuaizhizao/incoming-inspections/from-purchase-receipt/${purchaseReceiptId}`, { method: 'POST' });
    },
    import: async (data: any[][]) => {
      return apiRequest<{ success: boolean; message: string; data?: any }>({
        url: '/apps/kuaizhizao/incoming-inspections/import',
        method: 'POST',
        data: { data },
      });
    },
    export: async (params?: any) => {
      return apiRequest<Blob>({
        url: '/apps/kuaizhizao/incoming-inspections/export',
        method: 'GET',
        params,
        responseType: 'blob',
      });
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
    createFromWorkOrder: async (workOrderId: string, operationId: string) => {
      return apiRequest(`/apps/kuaizhizao/process-inspections/from-work-order?work_order_id=${workOrderId}&operation_id=${operationId}`, { method: 'POST' });
    },
    import: async (data: any[][]) => {
      return apiRequest<{ success: boolean; message: string; data?: any }>({
        url: '/apps/kuaizhizao/process-inspections/import',
        method: 'POST',
        data: { data },
      });
    },
    export: async (params?: any) => {
      return apiRequest<Blob>({
        url: '/apps/kuaizhizao/process-inspections/export',
        method: 'GET',
        params,
        responseType: 'blob',
      });
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
    createFromWorkOrder: async (workOrderId: string) => {
      return apiRequest(`/apps/kuaizhizao/finished-goods-inspections/from-work-order?work_order_id=${workOrderId}`, { method: 'POST' });
    },
    import: async (data: any[][]) => {
      return apiRequest<{ success: boolean; message: string; data?: any }>({
        url: '/apps/kuaizhizao/finished-goods-inspections/import',
        method: 'POST',
        data: { data },
      });
    },
    export: async (params?: any) => {
      return apiRequest<Blob>({
        url: '/apps/kuaizhizao/finished-goods-inspections/export',
        method: 'GET',
        params,
        responseType: 'blob',
      });
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

