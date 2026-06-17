/**
 * KU-AI 知识库 API
 */

import { apiRequest } from '../../../services/api';

const BASE = '/apps/kuaiai/knowledge';
const TRAINING_BASE = '/apps/kuaiai/training';

export interface KnowledgeDocument {
  id: number;
  uuid: string;
  title: string;
  source_type: 'text' | 'file' | 'faq';
  status: 'pending' | 'indexed' | 'failed';
  chunk_count: number;
  error_message?: string | null;
  is_active: boolean;
  file_uuid?: string | null;
  faq_question?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface KnowledgeListResponse {
  items: KnowledgeDocument[];
  total: number;
  page: number;
  page_size: number;
}

export async function listKnowledgeDocuments(params?: {
  page?: number;
  page_size?: number;
  source_type?: string;
  status?: string;
}): Promise<KnowledgeListResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.page_size) qs.set('page_size', String(params.page_size));
  if (params?.source_type) qs.set('source_type', params.source_type);
  if (params?.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest<KnowledgeListResponse>(`${BASE}${suffix}`);
}

export async function createTextKnowledge(title: string, content: string): Promise<KnowledgeDocument> {
  return apiRequest<KnowledgeDocument>(`${BASE}/text`, {
    method: 'POST',
    body: JSON.stringify({ title, content }),
  });
}

export async function createFaqKnowledge(
  question: string,
  answer: string,
  title?: string,
): Promise<KnowledgeDocument> {
  return apiRequest<KnowledgeDocument>(`${BASE}/faq`, {
    method: 'POST',
    body: JSON.stringify({ title, question, answer }),
  });
}

export async function createFileKnowledge(title: string, file_uuid: string): Promise<KnowledgeDocument> {
  return apiRequest<KnowledgeDocument>(`${BASE}/file`, {
    method: 'POST',
    body: JSON.stringify({ title, file_uuid }),
  });
}

export async function deleteKnowledgeDocument(documentId: number): Promise<void> {
  await apiRequest(`${BASE}/${documentId}`, { method: 'DELETE' });
}

export async function reindexKnowledgeDocument(documentId: number): Promise<KnowledgeDocument> {
  return apiRequest<KnowledgeDocument>(`${BASE}/${documentId}/reindex`, { method: 'POST' });
}

export async function seedDefaultFaqs(): Promise<{ created: number }> {
  return apiRequest<{ created: number }>(`${BASE}/seed-defaults`, { method: 'POST' });
}

export async function exportTrainingJsonl(): Promise<Blob> {
  const token = localStorage.getItem('token');
  const tenantId = localStorage.getItem('tenant_id');
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId?.trim()) headers['X-Tenant-ID'] = tenantId.trim();

  const res = await fetch(`/api/v1${TRAINING_BASE}/export.jsonl`, { headers });
  if (!res.ok) {
    throw new Error(`导出失败 (${res.status})`);
  }
  return res.blob();
}
