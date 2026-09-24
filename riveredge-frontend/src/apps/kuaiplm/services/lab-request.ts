/**
 * 实验委托 API（R-02）
 */

import { api } from '../../../services/api';

const BASE = '/apps/kuaiplm/lab-requests';

export type LabRequestBusinessType =
  | 'iqc'
  | 'rd'
  | 'project_material'
  | 'project_product'
  | 'outsource'
  | 'general';

export type LabRequestStatus =
  | 'draft'
  | 'pending_review'
  | 'pending'
  | 'in_lab'
  | 'completed'
  | 'rejected'
  | 'revoked';

export type LabJudgment = 'pass' | 'fail' | 'ng' | 'na';

export interface LabRequestMeasureItem {
  id?: number;
  uuid?: string;
  lab_request_id?: number;
  line_no?: number;
  item_code?: string | null;
  item_name?: string;
  unit?: string | null;
  compare_type?: string;
  standard_min?: string | null;
  standard_max?: string | null;
  standard_value?: string | null;
  judgment_rule_id?: number | null;
  rule_version?: string | null;
  measured_value?: string | null;
  auto_judgment?: LabJudgment | string | null;
  judgment_snapshot?: Record<string, unknown> | null;
  manual_judgment?: LabJudgment | string | null;
  manual_reason?: string | null;
  manual_by_name?: string | null;
  final_judgment?: LabJudgment | string | null;
  quality_exception_id?: number | null;
  quality_exception_uuid?: string | null;
  exception_linked_at?: string | null;
  remarks?: string | null;
}

export interface LabRequest {
  id?: number;
  uuid?: string;
  code?: string;
  title?: string;
  business_type?: LabRequestBusinessType | string;
  status?: LabRequestStatus | string;
  priority?: string;
  project_id?: number | null;
  project_code?: string | null;
  material_id?: number | null;
  material_code?: string | null;
  material_name?: string | null;
  sample_desc?: string | null;
  test_items?: string | null;
  test_reason?: string | null;
  outsource_price?: number | string | null;
  price_filled_by?: number | null;
  price_filled_by_name?: string | null;
  price_filled_at?: string | null;
  requester_name?: string | null;
  lab_owner_name?: string | null;
  expected_complete_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  submitted_at?: string | null;
  accepted_at?: string | null;
  result_summary?: string | null;
  judgment?: string | null;
  report_url?: string | null;
  report_file_uuid?: string | null;
  report_status?: string | null;
  report_title?: string | null;
  report_submitted_at?: string | null;
  report_submitted_by_name?: string | null;
  report_approved_at?: string | null;
  report_approved_by_name?: string | null;
  report_rejected_at?: string | null;
  report_reject_reason?: string | null;
  remarks?: string | null;
  extension_payload?: Record<string, unknown> | null;
  reject_reason?: string | null;
  measure_items?: LabRequestMeasureItem[];
  has_ng?: boolean;
  created_by?: number;
  created_by_name?: string;
  updated_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export type LabMeasurePlanInput = {
  line_no?: number;
  item_code?: string;
  item_name: string;
  unit?: string;
  compare_type?: string;
  standard_min?: string;
  standard_max?: string;
  standard_value?: string;
  judgment_rule_id?: number | null;
  remarks?: string;
};

function unwrapList(res: unknown): { items: LabRequest[]; total: number } {
  const r = (res || {}) as Record<string, unknown>;
  const items = (r.items ?? r.data ?? []) as LabRequest[];
  return { items: Array.isArray(items) ? items : [], total: Number(r.total ?? items.length) };
}

export const labRequestApi = {
  list: async (params?: Record<string, unknown>) => {
    const res = await api.get(BASE, { params });
    return unwrapList(res);
  },
  get: async (id: string | number) => (await api.get(`${BASE}/${id}`)) as LabRequest,
  create: async (data: Partial<LabRequest> & { measure_items?: LabMeasurePlanInput[] }) =>
    (await api.post(BASE, data)) as LabRequest,
  update: async (
    id: string | number,
    data: Partial<LabRequest> & { measure_items?: LabMeasurePlanInput[] },
  ) => (await api.put(`${BASE}/${id}`, data)) as LabRequest,
  delete: async (id: string | number) => api.delete(`${BASE}/${id}`),
  submit: async (id: string | number) =>
    (await api.post(`${BASE}/${id}/submit`)) as LabRequest,
  approve: async (id: string | number) =>
    (await api.post(`${BASE}/${id}/approve`)) as LabRequest,
  fillOutsourcePrice: async (id: string | number, outsource_price: number | string) =>
    (await api.post(`${BASE}/${id}/fill-outsource-price`, { outsource_price })) as LabRequest,
  accept: async (id: string | number) =>
    (await api.post(`${BASE}/${id}/accept`)) as LabRequest,
  complete: async (
    id: string | number,
    data?: { result_summary?: string; judgment?: string; report_url?: string },
  ) => (await api.post(`${BASE}/${id}/complete`, data ?? {})) as LabRequest,
  reject: async (id: string | number, reason?: string) =>
    (await api.post(`${BASE}/${id}/reject`, { reason })) as LabRequest,
  revoke: async (id: string | number, reason: string) =>
    (await api.post(`${BASE}/${id}/revoke`, { reason })) as LabRequest,
  replaceMeasurePlan: async (id: string | number, items: LabMeasurePlanInput[]) =>
    (await api.put(`${BASE}/${id}/measure-plan`, { items })) as LabRequest,
  saveMeasures: async (
    id: string | number,
    items: Array<{ id: number; measured_value?: string | null }>,
  ) => (await api.put(`${BASE}/${id}/measures`, { items })) as LabRequest,
  overrideMeasure: async (
    id: string | number,
    itemId: number,
    data: { judgment: string; reason: string },
  ) => (await api.post(`${BASE}/${id}/measure-items/${itemId}/override`, data)) as LabRequest,
  saveReport: async (
    id: string | number,
    data: {
      report_title?: string;
      result_summary?: string;
      report_url?: string;
      report_file_uuid?: string;
    },
  ) => (await api.put(`${BASE}/${id}/report`, data)) as LabRequest,
  submitReport: async (
    id: string | number,
    data?: {
      report_title?: string;
      result_summary?: string;
      report_url?: string;
      report_file_uuid?: string;
    },
  ) => (await api.post(`${BASE}/${id}/report/submit`, data ?? {})) as LabRequest,
  approveReport: async (id: string | number) =>
    (await api.post(`${BASE}/${id}/report/approve`)) as LabRequest,
  rejectReport: async (id: string | number, reason: string) =>
    (await api.post(`${BASE}/${id}/report/reject`, { reason })) as LabRequest,
  linkNgException: async (
    id: string | number,
    itemId: number,
    data?: { problem_description?: string; severity?: string; remarks?: string },
  ) =>
    (await api.post(`${BASE}/${id}/measure-items/${itemId}/link-exception`, data ?? {})) as LabRequest,
};
