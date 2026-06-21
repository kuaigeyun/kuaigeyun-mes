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
  total_count?: number;
  in_progress_count: number;
  completed_today_count: number;
  overdue_count: number;
  draft_count: number;
  completed_count: number;
  completion_rate?: number;
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
  /** 末道工序自动入库：none | direct_inbound | inbound_notice */
  last_operation_auto_inbound_mode?: string;
  /** 报工生产人员默认：current_user | operation_assigned | auto */
  default_production_worker_mode?: string;
}

export interface WorkOrderGroupMember {
  id: number;
  code: string;
  product_id: number;
  product_code: string;
  product_name: string;
  quantity: number;
  status: string;
  group_role?: string;
  bom_parent_work_order_id?: number | null;
  supply_mode?: 'stocked' | 'direct' | string;
  readiness_rate?: number | null;
  kind: 'work_order' | 'outsource_work_order' | string;
}

export interface WorkOrderGroup {
  id: number;
  uuid: string;
  group_code: string;
  group_name?: string;
  root_demand_item_id: number;
  root_material_id: number;
  root_material_code: string;
  root_material_name: string;
  demand_computation_id: number;
  status: string;
  has_direct_supply: boolean;
  member_count: number;
  min_readiness_rate?: number | null;
  members: WorkOrderGroupMember[];
  created_at: string;
}

export interface WorkOrderSchedulingQuickActionResult {
  updated: number[];
  converted_to_exception: number[];
  unfreezed: number[];
  skipped: number[];
  failed: Array<{ id: number; reason: string }>;
}

export const workOrderApi = {
  list: async (params?: any) => apiRequest('/apps/kuaizhizao/work-orders', { method: 'GET', params }),
  create: async (data: any) => apiRequest('/apps/kuaizhizao/work-orders', { method: 'POST', data }),
  update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/work-orders/${id}`, { method: 'PUT', data }),
  delete: async (id: string) => apiRequest(`/apps/kuaizhizao/work-orders/${id}`, { method: 'DELETE' }),
  get: async (id: string) => apiRequest(`/apps/kuaizhizao/work-orders/${id}`, { method: 'GET' }),
  release: async (id: string) => apiRequest(`/apps/kuaizhizao/work-orders/${id}/release`, { method: 'POST' }),
  revoke: async (id: string) => apiRequest(`/apps/kuaizhizao/work-orders/${id}/revoke`, { method: 'POST' }),
  complete: async (id: string, data?: { confirmed_batch_no?: string; confirmed_serial_no?: string }) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${id}/complete`, { method: 'POST', data: data ?? {} }),
  confirmTracking: async (
    id: string,
    data: { confirmed_batch_no?: string; confirmed_serial_no?: string }
  ) => apiRequest(`/apps/kuaizhizao/work-orders/${id}/confirm-tracking`, { method: 'POST', data }),
  previewTracking: async (data: {
    product_id: number;
    quantity: number;
    batch_rule_id?: number;
    serial_rule_id?: number;
  }) =>
    apiRequest<{
      tracking_mode: string;
      planned_batch_no?: string;
      planned_serial_nos?: string[];
    }>('/apps/kuaizhizao/work-orders/tracking/preview', { method: 'POST', data }),
  split: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/work-orders/${id}/split`, { method: 'POST', data }),
  getOperations: async (id: string, options?: { includeMeta?: boolean }) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${id}/operations`, {
      method: 'GET',
      params: options?.includeMeta ? { include_meta: true } : undefined,
    }),
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
  getDefaultInboundWarehouse: async (workOrderId: string) =>
    apiRequest<{ warehouse_id: number | null; warehouse_name: string | null }>(
      `/apps/kuaizhizao/work-orders/${workOrderId}/default-inbound-warehouse`,
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
    apiRequest<import('./production').BatchUpdateResult>('/apps/kuaizhizao/work-orders/batch-update-dates', {
      method: 'PUT',
      data: { updates },
    }),
  batchUpdateOperationDates: async (
    updates: Array<{ operation_id: number; planned_start_date: string; planned_end_date: string }>
  ) =>
    apiRequest<import('./production').BatchUpdateResult>('/apps/kuaizhizao/work-orders/batch-update-operation-dates', {
      method: 'PUT',
      data: { updates },
    }),
  batchUpdateOperationStations: async (
    updates: Array<{ operation_id: number; assigned_station_id: number }>
  ) =>
    apiRequest<{ updated: number[]; skipped_frozen: number[]; failed: Array<{ id: number; reason: string }> }>(
      '/apps/kuaizhizao/work-orders/batch-update-operation-stations',
      { method: 'PUT', data: { updates } }
    ),
  schedulingQuickAction: async (data: {
    work_order_ids: number[];
    action: 'confirm_delay' | 'to_exception' | 'apply_unfreeze';
    reason?: string;
    auto_move_out_of_freeze_window?: boolean;
  }) =>
    apiRequest<WorkOrderSchedulingQuickActionResult>('/apps/kuaizhizao/work-orders/scheduling-quick-action', {
      method: 'POST',
      data,
    }),
  merge: async (data: { work_order_ids: number[]; remarks?: string }) =>
    apiRequest('/apps/kuaizhizao/work-orders/merge', { method: 'POST', data }),
  mergeIntoGroup: async (data: {
    work_order_ids: number[]
    root_work_order_id?: number | null
    remarks?: string
  }) =>
    apiRequest<{
      work_order_group_id: number
      group_code: string
      work_order_ids: number[]
      work_order_codes: string[]
    }>('/apps/kuaizhizao/work-orders/merge-into-group', { method: 'POST', data }),
  createPeerGroup: async (data: {
    group_name?: string
    production_mode?: string
    sales_order_id?: number
    planned_start_date?: string
    planned_end_date?: string
    items: Array<{
      product_id: number
      quantity: number
      priority?: string
      process_route_id?: number
      allow_operation_jump?: boolean
      over_report_mode?: string
      over_report_value?: number
    }>
  }) =>
    apiRequest<{
      work_order_group_id: number
      group_code: string
      work_order_ids: number[]
      work_order_codes: string[]
    }>('/apps/kuaizhizao/work-orders/create-peer-group', { method: 'POST', data }),
  dissolveGroup: async (data: { work_order_group_ids: number[] }) =>
    apiRequest<{
      groups: Array<{
        work_order_group_id: number
        group_code: string
        group_name?: string | null
        work_order_count: number
        outsource_count: number
      }>
    }>('/apps/kuaizhizao/work-orders/dissolve-group', { method: 'POST', data }),
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

  /** 获取工单齐套性分析 */
  getKittingAnalysis: async (id: string) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${id}/kitting-analysis`, { method: 'GET' }),

  getScoreConfig: async () =>
    apiRequest('/apps/kuaizhizao/work-orders/score-config', { method: 'GET' }),

  getScore: async (id: string, params?: { scenario?: string; refresh_if_stale?: boolean }) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${id}/scores`, { method: 'GET', params }),

  refreshScores: async (id: string, scenarios?: string[]) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${id}/scores/refresh`, {
      method: 'POST',
      params: scenarios ? { scenarios } : undefined,
    }),

  batchRefreshScores: async (data?: { work_order_ids?: number[]; scenarios?: string[] }) =>
    apiRequest('/apps/kuaizhizao/work-orders/scores/batch-refresh', { method: 'POST', data: data || {} }),
  listGroupsByComputation: async (computationId: number) =>
    apiRequest<WorkOrderGroup[]>('/apps/kuaizhizao/work-order-groups', {
      method: 'GET',
      params: { computation_id: computationId },
    }),
  getGroupDetail: async (groupId: number) =>
    apiRequest<WorkOrderGroup>(`/apps/kuaizhizao/work-order-groups/${groupId}`, { method: 'GET' }),
};

export const reworkOrderApi = {
  list: async (params?: any) => apiRequest('/apps/kuaizhizao/rework-orders', { method: 'GET', params }),
  create: async (data: any) => apiRequest('/apps/kuaizhizao/rework-orders', { method: 'POST', data }),
  update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/rework-orders/${id}`, { method: 'PUT', data }),
  delete: async (id: string) => apiRequest(`/apps/kuaizhizao/rework-orders/${id}`, { method: 'DELETE' }),
  get: async (id: string) => apiRequest(`/apps/kuaizhizao/rework-orders/${id}`, { method: 'GET' }),
  createFromWorkOrder: async (workOrderId: string, data: any) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${workOrderId}/rework`, { method: 'POST', data }),
  getReportingOptions: async (id: string) =>
    apiRequest(`/apps/kuaizhizao/rework-orders/${id}/reporting-options`, { method: 'GET' }),
  report: async (id: string, data: any) =>
    apiRequest(`/apps/kuaizhizao/rework-orders/${id}/report`, { method: 'POST', data }),
};
