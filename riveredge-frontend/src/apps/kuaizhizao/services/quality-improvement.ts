import { apiRequest } from '../../../services/api';

export interface Quality8DReport {
  id: number;
  report_code: string;
  uuid?: string;
  title: string;
  status: string;
  severity?: string;
  owner_id?: number;
  owner_name?: string;
  due_date?: string;
  quality_exception_id?: number;
  defect_record_id?: number;
  d1_team?: string;
  d2_problem?: string;
  d3_containment?: string;
  d4_root_cause?: string;
  d5_corrective_action?: string;
  d6_implement_result?: string;
  d7_prevent_recurrence?: string;
  d8_team_congratulation?: string;
  verification_result?: string;
  remarks?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string; status?: string }>;
  closed_at?: string;
  lifecycle_stages?: Array<{ key: string; label: string; status: 'done' | 'active' | 'pending' }>;
  next_status?: string | null;
  next_step_suggestions?: string[];
  created_at?: string;
  updated_at?: string;
  capabilities?: {
    update?: { allowed?: boolean; reason?: string };
    delete?: { allowed?: boolean; reason?: string };
    transition?: { allowed?: boolean; reason?: string };
    close?: { allowed?: boolean; reason?: string };
  };
}

export interface Quality8DHistoryEntry {
  timestamp: string;
  action: 'created' | 'transition' | 'closed' | string;
  from_status?: string | null;
  to_status?: string | null;
  remarks?: string | null;
  verification_result?: string | null;
}

export interface Quality8DListResponse {
  items: Quality8DReport[];
  total: number;
}

export interface DefectLedgerItem {
  id: number;
  code: string;
  work_order_code?: string;
  operation_name?: string;
  product_name?: string;
  defect_quantity: number;
  defect_type: string;
  defect_reason: string;
  disposition: string;
  status: string;
  created_at?: string;
  incoming_inspection_id?: number;
  incoming_inspection_code?: string;
  process_inspection_id?: number;
  process_inspection_code?: string;
  finished_goods_inspection_id?: number;
  finished_goods_inspection_code?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string; status?: string }>;
  capabilities?: {
    update_disposition?: { allowed?: boolean; reason?: string };
    start_8d?: { allowed?: boolean; reason?: string };
  };
}

export interface OQCInspection {
  id: number;
  inspection_code: string;
  source_code: string;
  material_code: string;
  material_name: string;
  inspection_quantity: number;
  qualified_quantity: number;
  unqualified_quantity: number;
  inspection_result: string;
  quality_status: string;
  release_decision: string;
  review_status: string;
  status: string;
  shipment_notice_id?: number;
  shipment_notice_code?: string;
  sales_order_code?: string;
  customer_name?: string;
  inspection_standard?: string;
  other_checks?: Record<string, unknown>;
  attachments?: Array<{ uid?: string; name?: string; url?: string; status?: string }>;
  created_at?: string;
  capabilities?: {
    conduct?: { allowed?: boolean; reason?: string };
    delete?: { allowed?: boolean; reason?: string };
  };
}

export interface SPCSample {
  id: number;
  characteristic_name: string;
  chart_type: string;
  sample_time: string;
  sample_value: number;
  sample_size: number;
}

export interface SPCChartResponse {
  characteristic_name: string;
  chart_type: string;
  mean: number;
  sigma: number;
  ucl: number;
  lcl: number;
  points: Array<{
    sample_time: string;
    sample_value: number;
    out_of_control: boolean;
    triggered_rules: string[];
  }>;
  triggered_summary: string[];
}

export const qualityImprovementApi = {
  eightD: {
    list: async (params?: any) =>
      apiRequest<Quality8DListResponse>('/apps/kuaizhizao/quality-8d-reports', { method: 'GET', params }),
    getById: async (id: number) =>
      apiRequest<Quality8DReport>(`/apps/kuaizhizao/quality-8d-reports/${id}`, { method: 'GET' }),
    create: async (data: any) =>
      apiRequest<Quality8DReport>('/apps/kuaizhizao/quality-8d-reports', { method: 'POST', data }),
    update: async (id: number, data: any) =>
      apiRequest<Quality8DReport>(`/apps/kuaizhizao/quality-8d-reports/${id}`, { method: 'PUT', data }),
    delete: async (id: number) =>
      apiRequest(`/apps/kuaizhizao/quality-8d-reports/${id}`, { method: 'DELETE' }),
    transition: async (id: number, data: { to_status: string; remarks?: string; verification_result?: string }) =>
      apiRequest<Quality8DReport>(`/apps/kuaizhizao/quality-8d-reports/${id}/transition`, { method: 'POST', data }),
    getHistory: async (id: number) =>
      apiRequest<Quality8DHistoryEntry[]>(`/apps/kuaizhizao/quality-8d-reports/${id}/history`, {
        method: 'GET',
      }),
    history: async (id: number) =>
      apiRequest<Quality8DHistoryEntry[]>(`/apps/kuaizhizao/quality-8d-reports/${id}/history`, {
        method: 'GET',
      }),
    startFromException: async (exceptionId: number, title: string) =>
      apiRequest<Quality8DReport>(`/apps/kuaizhizao/exceptions/quality/${exceptionId}/start-8d`, {
        method: 'POST',
        data: { title },
      }),
  },

  nonconformingLedger: {
    list: async (params?: any) =>
      apiRequest<DefectLedgerItem[]>('/apps/kuaizhizao/nonconforming-ledger', { method: 'GET', params }),
    updateDisposition: async (
      id: number,
      data: { disposition: string; status?: string; quarantine_location?: string; remarks?: string }
    ) =>
      apiRequest(`/apps/kuaizhizao/nonconforming-ledger/${id}/disposition`, {
        method: 'PUT',
        data,
      }),
    start8d: async (defectId: number, title: string) =>
      apiRequest<Quality8DReport>(`/apps/kuaizhizao/nonconforming-ledger/${defectId}/start-8d`, {
        method: 'POST',
        data: { title },
      }),
  },

  oqc: {
    list: async (params?: any) =>
      apiRequest<{ items: OQCInspection[]; total: number }>('/apps/kuaizhizao/oqc-inspections', { method: 'GET', params }),
    create: async (data: any) => apiRequest<OQCInspection>('/apps/kuaizhizao/oqc-inspections', { method: 'POST', data }),
    createFromShipmentNotice: async (noticeId: number, lineIds?: number[]) =>
      apiRequest<OQCInspection[]>(`/apps/kuaizhizao/oqc-inspections/from-shipment-notice/${noticeId}`, {
        method: 'POST',
        data: lineIds?.length ? { line_ids: lineIds } : {},
      }),
    createFromSalesDelivery: async (deliveryId: number, lineIds?: number[]) =>
      apiRequest<OQCInspection[]>(`/apps/kuaizhizao/oqc-inspections/from-sales-delivery/${deliveryId}`, {
        method: 'POST',
        data: lineIds?.length ? { line_ids: lineIds } : {},
      }),
    conduct: async (id: number, data: any) =>
      apiRequest<OQCInspection>(`/apps/kuaizhizao/oqc-inspections/${id}/conduct`, { method: 'POST', data }),
    approve: async (id: number, approve = true) =>
      apiRequest<OQCInspection>(`/apps/kuaizhizao/oqc-inspections/${id}/approve`, {
        method: 'POST',
        params: { approve },
      }),
    revoke: async (id: number) =>
      apiRequest<OQCInspection>(`/apps/kuaizhizao/oqc-inspections/${id}/unapprove`, { method: 'POST' }),
    delete: async (id: number) =>
      apiRequest(`/apps/kuaizhizao/oqc-inspections/${id}`, { method: 'DELETE' }),
    export: async (params?: Record<string, unknown>) =>
      apiRequest<{ items: OQCInspection[]; total: number }>('/apps/kuaizhizao/oqc-inspections/export', {
        method: 'GET',
        params,
      }),
  },

  spc: {
    listSamples: async (params?: any) =>
      apiRequest<SPCSample[]>('/apps/kuaizhizao/spc/samples', { method: 'GET', params }),
    createSample: async (data: any) => apiRequest<SPCSample>('/apps/kuaizhizao/spc/samples', { method: 'POST', data }),
    getImrChart: async (characteristicName: string, limit = 50) =>
      apiRequest<SPCChartResponse>('/apps/kuaizhizao/spc/charts/imr', {
        method: 'GET',
        params: { characteristic_name: characteristicName, limit },
      }),
  },
};
