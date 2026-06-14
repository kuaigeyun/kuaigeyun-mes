/**
 * 研发知识库 API
 */

import { apiRequest } from '../../../services/api';

const BASE = '/apps/kuaiplm/knowledge';

export interface KbSpace {
  id?: number;
  uuid?: string;
  space_code?: string;
  space_name?: string;
  description?: string | null;
  parent_space_id?: number | null;
  sort_order?: number;
  is_active?: boolean;
  article_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface KbSpaceCreatePayload {
  space_code: string;
  space_name: string;
  description?: string | null;
  parent_space_id?: number | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface KbSpaceUpdatePayload {
  space_name?: string;
  description?: string | null;
  parent_space_id?: number | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface KbArticle {
  id?: number;
  uuid?: string;
  space_id?: number;
  space_name?: string;
  article_code?: string;
  title?: string;
  summary?: string | null;
  content?: string | null;
  status?: string;
  tags?: string[] | null;
  author_name?: string | null;
  project_id?: number | null;
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

export async function listKbSpaces(params?: {
  skip?: number;
  limit?: number;
  include_inactive?: boolean;
}) {
  const res = await apiRequest<unknown>(`${BASE}/spaces`, { method: 'GET', params });
  return unwrapList<KbSpace>(res);
}

export async function createKbSpace(data: KbSpaceCreatePayload) {
  return apiRequest<KbSpace>(`${BASE}/spaces`, { method: 'POST', data });
}

export async function updateKbSpace(id: number | string, data: KbSpaceUpdatePayload) {
  return apiRequest<KbSpace>(`${BASE}/spaces/${id}`, { method: 'PUT', data });
}

export async function deleteKbSpace(id: number | string) {
  return apiRequest<void>(`${BASE}/spaces/${id}`, { method: 'DELETE' });
}

export async function listKbArticles(params?: {
  skip?: number;
  limit?: number;
  space_id?: number;
  status?: string;
  keyword?: string;
  tag?: string;
  project_id?: number;
}) {
  const res = await apiRequest<unknown>(`${BASE}/articles`, { method: 'GET', params });
  return unwrapList<KbArticle>(res);
}

export async function searchKbArticles(params: {
  keyword: string;
  space_id?: number;
  limit?: number;
}) {
  const res = await apiRequest<{ articles?: KbArticle[]; total?: number }>(`${BASE}/articles/search`, {
    method: 'GET',
    params,
  });
  return {
    items: Array.isArray(res?.articles) ? res.articles : [],
    total: Number(res?.total ?? 0),
  };
}

export async function getKbArticle(id: number | string) {
  return apiRequest<KbArticle>(`${BASE}/articles/${id}`);
}

export async function createKbArticle(data: Partial<KbArticle>) {
  return apiRequest<KbArticle>(`${BASE}/articles`, { method: 'POST', data });
}

export async function updateKbArticle(id: number | string, data: Partial<KbArticle>) {
  return apiRequest<KbArticle>(`${BASE}/articles/${id}`, { method: 'PUT', data });
}

export async function deleteKbArticle(id: number | string) {
  return apiRequest<void>(`${BASE}/articles/${id}`, { method: 'DELETE' });
}
