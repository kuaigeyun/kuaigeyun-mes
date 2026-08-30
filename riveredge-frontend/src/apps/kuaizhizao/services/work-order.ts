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
  /** 报工数量默认：reportable=本次可报，zero=0 */
  default_reporting_quantity_mode?: string;
  /** 组织是否启用成品检验环节 */
  fqc_stage_enabled?: boolean;
  /** 组织是否启用成品检验模块 */
  fqc_module_enabled?: boolean;
  /** 成品检验合格才入库 */
  require_fqc_before_finished_goods_receipt?: boolean;
  /** 工单列表是否展示客户名称并可按客户筛选 */
  show_customer_name?: boolean;
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

export type WorkOrderEsopStep = {
  id: string;
  type?: string;
  title: string;
  description?: string | null;
  key_points?: string | null;
  attachment_uuids?: string[];
};

export type WorkOrderEsopFileItem = {
  key: string;
  name: string;
  file_uuid?: string | null;
  url?: string | null;
  source: string;
};

export type WorkOrderEsopDocument = {
  uuid: string;
  name?: string | null;
  version?: string | null;
  current_revision?: string | null;
  carrier?: string | null;
  storage_location?: string | null;
  content?: string | null;
  steps?: WorkOrderEsopStep[];
  attachments?: WorkOrderEsopFileItem[];
};

export type WorkOrderOperationDocuments = {
  work_order_id: number;
  operation_id: number;
  sop?: WorkOrderEsopDocument | null;
  esop_available?: boolean;
};

export type WorkOrderOperationEsopItem = {
  work_order_operation_id: number;
  master_operation_id?: number | null;
  sequence?: number | null;
  operation_name?: string | null;
  operation_code?: string | null;
  sops?: WorkOrderEsopDocument[];
};

export type WorkOrderRelatedEsops = {
  work_order_id: number;
  shared_sops?: WorkOrderEsopDocument[];
  operations?: WorkOrderOperationEsopItem[];
};

export const workOrderApi = {
  list: async (params?: any) => apiRequest('/apps/kuaizhizao/work-orders', { method: 'GET', params }),
  create: async (data: any) => apiRequest('/apps/kuaizhizao/work-orders', { method: 'POST', data }),
  update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/work-orders/${id}`, { method: 'PUT', data }),
  delete: async (id: string) => apiRequest(`/apps/kuaizhizao/work-orders/${id}`, { method: 'DELETE' }),
  get: async (id: string) => apiRequest(`/apps/kuaizhizao/work-orders/${id}`, { method: 'GET' }),
  release: async (id: string, options?: { ignoreShortage?: boolean }) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${id}/release`, {
      method: 'POST',
      params: options?.ignoreShortage ? { ignore_shortage: true } : undefined,
    }),
  revoke: async (id: string) => apiRequest(`/apps/kuaizhizao/work-orders/${id}/revoke`, { method: 'POST' }),
  withdrawManualComplete: async (id: string) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${id}/withdraw-manual-complete`, { method: 'POST' }),
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
  unsplit: async (id: string) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${id}/unsplit`, { method: 'POST' }),
  getOperations: async (id: string, options?: { includeMeta?: boolean }) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${id}/operations`, {
      method: 'GET',
      params: options?.includeMeta ? { include_meta: true } : undefined,
    }),
  getOperationDocuments: async (workOrderId: string | number, operationId: string | number) =>
    apiRequest<WorkOrderOperationDocuments>(
      `/apps/kuaizhizao/work-orders/${workOrderId}/operations/${operationId}/documents`,
      { method: 'GET' },
    ),
  getRelatedEsops: async (workOrderId: string | number) =>
    apiRequest<WorkOrderRelatedEsops>(
      `/apps/kuaizhizao/work-orders/${workOrderId}/related-esops`,
      { method: 'GET' },
    ),
  updateOperations: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/work-orders/${id}/operations`, { method: 'PUT', data }),
  startOperation: async (workOrderId: string, operationId: number) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${workOrderId}/operations/${operationId}/start`, { method: 'POST' }),
  withdrawOperationStart: async (workOrderId: string, operationId: number) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${workOrderId}/operations/${operationId}/withdraw-start`, {
      method: 'POST',
    }),
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
  batchUpdateOperationAssignments: async (
    updates: Array<{
      operation_id: number;
      assigned_worker_id?: number | null;
      assigned_team_id?: number | null;
      assigned_equipment_id?: number | null;
      assigned_mold_id?: number | null;
      assigned_tool_id?: number | null;
    }>
  ) =>
    apiRequest<{ updated: number[]; skipped_frozen: number[]; failed: Array<{ id: number; reason: string }> }>(
      '/apps/kuaizhizao/work-orders/batch-update-operation-assignments',
      { method: 'PUT', data: { updates } }
    ),
  schedulingQuickAction: async (data: {
    work_order_ids: number[];
    action: 'confirm_delay' | 'to_exception' | 'apply_unfreeze' | 'reschedule_forward';
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

  /** 提醒仓库线边备料（站内信 + 生成/同步备料草稿） */
  remindBatching: async (
    id: string | number,
    data: { recipient_user_uuids: string[]; remarks?: string },
  ) =>
    apiRequest<{
      success: boolean
      message: string
      notified_count: number
      batching_order_id?: number
      batching_order_code?: string
    }>(`/apps/kuaizhizao/work-orders/${id}/remind-batching`, { method: 'POST', data }),

  /** 工单物料移动（库存流水 / 单据兜底） */
  getMaterialMovements: async (id: string | number, params?: { limit?: number }) =>
    apiRequest<{
      work_order_id: number
      total: number
      source_mode: 'ledger' | 'document' | 'mixed'
      items: Array<{
        id?: number
        source: 'ledger' | 'document'
        movement_type: string
        material_id?: number
        material_code?: string
        material_name?: string
        batch_no?: string
        quantity: number | string
        from_warehouse_name?: string
        to_warehouse_name?: string
        source_doc_type?: string
        source_doc_id?: number
        source_doc_code?: string
        operator_name?: string
        remark?: string
        occurred_at?: string
      }>
    }>(`/apps/kuaizhizao/work-orders/${id}/material-movements`, { method: 'GET', params }),

  /** 工单物料履历（采购申请→订单→收货通知→来料检验→采购入库 + 库存移动，时间正序） */
  getMaterialHistory: async (id: string | number, params?: { limit?: number }) =>
    apiRequest<{
      work_order_id: number
      total: number
      source_mode: 'ledger' | 'document' | 'mixed'
      /** BOM/组件物料左栏；无履历事件的物料也会返回 */
      materials?: Array<{
        material_id: number
        material_code?: string
        material_name?: string
        material_spec?: string
      }>
      items: Array<{
        id?: number
        source: 'ledger' | 'document'
        movement_type: string
        material_id?: number
        material_code?: string
        material_name?: string
        material_spec?: string
        batch_no?: string
        quantity: number | string
        from_warehouse_name?: string
        to_warehouse_name?: string
        source_doc_type?: string
        source_doc_id?: number
        source_doc_code?: string
        operator_name?: string
        remark?: string
        occurred_at?: string
      }>
    }>(`/apps/kuaizhizao/work-orders/${id}/material-history`, { method: 'GET', params }),

  /** 工单下推生产领料预览 */
  previewPushProductionPicking: async (id: number | string) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${id}/push-production-picking/preview`, { method: 'GET' }),

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

export interface ReworkOrderListParams {
  skip?: number;
  limit?: number;
  code?: string;
  status?: string;
  original_work_order_id?: number;
  original_work_order_code?: string;
  product_name?: string;
  rework_type?: string;
  keyword?: string;
  planned_start_from?: string;
  planned_start_to?: string;
  created_start_date?: string;
  created_end_date?: string;
  order_by?: string;
}

export interface ReworkOrderListResponse {
  data: Record<string, unknown>[];
  total: number;
  success: boolean;
}

export const reworkOrderApi = {
  list: async (params?: ReworkOrderListParams): Promise<ReworkOrderListResponse> => {
    const raw = await apiRequest<ReworkOrderListResponse | Record<string, unknown>[]>(
      '/apps/kuaizhizao/rework-orders',
      { method: 'GET', params },
    );
    if (Array.isArray(raw)) {
      return { data: raw, total: raw.length, success: true };
    }
    const rows = raw?.data ?? [];
    return {
      data: rows,
      total: raw?.total ?? rows.length,
      success: raw?.success !== false,
    };
  },
  create: async (data: any) => apiRequest('/apps/kuaizhizao/rework-orders', { method: 'POST', data }),
  update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/rework-orders/${id}`, { method: 'PUT', data }),
  delete: async (id: string) => apiRequest(`/apps/kuaizhizao/rework-orders/${id}`, { method: 'DELETE' }),
  get: async (id: string) => apiRequest(`/apps/kuaizhizao/rework-orders/${id}`, { method: 'GET' }),
  createFromWorkOrder: async (workOrderId: string, data: any) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${workOrderId}/rework`, { method: 'POST', data }),
  previewFromWorkOrder: async (
    workOrderId: string,
    params?: { start_work_order_operation_id?: number },
  ) =>
    apiRequest<{ reworkable_quantity: number; unqualified_quantity: number; already_rework_quantity: number }>(
      `/apps/kuaizhizao/work-orders/${workOrderId}/rework-preview`,
      { method: 'GET', params },
    ),
  getReportingOptions: async (id: string) =>
    apiRequest(`/apps/kuaizhizao/rework-orders/${id}/reporting-options`, { method: 'GET' }),
  report: async (id: string, data: any) =>
    apiRequest(`/apps/kuaizhizao/rework-orders/${id}/report`, { method: 'POST', data }),
  release: async (id: string) =>
    apiRequest(`/apps/kuaizhizao/rework-orders/${id}/release`, { method: 'POST' }),
  advanceNext: async (id: string, data: any) =>
    apiRequest(`/apps/kuaizhizao/rework-orders/${id}/advance-next`, { method: 'POST', data }),
  requestComplete: async (id: string, data?: any) =>
    apiRequest(`/apps/kuaizhizao/rework-orders/${id}/request-complete`, { method: 'POST', data: data ?? {} }),
  qualityRelease: async (id: string, data?: any) =>
    apiRequest(`/apps/kuaizhizao/rework-orders/${id}/quality-release`, { method: 'POST', data: data ?? {} }),
  close: async (id: string, data?: any) =>
    apiRequest(`/apps/kuaizhizao/rework-orders/${id}/close`, { method: 'POST', data: data ?? {} }),
  cancel: async (id: string, data?: any) =>
    apiRequest(`/apps/kuaizhizao/rework-orders/${id}/cancel`, { method: 'POST', data: data ?? {} }),
  hold: async (id: string, data?: any) =>
    apiRequest(`/apps/kuaizhizao/rework-orders/${id}/hold`, { method: 'POST', data: data ?? {} }),
  resume: async (id: string) =>
    apiRequest(`/apps/kuaizhizao/rework-orders/${id}/resume`, { method: 'POST' }),
};

export type WorkOrderSyncSourceType = 'api' | 'dataset';

export interface WorkOrderSyncBinding {
  source_type?: WorkOrderSyncSourceType | null;
  api_uuid?: string | null;
  dataset_uuid?: string | null;
  field_mapping: Record<string, string>;
  match_key_field: string;
  sync_mode: string;
  schedule_interval_minutes?: number;
  last_success_at?: string | null;
  last_attempt_at?: string | null;
  last_error?: string | null;
}

export interface WorkOrderSyncFromSourcePayload {
  source_type?: WorkOrderSyncSourceType;
  api_uuid?: string;
  dataset_uuid?: string;
  field_mapping?: Record<string, string>;
  save_binding?: boolean;
  sync_mode?: string;
  schedule_interval_minutes?: number;
  incremental?: boolean;
  active_only?: boolean;
  skip_prerequisite_syncs?: boolean;
}

export interface WorkOrderSyncFromSourceResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export async function getWorkOrderSyncBinding(): Promise<WorkOrderSyncBinding> {
  return apiRequest<WorkOrderSyncBinding>('/apps/kuaizhizao/work-orders/sync-binding');
}

export async function syncWorkOrdersFromSource(
  payload: WorkOrderSyncFromSourcePayload,
): Promise<WorkOrderSyncFromSourceResult> {
  return apiRequest<WorkOrderSyncFromSourceResult>('/apps/kuaizhizao/work-orders/sync-from-source', {
    method: 'POST',
    data: payload,
    timeoutMs: 600_000,
  });
}
