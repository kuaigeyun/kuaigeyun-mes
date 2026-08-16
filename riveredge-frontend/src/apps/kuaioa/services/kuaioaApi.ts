/**
 * 轻办公 API 通用辅助
 */

import { apiRequest } from '../../../services/api';

export function unwrapList<T>(res: unknown): { items: T[]; total: number } {
  if (Array.isArray(res)) return { items: res as T[], total: res.length };
  const r = res as Record<string, unknown>;
  const items = (r.data ?? r.items ?? r.results ?? []) as T[];
  const total = Number(r.total ?? (Array.isArray(items) ? items.length : 0));
  return { items: Array.isArray(items) ? items : [], total };
}

export async function kuaioaList<T>(path: string, params?: Record<string, unknown>): Promise<{ items: T[]; total: number }> {
  const res = await apiRequest(path, { method: 'GET', params });
  return unwrapList<T>(res);
}

export async function kuaioaPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiRequest(path, { method: 'POST', data: body });
  return ((res as Record<string, unknown>)?.data ?? res) as T;
}

export async function kuaioaPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiRequest(path, { method: 'PUT', data: body });
  return ((res as Record<string, unknown>)?.data ?? res) as T;
}

export async function kuaioaDelete(path: string): Promise<void> {
  await apiRequest(path, { method: 'DELETE' });
}

export async function kuaioaGet<T>(path: string): Promise<T> {
  const res = await apiRequest(path, { method: 'GET' });
  return ((res as Record<string, unknown>)?.data ?? res) as T;
}
