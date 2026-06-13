import { apiRequest } from '../../../services/api';

export type RollingScheduleLine = {
  id: number;
  work_order_id: number;
  sequence: number;
  planned_quantity?: number | string | null;
  source_type: string;
  readiness_rate_snapshot?: number | string | null;
  remarks?: string | null;
  work_order_code?: string | null;
  work_order_name?: string | null;
  work_order_status?: string | null;
  quantity?: number | string | null;
  completed_quantity?: number | string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  scheduling_score?: number | null;
  scheduling_rank_band?: string | null;
};

export type RollingScheduleCloseSummary = {
  plan_date?: string;
  planned_count?: number;
  completed_count?: number;
  partial_count?: number;
  not_started_count?: number;
  planned_quantity?: number;
  completed_quantity?: number;
  completion_rate?: number;
  delayed_count?: number;
  incomplete_items?: Array<Record<string, unknown>>;
};

export type RollingScheduleCapacityAdvisory = {
  plan_date: string;
  daily_capacity_hours: number;
  station_count: number;
  available_hours: number;
  required_hours: number;
  utilization_rate: number;
  overloaded: boolean;
  message: string;
};

export type RollingSchedulePlan = {
  id: number;
  uuid: string;
  plan_code: string;
  plan_date: string;
  status: 'draft' | 'published' | 'closed' | string;
  prev_plan_date?: string | null;
  closed_at?: string | null;
  close_summary?: RollingScheduleCloseSummary | null;
  published_at?: string | null;
  published_by?: number | null;
  capacity_advisory?: RollingScheduleCapacityAdvisory | null;
  notes?: string | null;
  lines: RollingScheduleLine[];
};

export type RollingSchedulePublishResult = {
  plan: RollingSchedulePlan;
  batch_update: {
    updated?: number[];
    skipped_frozen?: number[];
    skipped_freeze_window?: number[];
    failed?: Array<{ id: number; reason: string }>;
  };
};

const BASE = '/apps/kuaizhizao/rolling-schedules';

export const rollingSchedulingApi = {
  getNextWorkday: (baseDate?: string) =>
    apiRequest<{ base_date: string; next_workday: string }>(`${BASE}/next-workday`, {
      method: 'GET',
      params: baseDate ? { base_date: baseDate } : undefined,
    }),

  getByDate: (planDate: string) =>
    apiRequest<RollingSchedulePlan>(`${BASE}/by-date/${planDate}`, { method: 'GET' }),

  closeDay: (planDate: string) =>
    apiRequest<RollingSchedulePlan>(`${BASE}/close-day`, {
      method: 'POST',
      data: { plan_date: planDate },
    }),

  generate: (data?: { base_date?: string; backlog_readiness_threshold?: number }) =>
    apiRequest<RollingSchedulePlan>(`${BASE}/generate`, { method: 'POST', data: data ?? {} }),

  updateLines: (
    planId: number,
    lines: Array<{
      work_order_id: number;
      sequence: number;
      planned_quantity?: number;
      source_type?: string;
      remarks?: string;
    }>,
  ) =>
    apiRequest<RollingSchedulePlan>(`${BASE}/${planId}/lines`, {
      method: 'PUT',
      data: { lines },
    }),

  publish: (planId: number) =>
    apiRequest<RollingSchedulePublishResult>(`${BASE}/${planId}/publish`, { method: 'POST' }),
};
