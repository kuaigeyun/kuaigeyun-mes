/**
 * 生产执行相关服务（聚合导出）
 * 具体实现已拆分至 work-order、reporting、warehouse-execution、quality-execution、planning 等子模块
 */

import { apiRequest } from '../../../services/api';

export { workOrderApi, reworkOrderApi, getWorkOrderStatistics } from './work-order';
export { reportingApi, materialBindingApi, getReportingStatistics } from './reporting';
export { warehouseApi } from './warehouse-execution';
export { qualityApi, inspectionPlanApi } from './quality-execution';
export { planningApi } from './planning';

export interface SchedulingConstraints {
  consider_human: boolean;
  consider_equipment: boolean;
  consider_material: boolean;
  consider_mold_tool: boolean;
  daily_capacity_hours?: number;
  freeze_horizon_days?: number;
  rolling_horizon_days?: number;
  setup_changeover_hours?: number;
  bottleneck_work_center_ids?: number[];
}

export interface VisualSchedulingConflict {
  type: string;
  work_order_id?: number;
  work_order_code?: string;
  operation_id?: number;
  task_id?: string;
  station_id?: number;
  resource_id?: number;
  message: string;
}

export interface VisualSchedulingMaterialIssue {
  work_order_id: number;
  work_order_code: string;
  readiness_rate?: number;
  message: string;
}

export interface VisualSchedulingBoardScan {
  conflicts: VisualSchedulingConflict[];
  unscheduled_orders: Array<{ work_order_id: number; work_order_code: string; reason: string }>;
  material_issues?: VisualSchedulingMaterialIssue[];
  load_by_work_center: Array<{
    work_center_id: number;
    work_center_name: string;
    day: string;
    hours: number;
    rate: number;
    overloaded: boolean;
  }>;
  load_by_station?: Array<{
    station_id: number;
    station_name: string;
    day: string;
    hours: number;
    rate: number;
    overloaded: boolean;
  }>;
  conflict_count: number;
  unscheduled_count: number;
  material_issue_count?: number;
  overloaded_station_count?: number;
}

export interface BatchUpdateResult {
  updated: number[];
  skipped_frozen: number[];
  skipped_freeze_window: number[];
  failed: Array<{ id: number; reason: string }>;
}


// 生产控制台（控制塔）相关接口
export const productionControlApi = {
  // 获取控制塔汇总数据
  getSummary: async () => {
    return apiRequest('/apps/kuaizhizao/production-control/summary', { method: 'GET' });
  },

  // 批量下达齐套工单
  releaseKitted: async (workOrderIds: number[]) => {
    return apiRequest('/apps/kuaizhizao/production-control/release-kitted', {
      method: 'POST',
      data: { work_order_ids: workOrderIds },
    });
  },

  // 模拟紧急工单影响
  simulateImpact: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/production-control/simulate-impact', {
      method: 'POST',
      data,
    });
  },
};

export const coordinationBoardApi = {
  listActiveOrders: async (limit = 20) => {
    return apiRequest('/apps/kuaizhizao/coordination-board/active-orders', {
      method: 'GET',
      params: { limit },
    });
  },

  listActiveComputations: async (limit = 20) => {
    return apiRequest('/apps/kuaizhizao/coordination-board/active-computations', {
      method: 'GET',
      params: { limit },
    });
  },

  getPipeline: async (params?: { computation_id?: number; sales_order_id?: number }) => {
    return apiRequest('/apps/kuaizhizao/coordination-board/pipeline', {
      method: 'GET',
      params,
    });
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

  // 发料预览（从 BOM 读取待发物料明细）
  issuePreview: async (outsourceWorkOrderId: number | string) => {
    return apiRequest(`/apps/kuaizhizao/outsource-work-orders/${outsourceWorkOrderId}/issue-preview`, { method: 'GET' });
  },

  // 批量创建委外发料单
  createBatch: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/outsource-material-issues/batch', { method: 'POST', data });
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

// 委外退料相关接口
export const outsourceMaterialReturnApi = {
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/outsource-material-returns', { method: 'GET', params });
  },
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/outsource-material-returns', { method: 'POST', data });
  },
  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/outsource-material-returns/${id}`, { method: 'GET' });
  },
  returnPreview: async (outsourceWorkOrderId: number | string) => {
    return apiRequest(
      `/apps/kuaizhizao/outsource-work-orders/${outsourceWorkOrderId}/material-return-preview`,
      { method: 'GET' },
    );
  },
};

// 委外退货相关接口
export const outsourceProductReturnApi = {
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/outsource-product-returns', { method: 'GET', params });
  },
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/outsource-product-returns', { method: 'POST', data });
  },
  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/outsource-product-returns/${id}`, { method: 'GET' });
  },
  returnPreview: async (outsourceWorkOrderId: number | string) => {
    return apiRequest(
      `/apps/kuaizhizao/outsource-work-orders/${outsourceWorkOrderId}/product-return-preview`,
      { method: 'GET' },
    );
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

  // 获取工单工序可委外数量
  getOutsourceOptions: async (workOrderId: string) => {
    return apiRequest(`/apps/kuaizhizao/work-orders/${workOrderId}/outsource-options`, { method: 'GET' });
  },

  // 关联采购入库单
  linkPurchaseReceipt: async (outsourceOrderId: string, purchaseReceiptId: number) => {
    return apiRequest(`/apps/kuaizhizao/outsource-orders/${outsourceOrderId}/link-purchase-receipt`, {
      method: 'POST',
      params: { purchase_receipt_id: purchaseReceiptId },
    });
  },
};

// 财务协同相关接口
export const financeApi = {
  // 应付单（已迁至 kuaicaiwu）
  payable: {
    list: async (params?: any) => apiRequest('/apps/kuaicaiwu/payables', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaicaiwu/payables', { method: 'POST', data }),
    get: async (id: string) => apiRequest(`/apps/kuaicaiwu/payables/${id}`, { method: 'GET' }),
    recordPayment: async (id: string, data: any) => apiRequest(`/apps/kuaicaiwu/payables/${id}/payment`, { method: 'POST', data }),
  },

  // 采购发票（已迁至 kuaicaiwu）
  purchaseInvoice: {
    list: async (params?: any) => apiRequest('/apps/kuaicaiwu/purchase-invoices', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaicaiwu/purchase-invoices', { method: 'POST', data }),
    get: async (id: string) => apiRequest(`/apps/kuaicaiwu/purchase-invoices/${id}`, { method: 'GET' }),
    approve: async (id: string, data?: any) => apiRequest(`/apps/kuaicaiwu/purchase-invoices/${id}/approve`, { method: 'POST', data }),
  },

  // 应收单（已迁至 kuaicaiwu）
  receivable: {
    list: async (params?: any) => apiRequest('/apps/kuaicaiwu/receivables', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaicaiwu/receivables', { method: 'POST', data }),
    get: async (id: string) => apiRequest(`/apps/kuaicaiwu/receivables/${id}`, { method: 'GET' }),
    recordReceipt: async (id: string, data: any) => apiRequest(`/apps/kuaicaiwu/receivables/${id}/receipt`, { method: 'POST', data }),
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

// 排程配置相关接口
export const schedulingConfigApi = {
  list: async (params?: { skip?: number; limit?: number; is_active?: boolean }) => {
    return apiRequest('/apps/kuaizhizao/scheduling-configs', { method: 'GET', params });
  },
  getDefault: async () => {
    return apiRequest('/apps/kuaizhizao/scheduling-configs/default', { method: 'GET' });
  },
  upsertDefault: async (constraints: SchedulingConstraints) => {
    return apiRequest('/apps/kuaizhizao/scheduling-configs/default', { method: 'PUT', data: constraints });
  },
  get: async (id: number) => {
    return apiRequest(`/apps/kuaizhizao/scheduling-configs/${id}`, { method: 'GET' });
  },
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/scheduling-configs', { method: 'POST', data });
  },
  update: async (id: number, data: any) => {
    return apiRequest(`/apps/kuaizhizao/scheduling-configs/${id}`, { method: 'PUT', data });
  },
  delete: async (id: number) => {
    return apiRequest(`/apps/kuaizhizao/scheduling-configs/${id}`, { method: 'DELETE' });
  },
};

export const visualSchedulingApi = {
  boardScan: async (params?: {
    work_order_ids?: number[];
    work_center_id?: number;
    horizon_days?: number;
    plan_date?: string;
  }) => {
    const query: Record<string, string | number> = {};
    if (params?.horizon_days != null) query.horizon_days = params.horizon_days;
    if (params?.work_center_id != null) query.work_center_id = params.work_center_id;
    if (params?.work_order_ids?.length) query.work_order_ids = params.work_order_ids.join(',');
    if (params?.plan_date) query.plan_date = params.plan_date;
    return apiRequest<VisualSchedulingBoardScan>('/apps/kuaizhizao/scheduling/board-scan', {
      method: 'GET',
      params: query,
    });
  },
  validateAdjustments: async (data: {
    work_order_updates?: Array<{
      work_order_id: number;
      planned_start_date: string;
      planned_end_date: string;
    }>;
    operation_updates?: Array<{
      operation_id: number;
      planned_start_date: string;
      planned_end_date: string;
    }>;
    operation_station_updates?: Array<{ operation_id: number; assigned_station_id: number }>;
  }) => {
    return apiRequest<{ valid: boolean; conflicts: VisualSchedulingConflict[]; conflict_count: number }>(
      '/apps/kuaizhizao/scheduling/validate-adjustments',
      { method: 'POST', data }
    );
  },
};
