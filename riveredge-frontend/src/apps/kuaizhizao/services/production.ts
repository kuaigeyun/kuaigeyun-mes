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

  // 撤回工单
  revoke: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/work-orders/${id}/revoke`, { method: 'POST' });
  },

  // 指定结束工单
  complete: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/work-orders/${id}/complete`, { method: 'POST' });
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

  // 开始工单工序
  startOperation: async (workOrderId: string, operationId: number) => {
    return apiRequest(`/apps/kuaizhizao/work-orders/${workOrderId}/operations/${operationId}/start`, { method: 'POST' });
  },

  // 派工工单工序
  dispatchOperation: async (workOrderId: string, operationId: number, data: any) => {
    return apiRequest(`/apps/kuaizhizao/work-orders/${workOrderId}/operations/${operationId}/dispatch`, { method: 'POST', data });
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

  // 批量更新工单计划日期（甘特图拖拽后持久化）
  batchUpdateDates: async (updates: Array<{ work_order_id: number; planned_start_date: string; planned_end_date: string }>) => {
    return apiRequest('/apps/kuaizhizao/work-orders/batch-update-dates', { method: 'PUT', data: { updates } });
  },

  // 合并工单
  merge: async (data: { work_order_ids: number[]; remarks?: string }) => {
    return apiRequest('/apps/kuaizhizao/work-orders/merge', { method: 'POST', data });
  },

  // 生成工单二维码
  generateQRCode: async (workOrderId: string, workOrderCode: string, workOrderName: string): Promise<any> => {
    const { qrcodeApi } = await import('../../../services/qrcode');
    return qrcodeApi.generateWorkOrder({
      work_order_uuid: workOrderId,
      work_order_code: workOrderCode,
      material_code: workOrderName, // Note: Schema says material_code, but using workOrderName as fallback if needed, or check if it should be name
    });
  },

  // 获取打印 URL
  getPrintUrl: (id: string) => {
    return `/api/v1/apps/kuaizhizao/work-orders/${id}/print`;
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

// 委外工单相关接口
export const outsourceWorkOrderApi = {
  // 获取委外工单列表
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/outsource-work-orders', { method: 'GET', params });
  },

  // 创建委外工单
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/outsource-work-orders', { method: 'POST', data });
  },

  // 更新委外工单
  update: async (id: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/outsource-work-orders/${id}`, { method: 'PUT', data });
  },

  // 删除委外工单
  delete: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/outsource-work-orders/${id}`, { method: 'DELETE' });
  },

  // 获取委外工单详情
  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/outsource-work-orders/${id}`, { method: 'GET' });
  },
};

// 委外发料相关接口
export const outsourceMaterialIssueApi = {
  // 获取委外发料单列表
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/outsource-material-issues', { method: 'GET', params });
  },

  // 创建委外发料单
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/outsource-material-issues', { method: 'POST', data });
  },

  // 获取委外发料单详情
  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/outsource-material-issues/${id}`, { method: 'GET' });
  },

  // 完成委外发料
  complete: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/outsource-material-issues/${id}/complete`, { method: 'POST' });
  },
};

// 委外收货相关接口
export const outsourceMaterialReceiptApi = {
  // 获取委外收货单列表
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/outsource-material-receipts', { method: 'GET', params });
  },

  // 创建委外收货单
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/outsource-material-receipts', { method: 'POST', data });
  },

  // 获取委外收货单详情
  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/outsource-material-receipts/${id}`, { method: 'GET' });
  },

  // 完成委外收货
  complete: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/outsource-material-receipts/${id}/complete`, { method: 'POST' });
  },
};

// 委外单相关接口（工序委外，保留用于向后兼容）
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

  // 审核报工记录（通过时不传 rejection_reason，驳回时传 params: { rejection_reason }）
  approve: async (id: string, data?: any, params?: { rejection_reason?: string }) => {
    return apiRequest(`/apps/kuaizhizao/reporting/${id}/approve`, {
      method: 'POST',
      data: data || {},
      params,
    });
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
  correct: async (recordId: string, data: any) => {
    // 从data中提取correction_reason作为Query参数
    const { correction_reason, ...restData } = data;
    if (!correction_reason || !correction_reason.trim()) {
      throw new Error('修正原因不能为空');
    }
    return apiRequest(`/apps/kuaizhizao/reporting/${recordId}/correct`, {
      method: 'PUT',
      data: restData,
      params: { correction_reason },
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
    // 一键领料
    quickPick: async (workOrderId: string) => {
      return apiRequest('/apps/kuaizhizao/production-pickings/quick-pick', { 
        method: 'POST', 
        params: { work_order_id: workOrderId } 
      });
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
      return apiRequest('/apps/kuaizhizao/sales-deliveries/import', {
        method: 'POST',
        data: { data },
      });
    },
    export: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/sales-deliveries/export', {
        method: 'GET',
        params,
        responseType: 'blob',
      });
    },
    print: async (id: string, templateUuid?: string) => {
      return apiRequest(`/apps/kuaizhizao/sales-deliveries/${id}/print`, {
        method: 'GET',
        params: templateUuid ? { template_uuid: templateUuid } : undefined,
      });
    },
    pullFromSalesOrder: async (data: { sales_order_id: number; delivery_quantities?: Record<number, number>; warehouse_id: number; warehouse_name?: string }) => {
      return apiRequest('/apps/kuaizhizao/sales-deliveries/pull-from-sales-order', { method: 'POST', data });
    },
    pullFromSalesForecast: async (data: { sales_forecast_id: number; delivery_quantities?: Record<number, number>; warehouse_id: number; warehouse_name?: string }) => {
      return apiRequest('/apps/kuaizhizao/sales-deliveries/pull-from-sales-forecast', { method: 'POST', data });
    },
  },

  // 销售退货单
  salesReturn: {
    list: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/sales-returns', { method: 'GET', params });
    },
    create: async (data: any) => {
      return apiRequest('/apps/kuaizhizao/sales-returns', { method: 'POST', data });
    },
    get: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/sales-returns/${id}`, { method: 'GET' });
    },
    confirm: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/sales-returns/${id}/confirm`, { method: 'POST' });
    },
  },

  // 采购退货单
  purchaseReturn: {
    list: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/purchase-returns', { method: 'GET', params });
    },
    create: async (data: any) => {
      return apiRequest('/apps/kuaizhizao/purchase-returns', { method: 'POST', data });
    },
    get: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/purchase-returns/${id}`, { method: 'GET' });
    },
    confirm: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/purchase-returns/${id}/confirm`, { method: 'POST' });
    },
  },

  // 补货建议
  replenishmentSuggestion: {
    list: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/replenishment-suggestions', { method: 'GET', params });
    },
    get: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/replenishment-suggestions/${id}`, { method: 'GET' });
    },
    generateFromAlerts: async (data?: { alert_ids?: number[] }) => {
      return apiRequest('/apps/kuaizhizao/replenishment-suggestions/generate-from-alerts', { method: 'POST', data: data || {} });
    },
    process: async (id: string, data: { status: string; processing_notes?: string }) => {
      return apiRequest(`/apps/kuaizhizao/replenishment-suggestions/${id}/process`, { method: 'POST', data });
    },
    statistics: async () => {
      return apiRequest('/apps/kuaizhizao/replenishment-suggestions/statistics', { method: 'GET' });
    },
  },

  // 线边仓管理
  lineSideWarehouse: {
    listWarehouses: async () => {
      return apiRequest('/apps/kuaizhizao/line-side-warehouse/warehouses', { method: 'GET' });
    },
    listInventory: async (params?: { warehouse_id?: number; material_code?: string; material_name?: string; skip?: number; limit?: number }) => {
      return apiRequest<{ items: any[]; total: number }>('/apps/kuaizhizao/line-side-warehouse/inventory', { method: 'GET', params });
    },
  },

  // 倒冲记录
  backflushRecords: {
    list: async (params?: { work_order_code?: string; material_code?: string; status?: string; skip?: number; limit?: number }) => {
      return apiRequest<{ items: any[]; total: number }>('/apps/kuaizhizao/backflush-records', { method: 'GET', params });
    },
    get: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/backflush-records/${id}`, { method: 'GET' });
    },
    retry: async (id: string) => {
      return apiRequest<{ message: string; success: boolean }>(`/apps/kuaizhizao/backflush-records/${id}/retry`, { method: 'POST' });
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
      return apiRequest('/apps/kuaizhizao/purchase-receipts/import', {
        method: 'POST',
        data: { data },
      });
    },
    export: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/purchase-receipts/export', {
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
    createDefect: async (inspectionId: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/incoming-inspections/${inspectionId}/create-defect`, { method: 'POST', data });
    },
    import: async (data: any[][]) => {
      return apiRequest('/apps/kuaizhizao/incoming-inspections/import', {
        method: 'POST',
        data: { data },
      });
    },
    export: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/incoming-inspections/export', {
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
    createDefect: async (inspectionId: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/process-inspections/${inspectionId}/create-defect`, { method: 'POST', data });
    },
    import: async (data: any[][]) => {
      return apiRequest('/apps/kuaizhizao/process-inspections/import', {
        method: 'POST',
        data: { data },
      });
    },
    export: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/process-inspections/export', {
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
    createDefect: async (inspectionId: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${inspectionId}/create-defect`, { method: 'POST', data });
    },
    import: async (data: any[][]) => {
      return apiRequest('/apps/kuaizhizao/finished-goods-inspections/import', {
        method: 'POST',
        data: { data },
      });
    },
    export: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/finished-goods-inspections/export', {
        method: 'GET',
        params,
        responseType: 'blob',
      });
    },
  },

  // 质量统计和报表
  qualityStatistics: {
    getStatistics: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/quality/statistics', { method: 'GET', params });
    },
    getAnomalies: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/quality/anomalies', { method: 'GET', params });
    },
    getReport: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/reports/quality', { method: 'GET', params });
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
      // TODO: MRP运算已合并为统一需求计算，此接口已废弃
      // return apiRequest('/apps/kuaizhizao/mrp-computation', { method: 'POST', data });
      throw new Error('MRP运算已合并为统一需求计算，请使用需求计算接口');
    },
  },

  // LRP运算
  lrp: {
    compute: async (data: any) => {
      // TODO: LRP运算已合并为统一需求计算，此接口已废弃
      // return apiRequest('/apps/kuaizhizao/lrp-computation', { method: 'POST', data });
      throw new Error('LRP运算已合并为统一需求计算，请使用需求计算接口');
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
    pushToWorkOrders: async (id: number) => {
      return apiRequest(`/apps/kuaizhizao/production-plans/${id}/push-to-work-orders`, { method: 'POST' });
    },
    getStatistics: async () => {
      return apiRequest('/apps/kuaizhizao/production-plans/statistics', { method: 'GET' });
    },
    getPlanningConfig: async () => {
      return apiRequest<{
        production_plan_enabled: boolean;
        production_plan_audit_required: boolean;
        can_direct_generate_work_order: boolean;
        planning_mode: 'direct' | 'via_plan';
      }>('/apps/kuaizhizao/production-plans/planning-config', { method: 'GET' });
    },
    create: async (data: any) => {
      return apiRequest('/apps/kuaizhizao/production-plans', { method: 'POST', data });
    },
    update: async (id: string, data: any) => {
      return apiRequest(`/apps/kuaizhizao/production-plans/${id}`, { method: 'PUT', data });
    },
    delete: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/production-plans/${id}`, { method: 'DELETE' });
    },
  },
};

// 异常处理相关接口
export const exceptionApi = {
  // 缺料异常
  materialShortage: {
    list: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/exceptions/material-shortage', { method: 'GET', params });
    },
    handle: async (id: string, action: string, alternativeMaterialId?: number, remarks?: string) => {
      return apiRequest(`/apps/kuaizhizao/exceptions/material-shortage/${id}/handle`, {
        method: 'POST',
        params: { action, alternative_material_id: alternativeMaterialId, remarks },
      });
    },
    detect: async (workOrderId: string) => {
      return apiRequest(`/apps/kuaizhizao/work-orders/${workOrderId}/detect-shortage`, { method: 'POST' });
    },
  },

  // 延期异常
  deliveryDelay: {
    list: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/exceptions/delivery-delay', { method: 'GET', params });
    },
    handle: async (id: string, action: string, remarks?: string) => {
      return apiRequest(`/apps/kuaizhizao/exceptions/delivery-delay/${id}/handle`, {
        method: 'POST',
        params: { action, remarks },
      });
    },
    detect: async (workOrderId: string, daysThreshold?: number) => {
      return apiRequest(`/apps/kuaizhizao/work-orders/${workOrderId}/detect-delay`, {
        method: 'POST',
        params: { days_threshold: daysThreshold },
      });
    },
  },

  // 质量异常
  quality: {
    list: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/exceptions/quality', { method: 'GET', params });
    },
    handle: async (
      id: string,
      action: string,
      data?: {
        root_cause?: string;
        corrective_action?: string;
        preventive_action?: string;
        responsible_person_id?: number;
        responsible_person_name?: string;
        verification_result?: string;
        remarks?: string;
      }
    ) => {
      return apiRequest(`/apps/kuaizhizao/exceptions/quality/${id}/handle`, {
        method: 'POST',
        params: { action, ...data },
      });
    },
  },

  // 异常统计
  statistics: async (params?: { date_start?: string; date_end?: string }) => {
    return apiRequest('/apps/kuaizhizao/exceptions/statistics', { method: 'GET', params });
  },

  // 异常处理流程
  process: {
    // 启动异常处理流程
    start: async (data: {
      exception_type: string;
      exception_id: number;
      assigned_to?: number;
      process_config?: any;
      remarks?: string;
    }) => {
      return apiRequest('/apps/kuaizhizao/exceptions/process/start', { method: 'POST', data });
    },
    // 获取异常处理流程列表
    list: async (params?: any) => {
      return apiRequest('/apps/kuaizhizao/exceptions/process', { method: 'GET', params });
    },
    // 获取异常处理流程详情
    get: async (id: string) => {
      return apiRequest(`/apps/kuaizhizao/exceptions/process/${id}`, { method: 'GET' });
    },
    // 分配异常处理流程
    assign: async (id: string, data: { assigned_to: number; comment?: string }) => {
      return apiRequest(`/apps/kuaizhizao/exceptions/process/${id}/assign`, { method: 'POST', data });
    },
    // 步骤流转
    stepTransition: async (id: string, data: { to_step: string; comment?: string }) => {
      return apiRequest(`/apps/kuaizhizao/exceptions/process/${id}/step-transition`, { method: 'POST', data });
    },
    // 解决异常处理流程
    resolve: async (id: string, data?: { comment?: string; verification_result?: string }) => {
      return apiRequest(`/apps/kuaizhizao/exceptions/process/${id}/resolve`, { method: 'POST', data });
    },
    // 取消异常处理流程
    cancel: async (id: string, comment?: string) => {
      return apiRequest(`/apps/kuaizhizao/exceptions/process/${id}/cancel`, { method: 'POST', data: { comment } });
    },
  },
};

// 库存盘点相关接口
export const stocktakingApi = {
  // 获取盘点单列表
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/stocktakings', { method: 'GET', params });
  },

  // 创建盘点单
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/stocktakings', { method: 'POST', data });
  },

  // 更新盘点单
  update: async (id: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${id}`, { method: 'PUT', data });
  },

  // 获取盘点单详情
  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${id}`, { method: 'GET' });
  },

  // 开始盘点
  start: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${id}/start`, { method: 'POST' });
  },

  // 添加盘点明细
  createItem: async (stocktakingId: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${stocktakingId}/items`, { method: 'POST', data });
  },

  // 更新盘点明细
  updateItem: async (stocktakingId: string, itemId: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${stocktakingId}/items/${itemId}`, { method: 'PUT', data });
  },

  // 执行盘点明细（记录实际数量）
  executeItem: async (stocktakingId: string, itemId: string, actualQuantity: number, remarks?: string) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${stocktakingId}/items/${itemId}/execute`, {
      method: 'POST',
      data: { actual_quantity: actualQuantity, remarks },
    });
  },

  // 处理盘点差异（调整库存）
  adjust: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/stocktakings/${id}/adjust`, { method: 'POST' });
  },
};

// 高级排产相关接口
export const advancedSchedulingApi = {
  // 智能排产
  intelligentScheduling: async (data: {
    work_order_ids?: number[];
    constraints?: {
      priority_weight?: number;
      due_date_weight?: number;
      capacity_weight?: number;
      setup_time_weight?: number;
      optimize_objective?: 'min_makespan' | 'min_total_time' | 'min_setup_time';
    };
  }) => {
    return apiRequest('/apps/kuaizhizao/scheduling/intelligent', { method: 'POST', data });
  },

  // 优化排产计划
  optimizeSchedule: async (data: {
    schedule_id?: number;
    optimization_params?: {
      max_iterations?: number;
      convergence_threshold?: number;
      optimization_objective?: string;
    };
  }) => {
    return apiRequest('/apps/kuaizhizao/scheduling/optimize', { method: 'POST', data });
  },
};
