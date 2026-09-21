/**
 * 报工与物料绑定 API
 */

import { apiRequest } from '../../../services/api';

/** 报工统计（用于指标卡片） */
export interface ReportingOverviewStatistics {
  cumulative_hours?: number;
  estimated_wages?: number;
  downtime_records?: number;
  exception_reports?: number;
  efficiency?: number;
  // 趋势数据
  trends?: {
    hours?: number[];
    wages?: number[];
    efficiency?: number[];
  };
  /** 效率同比（百分比指示，如 5 表示 +5%） */
  efficiency_yoy?: number;
}

/** 报工统计（用于统计分析页） */
export interface ReportingDetailedStatistics {
  total_count: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  total_reported_quantity: number;
  total_qualified_quantity: number;
  total_unqualified_quantity: number;
  total_work_hours: number;
  cumulative_hours?: number;
  estimated_wages?: number;
  qualification_rate: number;
  first_pass_yield_rate?: number;
  unqualified_rate: number;
  avg_quantity_per_hour: number;
  efficiency?: number;
  operation_stats: Array<{
    operation_name: string;
    count: number;
    reported_quantity: number;
    qualified_quantity: number;
    work_hours: number;
    qualification_rate: number;
    first_pass_yield_rate?: number;
  }>;
  worker_stats: Array<{
    worker_name: string;
    count: number;
    reported_quantity: number;
    qualified_quantity: number;
    work_hours: number;
    qualification_rate: number;
    first_pass_yield_rate?: number;
  }>;
  trends?: {
    hours?: number[];
    wages?: number[];
    efficiency?: number[];
  };
}

export interface ReportingRecord {
  id?: number;
  work_order_id?: number;
  work_order_code?: string;
  work_order_name?: string;
  operation_name?: string;
  worker_name?: string;
  recorded_by_name?: string;
  reported_quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  work_hours?: number;
  work_start_time?: string;
  work_end_time?: string;
  status?: string;
  reported_at?: string;
  created_at?: string;
  post_action_notices?: Array<{
    level?: 'info' | 'warning' | 'success';
    code?: string;
    receipt_code?: string | null;
  }>;
  [key: string]: unknown;
}

export interface ReportingListParams {
  skip?: number;
  limit?: number;
  work_order_code?: string;
  work_order_name?: string;
  operation_name?: string;
  worker_name?: string;
  status?: string;
  keyword?: string;
  reported_at_start?: string;
  reported_at_end?: string;
  order_by?: string;
}

export interface ReportingListResponse {
  data: ReportingRecord[];
  total: number;
  success: boolean;
}

/** 报工加载源（工单工序）候选行 */
export interface ReportingPullCandidate {
  pull_row_key: string;
  work_order_id: number;
  code?: string;
  name?: string | null;
  product_name?: string | null;
  quantity?: number;
  planned_start_date?: string | null;
  operation_id: number;
  operation_code?: string | null;
  operation_name?: string | null;
  operation_sequence?: number | null;
  reporting_type?: string | null;
  reportable_quantity_cap?: number;
  reportable_quantity_pushed?: number;
  reportable_quantity_max?: number;
}

export interface ReportingPullCandidateListResponse {
  data: ReportingPullCandidate[];
  total: number;
  success?: boolean;
}

export const reportingApi = {
  listPullCandidates: async (params?: {
    keyword?: string;
    work_order_code?: string;
    /** reportable=仅可报工（默认）；all=全部 */
    scope?: 'reportable' | 'all' | string;
    skip?: number;
    limit?: number;
  }): Promise<ReportingPullCandidateListResponse> => {
    const raw = await apiRequest<ReportingPullCandidateListResponse>(
      '/apps/kuaizhizao/reporting/pull-candidates',
      { method: 'GET', params },
    );
    const rows = Array.isArray(raw?.data) ? raw.data : [];
    return {
      data: rows,
      total: Number(raw?.total ?? rows.length) || 0,
      success: raw?.success !== false,
    };
  },
  list: async (params?: ReportingListParams): Promise<ReportingListResponse> => {
    const raw = await apiRequest<ReportingListResponse | ReportingRecord[]>('/apps/kuaizhizao/reporting', {
      method: 'GET',
      params,
    });
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
  create: async (data: any) => apiRequest('/apps/kuaizhizao/reporting', { method: 'POST', data }),
  quickCreate: async (data: any) => apiRequest('/apps/kuaizhizao/reporting/quick', { method: 'POST', data }),
  update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/reporting/${id}`, { method: 'PUT', data }),
  delete: async (id: string) => apiRequest(`/apps/kuaizhizao/reporting/${id}`, { method: 'DELETE' }),
  get: async (id: string) => apiRequest(`/apps/kuaizhizao/reporting/${id}`, { method: 'GET' }),
  approve: async (id: string, data?: any, params?: { rejection_reason?: string }) =>
    apiRequest(`/apps/kuaizhizao/reporting/${id}/approve`, { method: 'POST', data: data || {}, params }),
  revoke: async (id: string) =>
    apiRequest(`/apps/kuaizhizao/reporting/${id}/revoke`, { method: 'POST' }),
  batchRevoke: async (ids: string[]) =>
    apiRequest('/apps/kuaizhizao/reporting/batch-revoke', { method: 'POST', data: { record_ids: ids.map(Number) } }),
  getStatistics: async (params?: any) =>
    apiRequest<ReportingDetailedStatistics>('/apps/kuaizhizao/reporting/statistics', { method: 'GET', params }),
  recordScrap: async (recordId: string, data: any) =>
    apiRequest(`/apps/kuaizhizao/reporting/${recordId}/scrap`, { method: 'POST', data }),
  recordDefect: async (recordId: string, data: any) =>
    apiRequest(`/apps/kuaizhizao/reporting/${recordId}/defect`, { method: 'POST', data }),
  correct: async (recordId: string, data: any) => {
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

export type ReportingSyncSourceType = 'api' | 'dataset';

export interface ReportingSyncBinding {
  source_type?: ReportingSyncSourceType | null;
  api_uuid?: string | null;
  dataset_uuid?: string | null;
  field_mapping: Record<string, string>;
  match_key_field?: string;
  sync_direction?: string;
  sync_mode?: string;
  schedule_interval_minutes?: number;
  last_success_at?: string | null;
  last_attempt_at?: string | null;
  last_error?: string | null;
}

export interface ReportingSyncFromSourcePayload {
  source_type?: ReportingSyncSourceType;
  api_uuid?: string;
  dataset_uuid?: string;
  field_mapping?: Record<string, string>;
  save_binding?: boolean;
  skip_prerequisite_syncs?: boolean;
  sync_direction?: 'pull' | 'push' | 'bidirectional';
  sync_mode?: string;
  schedule_interval_minutes?: number;
  incremental?: boolean;
  active_only?: boolean;
}

export interface ReportingSyncFromSourceResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
  fetched?: number;
  mode?: string;
}

export async function getReportingSyncBinding(): Promise<ReportingSyncBinding> {
  return apiRequest<ReportingSyncBinding>('/apps/kuaizhizao/reporting/sync-binding');
}

export async function syncReportingFromSource(
  payload: ReportingSyncFromSourcePayload,
  onProgress?: (message: string) => void,
): Promise<ReportingSyncFromSourceResult> {
  const { apiRequestSyncNdjson } = await import(
    '../../../components/sync-from-source-modal/apiRequestSyncNdjson'
  );
  return apiRequestSyncNdjson<ReportingSyncFromSourceResult>(
    '/apps/kuaizhizao/reporting/sync-from-source',
    {
      data: payload,
      timeoutMs: 600_000,
      onProgress,
    },
  );
}

/** 同步运行历史（来自 core_sync_run_logs，只读） */
export interface ReportingSyncHistoryItem {
  id: number;
  entity_type: string;
  mode: 'full' | 'incremental' | string;
  status: 'success' | 'partial' | 'failed' | string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  fetched: number;
  truncated: boolean;
  duration_ms: number;
  error_summary?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at?: string | null;
}

export interface ReportingSyncHistoryListResponse {
  data: ReportingSyncHistoryItem[];
  total: number;
  success: boolean;
}

/** 分页拉取报工同步运行历史（只读） */
export async function getReportingSyncHistory(params?: {
  skip?: number;
  limit?: number;
}): Promise<ReportingSyncHistoryListResponse> {
  const raw = await apiRequest<ReportingSyncHistoryListResponse>(
    '/apps/kuaizhizao/reporting/sync-history',
    { method: 'GET', params },
  );
  const rows = Array.isArray(raw?.data) ? raw.data : [];
  return {
    data: rows,
    total: Number(raw?.total ?? rows.length) || 0,
    success: raw?.success !== false,
  };
}

/** 报工统计快捷函数（采用 useQuery） */
export const getReportingStatistics = async () =>
  apiRequest<ReportingOverviewStatistics>('/apps/kuaizhizao/reporting/overview-statistics', { method: 'GET' });

export const materialBindingApi = {
  createFeeding: async (recordId: string, data: any) =>
    apiRequest(`/apps/kuaizhizao/reporting/${recordId}/material-binding/feeding`, { method: 'POST', data }),
  createDischarging: async (recordId: string, data: any) =>
    apiRequest(`/apps/kuaizhizao/reporting/${recordId}/material-binding/discharging`, { method: 'POST', data }),
  getByReportingRecord: async (recordId: string) =>
    apiRequest(`/apps/kuaizhizao/reporting/${recordId}/material-binding`, { method: 'GET' }),
  delete: async (bindingId: string) =>
    apiRequest(`/apps/kuaizhizao/material-binding/${bindingId}`, { method: 'DELETE' }),
};
