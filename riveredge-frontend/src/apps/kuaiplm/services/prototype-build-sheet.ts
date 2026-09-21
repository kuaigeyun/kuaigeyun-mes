import { apiRequest } from '../../../services/api';

const BASE = '/apps/kuaiplm/prototype-build-sheets';

export type PrototypeBuildSheetStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'issued'
  | 'closed'
  | 'rejected';

export type PrototypeBuildRound = 'handboard' | 't1' | 't2' | 't3';

export interface PrototypeBuildAttachment {
  file_uuid: string;
  file_name?: string | null;
  media_kind?: 'text' | 'image' | 'file';
}

export interface PrototypeBuildSheet {
  id: number;
  uuid: string;
  sheet_code: string;
  project_id: number;
  project_code: string;
  project_name: string;
  round_key: PrototypeBuildRound | string;
  title: string;
  status: PrototypeBuildSheetStatus;
  project_requirements?: string | null;
  project_attachments?: PrototypeBuildAttachment[];
  electronics_requirements?: string | null;
  electronics_attachments?: PrototypeBuildAttachment[];
  electronics_status: string;
  structure_requirements?: string | null;
  structure_attachments?: PrototypeBuildAttachment[];
  structure_status: string;
  manufacturing_opinion?: string | null;
  quality_opinion?: string | null;
  remarks?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  issued_at?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: number | null;
  created_by_name?: string | null;
  updated_by?: number | null;
  updated_by_name?: string | null;
}

export const prototypeBuildSheetApi = {
  list(params?: {
    skip?: number;
    limit?: number;
    keyword?: string;
    status?: string;
    project_id?: number;
    round_key?: string;
  }) {
    return apiRequest<{ items: PrototypeBuildSheet[]; total: number }>(BASE, { params });
  },
  get(id: number) {
    return apiRequest<PrototypeBuildSheet>(`${BASE}/${id}`);
  },
  create(data: {
    project_id: number;
    title: string;
    sheet_code?: string;
    round_key?: string;
    project_requirements?: string;
    project_attachments?: PrototypeBuildAttachment[];
    remarks?: string;
  }) {
    return apiRequest<PrototypeBuildSheet>(BASE, { method: 'POST', body: data });
  },
  update(
    id: number,
    data: {
      title?: string;
      project_requirements?: string;
      project_attachments?: PrototypeBuildAttachment[];
      remarks?: string;
    },
  ) {
    return apiRequest<PrototypeBuildSheet>(`${BASE}/${id}`, { method: 'PUT', body: data });
  },
  updateSection(
    id: number,
    section: 'electronics' | 'structure',
    data: { requirements?: string; attachments?: PrototypeBuildAttachment[] },
  ) {
    return apiRequest<PrototypeBuildSheet>(`${BASE}/${id}/sections/${section}`, {
      method: 'PUT',
      body: data,
    });
  },
  updateSignoff(
    id: number,
    data: { manufacturing_opinion?: string; quality_opinion?: string },
  ) {
    return apiRequest<PrototypeBuildSheet>(`${BASE}/${id}/signoff`, {
      method: 'PUT',
      body: data,
    });
  },
  submit(id: number) {
    return apiRequest<PrototypeBuildSheet>(`${BASE}/${id}/submit`, { method: 'POST' });
  },
  approve(id: number) {
    return apiRequest<PrototypeBuildSheet>(`${BASE}/${id}/approve`, { method: 'POST' });
  },
  reject(id: number) {
    return apiRequest<PrototypeBuildSheet>(`${BASE}/${id}/reject`, { method: 'POST' });
  },
  issue(id: number) {
    return apiRequest<PrototypeBuildSheet>(`${BASE}/${id}/issue`, { method: 'POST' });
  },
  close(id: number) {
    return apiRequest<PrototypeBuildSheet>(`${BASE}/${id}/close`, { method: 'POST' });
  },
  remove(id: number) {
    return apiRequest<void>(`${BASE}/${id}`, { method: 'DELETE' });
  },
};
