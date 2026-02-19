/**
 * 生产执行相关服务（聚合导出）
 * 具体实现已拆分至 work-order、reporting、warehouse-execution、quality-execution、planning 等子模块
 */

import { apiRequest } from '../../../services/api';

export { workOrderApi, reworkOrderApi } from './work-order';
export { reportingApi, materialBindingApi } from './reporting';
export { warehouseApi } from './warehouse-execution';
export { qualityApi } from './quality-execution';
export { planningApi } from './planning';

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
