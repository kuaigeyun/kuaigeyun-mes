/**
 * 工程变更（R-04 / ECN）API
 */

import { api } from '../../../services/api';

const BASE = '/apps/kuaiplm/engineering-changes';

export type EcnStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'erp_pending'
  | 'erp_failed'
  | 'closed';

export type EcnChangeKind = 'material' | 'process' | 'drawing' | 'doc_template' | 'other';

export interface EcnMaterialLine {
  id?: number;
  uuid?: string;
  line_no?: number;
  material_id?: number | null;
  material_code: string;
  material_name: string;
  before_desc?: string | null;
  after_desc?: string | null;
  stock_qty?: number | string | null;
  unit_price?: number | string | null;
  cost_amount?: number | string | null;
  disposition?: string | null;
  owner_user_id?: number | null;
  owner_user_name?: string | null;
  remarks?: string | null;
  extension_payload?: Record<string, unknown> | null;
}

export interface EcnFormProfileColumn {
  key: string;
  label: string;
  sort?: number;
  required?: boolean;
  width?: number;
  type?: string;
}

export interface EcnFormProfileFlag {
  key: string;
  label: string;
  sort?: number;
  type?: string;
}

export interface EcnFormProfileHeaderField {
  key: string;
  label: string;
  sort?: number;
  type?: string;
}

export interface EcnFormProfile {
  industry_profile_enabled?: boolean;
  field_labels: Record<string, string>;
  material_line_columns: EcnFormProfileColumn[];
  signoff_depts: Array<{ code: string; label: string; sort?: number }>;
  header_option_flags: EcnFormProfileFlag[];
  header_fields?: EcnFormProfileHeaderField[];
  entry_sources: Array<{ code: string; label: string; sort?: number }>;
  validation_rules: Array<Record<string, unknown>>;
}

export interface EcnSignoff {
  id: number;
  uuid: string;
  dept_code: string;
  dept_name: string;
  sort_order: number;
  status: string;
  result?: string | null;
  signer_name?: string | null;
  signed_at?: string | null;
  notes?: string | null;
}

export interface EngineeringChange {
  uuid: string;
  id: number;
  ecn_code: string;
  project_id?: number | null;
  project_code?: string | null;
  project_name?: string | null;
  change_kind: EcnChangeKind | string;
  title: string;
  change_reason?: string | null;
  status: EcnStatus | string;
  erp_ecn_no?: string | null;
  erp_audit_status?: string | null;
  erp_audit_notes?: string | null;
  remarks?: string | null;
  extension_payload?: Record<string, unknown> | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  materials?: EcnMaterialLine[];
  signoffs?: EcnSignoff[];
}

export interface EngineeringChangeListResponse {
  items: EngineeringChange[];
  total: number;
}

export const engineeringChangeApi = {
  formProfile: async () =>
    (await api.get(`${BASE}/meta/form-profile`)) as EcnFormProfile,
  list: async (params: Record<string, unknown>) =>
    (await api.get(BASE, { params })) as EngineeringChangeListResponse,
  get: async (id: number) => (await api.get(`${BASE}/${id}`)) as EngineeringChange,
  create: async (data: Record<string, unknown>) =>
    (await api.post(BASE, data)) as EngineeringChange,
  update: async (id: number, data: Record<string, unknown>) =>
    (await api.put(`${BASE}/${id}`, data)) as EngineeringChange,
  remove: async (id: number) => {
    await api.delete(`${BASE}/${id}`);
  },
  submit: async (id: number) =>
    (await api.post(`${BASE}/${id}/submit`)) as EngineeringChange,
  approve: async (id: number) =>
    (await api.post(`${BASE}/${id}/approve`)) as EngineeringChange,
  reject: async (id: number) =>
    (await api.post(`${BASE}/${id}/reject`)) as EngineeringChange,
  erpAudit: async (id: number, data: { erp_ecn_no: string; result: string; notes?: string }) =>
    (await api.post(`${BASE}/${id}/erp-audit`, data)) as EngineeringChange,
};
