/**
 * 试流 API（R-08）
 */

import { api } from '../../../services/api';

const BASE = '/apps/kuaiplm/trial-flows';

export type TrialFlowBusinessType = 'component' | 'structure' | 'complete';
export type TrialFlowStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'in_progress'
  | 'concluded'
  | 'closed';

export interface TrialFlowMaterialLine {
  id?: number;
  uuid?: string;
  line_no?: number;
  material_id?: number | null;
  material_code: string;
  material_name: string;
  qty?: number | string | null;
  unit?: string | null;
  remarks?: string | null;
}

export interface TrialFlowStep {
  id: number;
  uuid: string;
  step_key: string;
  step_name: string;
  dept_code: string;
  sort_order: number;
  status: string;
  result?: string | null;
  result_notes?: string | null;
  step_description?: string | null;
  defect_rate?: number | null;
  filled_by_name?: string | null;
  filled_at?: string | null;
}

export interface TrialFlowFormProfileHeaderField {
  key: string;
  label: string;
  sort?: number;
  type?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface TrialFlowFormProfile {
  industry_profile_enabled?: boolean;
  field_labels: Record<string, string>;
  header_fields: TrialFlowFormProfileHeaderField[];
  step_templates: Record<string, Array<Record<string, unknown>>>;
  validation_rules: Array<Record<string, unknown>>;
}

export interface TrialFlow {
  uuid: string;
  id?: number;
  trial_code: string;
  project_id: number;
  project_code: string;
  project_name: string;
  business_type: TrialFlowBusinessType;
  title: string;
  status: TrialFlowStatus;
  current_step_key?: string | null;
  conclusion?: string | null;
  conclusion_summary?: string | null;
  remarks?: string | null;
  extension_payload?: Record<string, unknown> | null;
  materials?: TrialFlowMaterialLine[];
  steps?: TrialFlowStep[];
  created_at?: string;
  updated_at?: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
}

export interface TrialFlowPayload {
  project_id: number;
  business_type: TrialFlowBusinessType;
  title: string;
  remarks?: string | null;
  extension_payload?: Record<string, unknown> | null;
  materials?: TrialFlowMaterialLine[];
}

function unwrapList(res: unknown): { items: TrialFlow[]; total: number } {
  const r = (res || {}) as Record<string, unknown>;
  const items = (r.items ?? r.data ?? []) as TrialFlow[];
  return { items: Array.isArray(items) ? items : [], total: Number(r.total ?? items.length) };
}

export const trialFlowApi = {
  formProfile: async () => (await api.get(`${BASE}/meta/form-profile`)) as TrialFlowFormProfile,
  list: async (params: {
    skip?: number;
    limit?: number;
    keyword?: string;
    status?: string;
    business_type?: string;
    project_id?: number;
  }) => {
    const res = await api.get(BASE, { params });
    return unwrapList(res);
  },
  get: async (id: number) => (await api.get(`${BASE}/${id}`)) as TrialFlow,
  create: async (data: TrialFlowPayload) =>
    (await api.post(BASE, data)) as TrialFlow,
  update: async (id: number, data: Partial<TrialFlowPayload>) =>
    (await api.put(`${BASE}/${id}`, data)) as TrialFlow,
  submit: async (id: number) =>
    (await api.post(`${BASE}/${id}/submit`)) as TrialFlow,
  approve: async (id: number) =>
    (await api.post(`${BASE}/${id}/approve`)) as TrialFlow,
  reject: async (id: number) =>
    (await api.post(`${BASE}/${id}/reject`)) as TrialFlow,
  fillStep: async (
    id: number,
    stepKey: string,
    data: {
      result: string;
      result_notes?: string;
      step_description?: string;
      defect_rate?: number;
    },
  ) =>
    (await api.post(`${BASE}/${id}/steps/${stepKey}/fill`, data)) as TrialFlow,
  conclude: async (id: number, data: { conclusion: string; conclusion_summary?: string }) =>
    (await api.post(`${BASE}/${id}/conclude`, data)) as TrialFlow,
  close: async (id: number) =>
    (await api.post(`${BASE}/${id}/close`)) as TrialFlow,
  remove: async (id: number) => {
    await api.delete(`${BASE}/${id}`);
  },
};
