import { apiRequest } from '../../../services/api';

export type QmsEvidenceLink = {
  ref_type: string;
  ref_id?: number | null;
  ref_code?: string | null;
  ref_name?: string | null;
  path?: string | null;
  note?: string | null;
};

export interface QmsSystemDocument {
  id: number;
  uuid?: string;
  document_code: string;
  title: string;
  doc_type: string;
  version: string;
  status: string;
  iso_clause?: string;
  iso_clause_id?: number | null;
  content?: string;
  file_url?: string;
  effective_at?: string;
  obsolete_at?: string;
  next_review_at?: string;
  owner_name?: string;
  evidence_links?: QmsEvidenceLink[];
  training_refs?: QmsEvidenceLink[];
  attachments?: any;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

export interface QmsInternalAudit {
  id: number;
  uuid?: string;
  audit_code: string;
  title: string;
  audit_scope?: string;
  iso_clause?: string;
  iso_clause_id?: number | null;
  status: string;
  planned_date?: string;
  completed_date?: string;
  lead_auditor?: string;
  audit_team?: string;
  checklist?: string;
  findings?: string;
  conclusion?: string;
  finding_links?: QmsEvidenceLink[];
  training_refs?: QmsEvidenceLink[];
  calibration_refs?: QmsEvidenceLink[];
  attachments?: any;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

export interface QmsManagementReview {
  id: number;
  uuid?: string;
  review_code: string;
  title: string;
  status: string;
  review_date?: string;
  chairperson?: string;
  attendees?: string;
  inputs_summary?: string;
  outputs_summary?: string;
  input_links?: QmsEvidenceLink[];
  training_refs?: QmsEvidenceLink[];
  calibration_refs?: QmsEvidenceLink[];
  attachments?: any;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

export interface QmsIsoClause {
  id: number;
  uuid?: string;
  standard_code: string;
  clause_code: string;
  title: string;
  description?: string;
  parent_id?: number | null;
  sort_order?: number;
  is_active?: boolean;
  created_by_name?: string;
  updated_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface QmsIsoClauseTreeNode extends QmsIsoClause {
  children?: QmsIsoClauseTreeNode[];
}

export interface QmsIsoClauseComplianceSummary {
  effective_document_count: number;
  review_due_count: number;
  internal_audit_count: number;
  last_audit_date?: string | null;
  has_gap: boolean;
  no_effective_document: boolean;
  no_completed_audit: boolean;
  compliance_status: 'covered' | 'review_due' | 'gap';
}

type ListEnvelope<T> = { items: T[]; total: number };

export const qualityQmsApi = {
  systemDocuments: {
    list: (params?: Record<string, unknown>) =>
      apiRequest<ListEnvelope<QmsSystemDocument>>('/apps/kuaizhizao/qms/system-documents', {
        method: 'GET',
        params,
      }),
    get: (id: number) =>
      apiRequest<QmsSystemDocument>(`/apps/kuaizhizao/qms/system-documents/${id}`, { method: 'GET' }),
    create: (data: Partial<QmsSystemDocument>) =>
      apiRequest<QmsSystemDocument>('/apps/kuaizhizao/qms/system-documents', { method: 'POST', data }),
    update: (id: number, data: Partial<QmsSystemDocument>) =>
      apiRequest<QmsSystemDocument>(`/apps/kuaizhizao/qms/system-documents/${id}`, {
        method: 'PUT',
        data,
      }),
    publish: (id: number) =>
      apiRequest<QmsSystemDocument>(`/apps/kuaizhizao/qms/system-documents/${id}/publish`, {
        method: 'POST',
      }),
    obsolete: (id: number) =>
      apiRequest<QmsSystemDocument>(`/apps/kuaizhizao/qms/system-documents/${id}/obsolete`, {
        method: 'POST',
      }),
    delete: (id: number) =>
      apiRequest(`/apps/kuaizhizao/qms/system-documents/${id}`, { method: 'DELETE' }),
    reviewDueSummary: () =>
      apiRequest<{ due_count: number }>('/apps/kuaizhizao/qms/system-documents/review-due-summary', {
        method: 'GET',
      }),
  },
  internalAudits: {
    list: (params?: Record<string, unknown>) =>
      apiRequest<ListEnvelope<QmsInternalAudit>>('/apps/kuaizhizao/qms/internal-audits', {
        method: 'GET',
        params,
      }),
    get: (id: number) =>
      apiRequest<QmsInternalAudit>(`/apps/kuaizhizao/qms/internal-audits/${id}`, { method: 'GET' }),
    create: (data: Partial<QmsInternalAudit>) =>
      apiRequest<QmsInternalAudit>('/apps/kuaizhizao/qms/internal-audits', { method: 'POST', data }),
    update: (id: number, data: Partial<QmsInternalAudit>) =>
      apiRequest<QmsInternalAudit>(`/apps/kuaizhizao/qms/internal-audits/${id}`, {
        method: 'PUT',
        data,
      }),
    delete: (id: number) =>
      apiRequest(`/apps/kuaizhizao/qms/internal-audits/${id}`, { method: 'DELETE' }),
  },
  managementReviews: {
    list: (params?: Record<string, unknown>) =>
      apiRequest<ListEnvelope<QmsManagementReview>>('/apps/kuaizhizao/qms/management-reviews', {
        method: 'GET',
        params,
      }),
    get: (id: number) =>
      apiRequest<QmsManagementReview>(`/apps/kuaizhizao/qms/management-reviews/${id}`, {
        method: 'GET',
      }),
    create: (data: Partial<QmsManagementReview>) =>
      apiRequest<QmsManagementReview>('/apps/kuaizhizao/qms/management-reviews', {
        method: 'POST',
        data,
      }),
    update: (id: number, data: Partial<QmsManagementReview>) =>
      apiRequest<QmsManagementReview>(`/apps/kuaizhizao/qms/management-reviews/${id}`, {
        method: 'PUT',
        data,
      }),
    delete: (id: number) =>
      apiRequest(`/apps/kuaizhizao/qms/management-reviews/${id}`, { method: 'DELETE' }),
    inputSummary: (params?: { period_start?: string; period_end?: string }) =>
      apiRequest<{
        summary_text: string;
        nonconforming_count: number;
        open_8d_count: number;
        iqc_pass_rate?: number | null;
        oqc_pass_rate?: number | null;
      }>('/apps/kuaizhizao/qms/management-reviews/input-summary', { method: 'GET', params }),
  },
  isoClauses: {
    list: (params?: Record<string, unknown>) =>
      apiRequest<ListEnvelope<QmsIsoClause>>('/apps/kuaizhizao/qms/iso-clauses', {
        method: 'GET',
        params,
      }),
    tree: (params?: { standard_code?: string }) =>
      apiRequest<QmsIsoClauseTreeNode[]>('/apps/kuaizhizao/qms/iso-clauses/tree', {
        method: 'GET',
        params,
      }),
    get: (id: number) =>
      apiRequest<QmsIsoClause>(`/apps/kuaizhizao/qms/iso-clauses/${id}`, { method: 'GET' }),
    create: (data: Partial<QmsIsoClause>) =>
      apiRequest<QmsIsoClause>('/apps/kuaizhizao/qms/iso-clauses', { method: 'POST', data }),
    update: (id: number, data: Partial<QmsIsoClause>) =>
      apiRequest<QmsIsoClause>(`/apps/kuaizhizao/qms/iso-clauses/${id}`, {
        method: 'PUT',
        data,
      }),
    delete: (id: number) =>
      apiRequest(`/apps/kuaizhizao/qms/iso-clauses/${id}`, { method: 'DELETE' }),
    loadPreset: (standard_code = 'ISO9001:2015') =>
      apiRequest<{ created: number; skipped: number; linked: number }>(
        '/apps/kuaizhizao/qms/iso-clauses/load-preset',
        { method: 'POST', params: { standard_code } },
      ),
    complianceSummary: (id: number) =>
      apiRequest<QmsIsoClauseComplianceSummary>(
        `/apps/kuaizhizao/qms/iso-clauses/${id}/compliance-summary`,
        { method: 'GET' },
      ),
    relatedDocuments: (id: number) =>
      apiRequest<{ items: QmsSystemDocument[] }>(
        `/apps/kuaizhizao/qms/iso-clauses/${id}/related-documents`,
        { method: 'GET' },
      ),
    relatedAudits: (id: number) =>
      apiRequest<{ items: QmsInternalAudit[] }>(
        `/apps/kuaizhizao/qms/iso-clauses/${id}/related-audits`,
        { method: 'GET' },
      ),
  },
};
