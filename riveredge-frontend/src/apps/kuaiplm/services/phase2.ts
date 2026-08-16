/**
 * 快研发 Phase2：需求 / 设计评审 / FMEA
 */

import { apiRequest } from '../../../services/api';

const BASE = '/apps/kuaiplm/phase2';

export interface RdRequirement {
  id?: number;
  requirement_code?: string;
  title?: string;
  project_id?: number | null;
  project_name?: string | null;
  project_code?: string | null;
  source_type?: string | null;
  source_id?: number | null;
  priority?: string;
  status?: string;
  owner_name?: string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
}

export interface RdDesignReview {
  id?: number;
  review_code?: string;
  title?: string;
  project_id?: number | null;
  project_name?: string | null;
  project_code?: string | null;
  material_id?: number | null;
  material_code?: string | null;
  material_name?: string | null;
  review_type?: string;
  status?: string;
  review_date?: string | null;
  reviewer_name?: string | null;
  review_notes?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
}

export interface RdFmeaRecord {
  id?: number;
  fmea_code?: string;
  title?: string;
  project_id?: number | null;
  project_name?: string | null;
  fmea_type?: string;
  status?: string;
  material_code?: string | null;
  material_name?: string | null;
  risk_items?: unknown[] | string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
}

function unwrapList<T>(res: unknown): { items: T[]; total: number } {
  if (Array.isArray(res)) return { items: res as T[], total: res.length };
  const r = res as Record<string, unknown>;
  const items = (r.items ?? r.data ?? r.results ?? []) as T[];
  const total = Number(r.total ?? (Array.isArray(items) ? items.length : 0));
  return { items: Array.isArray(items) ? items : [], total };
}

export async function listRequirements(params?: {
  skip?: number;
  limit?: number;
  keyword?: string;
  project_id?: number;
  status?: string;
  priority?: string;
  requirement_code?: string;
  title?: string;
  sort_field?: string;
  sort_order?: string;
  created_start_date?: string;
  created_end_date?: string;
  updated_start_date?: string;
  updated_end_date?: string;
}) {
  const res = await apiRequest<unknown>(`${BASE}/requirements`, { method: 'GET', params });
  return unwrapList<RdRequirement>(res);
}

export async function createRequirement(data: Partial<RdRequirement>) {
  return apiRequest<RdRequirement>(`${BASE}/requirements`, { method: 'POST', data });
}

export async function updateRequirement(id: number | string, data: Partial<RdRequirement>) {
  return apiRequest<RdRequirement>(`${BASE}/requirements/${id}`, { method: 'PUT', data });
}

export async function deleteRequirement(id: number | string) {
  return apiRequest<void>(`${BASE}/requirements/${id}`, { method: 'DELETE' });
}

export async function listDesignReviews(params?: {
  skip?: number;
  limit?: number;
  keyword?: string;
  project_id?: number;
  status?: string;
  review_code?: string;
  title?: string;
  sort_field?: string;
  sort_order?: string;
  created_start_date?: string;
  created_end_date?: string;
  updated_start_date?: string;
  updated_end_date?: string;
}) {
  const res = await apiRequest<unknown>(`${BASE}/design-reviews`, { method: 'GET', params });
  return unwrapList<RdDesignReview>(res);
}

export async function createDesignReview(data: Partial<RdDesignReview>) {
  return apiRequest<RdDesignReview>(`${BASE}/design-reviews`, { method: 'POST', data });
}

export async function updateDesignReview(id: number | string, data: Partial<RdDesignReview>) {
  return apiRequest<RdDesignReview>(`${BASE}/design-reviews/${id}`, { method: 'PUT', data });
}

export async function deleteDesignReview(id: number | string) {
  return apiRequest<void>(`${BASE}/design-reviews/${id}`, { method: 'DELETE' });
}

export async function listFmeaRecords(params?: {
  skip?: number;
  limit?: number;
  keyword?: string;
  project_id?: number;
  status?: string;
  fmea_type?: string;
  fmea_code?: string;
  title?: string;
  sort_field?: string;
  sort_order?: string;
  created_start_date?: string;
  created_end_date?: string;
  updated_start_date?: string;
  updated_end_date?: string;
}) {
  const res = await apiRequest<unknown>(`${BASE}/fmea`, { method: 'GET', params });
  return unwrapList<RdFmeaRecord>(res);
}

export async function createFmeaRecord(data: Partial<RdFmeaRecord>) {
  return apiRequest<RdFmeaRecord>(`${BASE}/fmea`, { method: 'POST', data });
}

export async function updateFmeaRecord(id: number | string, data: Partial<RdFmeaRecord>) {
  return apiRequest<RdFmeaRecord>(`${BASE}/fmea/${id}`, { method: 'PUT', data });
}

export async function deleteFmeaRecord(id: number | string) {
  return apiRequest<void>(`${BASE}/fmea/${id}`, { method: 'DELETE' });
}
