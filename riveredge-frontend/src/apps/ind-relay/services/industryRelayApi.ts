import { apiRequest } from '../../../services/api';

export type RelayLineCapacity = {
  id: number;
  production_line_id: number;
  production_line_code?: string | null;
  production_line_name?: string | null;
  takt_seconds: number;
  daily_capacity_qty: number;
  changeover_minutes_default: number;
  is_active: boolean;
  remarks?: string | null;
};

export type RelayChangeover = {
  id: number;
  from_family: string;
  to_family: string;
  changeover_minutes: number;
  forbid_same_line: boolean;
  remarks?: string | null;
};

export type RelayLineOutput = {
  production_line_id: number;
  production_line_code?: string | null;
  production_line_name?: string | null;
  daily_capacity_qty: number;
  planned_quantity?: number;
  output_qualified: number;
  achievement_rate: number;
  plan_achievement_rate?: number;
};

export type RelayModuleStatus = {
  output_basis: string;
  resource_mode: string;
  line_exclusive: boolean;
  host_defaults_applied: boolean;
  tables_ready: boolean;
  line_capacity_count: number;
  changeover_count: number;
  hints?: string[];
};

export const industryRelayApi = {
  getStatus: () => apiRequest<RelayModuleStatus>('/apps/ind-relay/status', { method: 'GET' }),
  reapplyDefaults: () =>
    apiRequest<RelayModuleStatus>('/apps/ind-relay/status/reapply-defaults', { method: 'POST' }),
  listLineCapacities: () =>
    apiRequest<RelayLineCapacity[]>('/apps/ind-relay/line-capacities', { method: 'GET' }),
  createLineCapacity: (data: {
    production_line_id: number;
    takt_seconds?: number;
    daily_capacity_qty?: number;
    changeover_minutes_default?: number;
    remarks?: string;
  }) =>
    apiRequest<RelayLineCapacity>('/apps/ind-relay/line-capacities', { method: 'POST', data }),
  updateLineCapacity: (
    id: number,
    data: {
      takt_seconds?: number;
      daily_capacity_qty?: number;
      changeover_minutes_default?: number;
      is_active?: boolean;
      remarks?: string;
    }
  ) =>
    apiRequest<RelayLineCapacity>(`/apps/ind-relay/line-capacities/${id}`, {
      method: 'PATCH',
      data,
    }),
  listChangeovers: () =>
    apiRequest<RelayChangeover[]>('/apps/ind-relay/changeovers', { method: 'GET' }),
  createChangeover: (data: {
    from_family: string;
    to_family: string;
    changeover_minutes?: number;
    forbid_same_line?: boolean;
    remarks?: string;
  }) => apiRequest<RelayChangeover>('/apps/ind-relay/changeovers', { method: 'POST', data }),
  updateChangeover: (
    id: number,
    data: {
      changeover_minutes?: number;
      forbid_same_line?: boolean;
      remarks?: string;
    }
  ) =>
    apiRequest<RelayChangeover>(`/apps/ind-relay/changeovers/${id}`, { method: 'PATCH', data }),
  deleteChangeover: (id: number) =>
    apiRequest<{ ok: boolean }>(`/apps/ind-relay/changeovers/${id}`, { method: 'DELETE' }),
  listLineOutput: (params?: { date_start?: string; date_end?: string }) =>
    apiRequest<RelayLineOutput[]>('/apps/ind-relay/line-output', { method: 'GET', params }),
};
