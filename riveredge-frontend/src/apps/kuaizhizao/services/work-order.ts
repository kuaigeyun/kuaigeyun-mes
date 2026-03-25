/**
 * 工单与返工单 API
 */

import { apiRequest } from '../../../services/api';

/** 趋势数据项（用于折线图） */
export interface WorkOrderTrendItem {
  date: string;
  value: number;
}

/** 工单统计（用于指标卡片） */
export interface WorkOrderStatistics {
  in_progress_count: number;
  completed_today_count: number;
  overdue_count: number;
  draft_count: number;
  completed_count: number;
  qualified_output_today?: number;
  /** 今日合格率（%） */
  qualified_rate_today?: number;
  /** 今日工序完成数量（报工记录数） */
  operation_completed_today?: number;
  total_wip?: number;
  first_pass_yield?: number;
  plan_achievement_rate?: number;
  manufacturing_lead_time?: number;
  trend_completed?: WorkOrderTrendItem[];
  trend_output?: WorkOrderTrendItem[];
  trend_yield?: WorkOrderTrendItem[];
  trend_operation_count?: WorkOrderTrendItem[];
  /** 近7天在制品数（当前值填充，用于折线图） */
  trend_wip?: WorkOrderTrendItem[];
  /** 近7天逾期工单数 */
  trend_overdue?: WorkOrderTrendItem[];
  /** 近7天待下达工单数 */
  trend_draft?: WorkOrderTrendItem[];
  /** 昨日完成工单数（用于较昨日对比） */
  yesterday_completed_count?: number;
  /** 昨日工序完成数 */
  yesterday_operation_count?: number;
  /** 昨日合格产出 */
  yesterday_qualified_output?: number;
  /** 昨日合格率（%） */
  yesterday_qualified_rate?: number;
  /** 昨日在制品数 */
  yesterday_wip?: number;
  /** 昨日逾期数 */
  yesterday_overdue_count?: number;
  /** 昨日待下达数 */
  yesterday_draft_count?: number;
  trends?: {
    output?: number[];
    completed?: number[];
    wip?: number[];
    yield?: number[];
    operation_count?: number[];
  };
  yield_yoy?: number;
}

export async function getWorkOrderStatistics(): Promise<WorkOrderStatistics> {
  return apiRequest<WorkOrderStatistics>('/apps/kuaizhizao/work-orders/statistics', { method: 'GET' });
}

export interface WorkOrderExecutionConfig {
  picking_issue_strategy: string;
  picking_confirm_warehouse_only: boolean;
  require_confirmed_picking_before_operation_start: boolean;
  require_confirmed_picking_before_reporting: boolean;
  current_user_can_confirm_picking: boolean;
}

export const workOrderApi = {
  list: async (params?: any) => apiRequest('/apps/kuaizhizao/work-orders', { method: 'GET', params }),
  create: async (data: any) => apiRequest('/apps/kuaizhizao/work-orders', { method: 'POST', data }),
  update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/work-orders/${id}`, { method: 'PUT', data }),
  delete: async (id: string) => apiRequest(`/apps/kuaizhizao/work-orders/${id}`, { method: 'DELETE' }),
  get: async (id: string) => apiRequest(`/apps/kuaizhizao/work-orders/${id}`, { method: 'GET' }),
  release: async (id: string) => apiRequest(`/apps/kuaizhizao/work-orders/${id}/release`, { method: 'POST' }),
  revoke: async (id: string) => apiRequest(`/apps/kuaizhizao/work-orders/${id}/revoke`, { method: 'POST' }),
  complete: async (id: string) => apiRequest(`/apps/kuaizhizao/work-orders/${id}/complete`, { method: 'POST' }),
  split: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/work-orders/${id}/split`, { method: 'POST', data }),
  getOperations: async (id: string) => apiRequest(`/apps/kuaizhizao/work-orders/${id}/operations`, { method: 'GET' }),
  updateOperations: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/work-orders/${id}/operations`, { method: 'PUT', data }),
  startOperation: async (workOrderId: string, operationId: number) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${workOrderId}/operations/${operationId}/start`, { method: 'POST' }),
  dispatchOperation: async (workOrderId: string, operationId: number, data: any) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${workOrderId}/operations/${operationId}/dispatch`, { method: 'POST', data }),
  getExecutionConfig: async () =>
    apiRequest<WorkOrderExecutionConfig>('/apps/kuaizhizao/work-orders/execution-config', { method: 'GET' }),
  getPickingConfirmationStatus: async (workOrderId: string) =>
    apiRequest<{ work_order_id: number; has_confirmed_picking: boolean }>(
      `/apps/kuaizhizao/work-orders/${workOrderId}/picking-confirmation-status`,
      { method: 'GET' }
    ),
  checkShortage: async (workOrderId: string, warehouseId?: number) => {
    const res = await apiRequest<{
      has_shortage: boolean;
      shortage_items?: Array<{
        material_code: string;
        material_name: string;
        required_quantity: number;
        available_quantity: number;
      }>;
    }>(`/apps/kuaizhizao/work-orders/${workOrderId}/check-shortage`, {
      method: 'GET',
      params: warehouseId ? { warehouse_id: warehouseId } : undefined,
    });
    return {
      available: !res.has_shortage,
      missing_materials: (res.shortage_items || []).map((m) => ({
        material_code: m.material_code,
        material_name: m.material_name,
        required: m.required_quantity,
        available: m.available_quantity,
      })),
    };
  },
  freeze: async (id: string, data: { freeze_reason: string }) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${id}/freeze`, { method: 'POST', data }),
  unfreeze: async (id: string, data?: { unfreeze_reason?: string }) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${id}/unfreeze`, { method: 'POST', data: data || {} }),
  setPriority: async (id: string, data: { priority: string }) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${id}/priority`, { method: 'PUT', data }),
  batchSetPriority: async (data: { work_order_ids: number[]; priority: string }) =>
    apiRequest('/apps/kuaizhizao/work-orders/batch-priority', { method: 'PUT', data }),
  batchUpdateDates: async (updates: Array<{ work_order_id: number; planned_start_date: string; planned_end_date: string }>) =>
    apiRequest('/apps/kuaizhizao/work-orders/batch-update-dates', { method: 'PUT', data: { updates } }),
  batchUpdateOperationDates: async (
    updates: Array<{ operation_id: number; planned_start_date: string; planned_end_date: string }>
  ) =>
    apiRequest('/apps/kuaizhizao/work-orders/batch-update-operation-dates', { method: 'PUT', data: { updates } }),
  merge: async (data: { work_order_ids: number[]; remarks?: string }) =>
    apiRequest('/apps/kuaizhizao/work-orders/merge', { method: 'POST', data }),
  generateQRCode: async (workOrderId: string, workOrderCode: string, workOrderName: string): Promise<any> => {
    const { qrcodeApi } = await import('../../../services/qrcode');
    return qrcodeApi.generateWorkOrder({
      work_order_uuid: workOrderId,
      work_order_code: workOrderCode,
      material_code: workOrderName,
    });
  },
  getPrintUrl: (id: string, templateUuid?: string) => {
    const params = new URLSearchParams({ response_format: 'html' });
    if (templateUuid) params.set('template_uuid', templateUuid);
    return `/api/v1/apps/kuaizhizao/work-orders/${id}/print?${params}`;
  },
};

export const reworkOrderApi = {
  list: async (params?: any) => apiRequest('/apps/kuaizhizao/rework-orders', { method: 'GET', params }),
  create: async (data: any) => apiRequest('/apps/kuaizhizao/rework-orders', { method: 'POST', data }),
  update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/rework-orders/${id}`, { method: 'PUT', data }),
  delete: async (id: string) => apiRequest(`/apps/kuaizhizao/rework-orders/${id}`, { method: 'DELETE' }),
  get: async (id: string) => apiRequest(`/apps/kuaizhizao/rework-orders/${id}`, { method: 'GET' }),
  createFromWorkOrder: async (workOrderId: string, data: any) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${workOrderId}/rework`, { method: 'POST', data }),
};
