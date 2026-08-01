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
  work_order_code?: string;
  work_order_name?: string;
  operation_name?: string;
  worker_name?: string;
  recorded_by_name?: string;
  reported_quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  work_hours?: number;
  status?: string;
  reported_at?: string;
  created_at?: string;
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
