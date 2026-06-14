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
  source_type?: string | null;
  source_id?: number | null;
  priority?: string;
  status?: string;
  owner_name?: string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RdDesignReview {
  id?: number;
  review_code?: string;
  title?: string;
  project_id?: number | null;
  project_name?: string | null;
  review_type?: string;
  status?: string;
  scheduled_at?: string | null;
  reviewer_name?: string | null;
  conclusion?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RdFmeaRecord {
  id?: number;
  fmea_code?: string;
  title?: string;
  project_id?: number | null;
  project_name?: string | null;
  fmea_type?: string;
  status?: string;
  owner_name?: string | null;
  risk_level?: string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
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

export async function listDesignReviews(params?: { skip?: number; limit?: number; keyword?: string }) {
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
