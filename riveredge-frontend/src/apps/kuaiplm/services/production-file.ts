/**
 * 生产文件 API（R-06）
 */

import { api } from '../../../services/api';

const BASE = '/apps/kuaiplm/production-files';

export type ProductionFileCatalogKind = 'pe_production' | 'rd_tool';

export type ProductionFileStatus =
  | 'draft'
  | 'pending'
  | 'effective'
  | 'obsolete'
  | 'rejected';

export type ProductionFileType =
  | 'burn'
  | 'laser'
  | 'bluetooth_ir'
  | 'aoi'
  | 'label_template'
  | 'other_pe'
  | 'rd_burn_tool'
  | 'rd_prod_test'
  | 'other_rd';

export interface ProductionFile {
  uuid: string;
  id: number;
  file_code: string;
  catalog_kind: ProductionFileCatalogKind;
  file_type: ProductionFileType | string;
  title: string;
  process_code?: string | null;
  process_name?: string | null;
  product_model?: string | null;
  project_id?: number | null;
  project_code?: string | null;
  project_name?: string | null;
  release_date?: string | null;
  version: string;
  status: ProductionFileStatus;
  file_uuid?: string | null;
  file_name?: string | null;
  checksum?: string | null;
  change_summary?: string | null;
  remarks?: string | null;
  issued_by_name?: string | null;
  issued_at?: string | null;
  receiver_names?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  obsolete_at?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: number | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
}

export interface ProductionFilePayload {
  catalog_kind: ProductionFileCatalogKind;
  file_type: string;
  title: string;
  version?: string;
  file_code?: string;
  process_code?: string | null;
  process_name?: string | null;
  product_model?: string | null;
  project_id?: number | null;
  project_code?: string | null;
  project_name?: string | null;
  release_date?: string | null;
  file_uuid?: string | null;
  file_name?: string | null;
  checksum?: string | null;
  change_summary?: string | null;
  remarks?: string | null;
}

export interface ProductionFileVersion {
  id: number;
  uuid: string;
  file_id: number;
  file_code: string;
  version: string;
  status: string;
  is_effective: boolean;
  is_production_effective: boolean;
  title: string;
  file_type?: string | null;
  release_date?: string | null;
  file_uuid?: string | null;
  file_name?: string | null;
  change_summary?: string | null;
  created_by_name?: string | null;
  created_at?: string;
}

export interface ProductionFileAccessLog {
  id: number;
  uuid: string;
  file_id: number;
  file_code: string;
  version_id?: number | null;
  version?: string | null;
  action: string;
  actor_name?: string | null;
  receiver_names?: string | null;
  remark?: string | null;
  created_at: string;
}

function unwrapList<T>(res: unknown): { items: T[]; total: number } {
  const r = (res || {}) as Record<string, unknown>;
  const items = (r.items ?? r.data ?? []) as T[];
  return { items: Array.isArray(items) ? items : [], total: Number(r.total ?? items.length) };
}

export const productionFileApi = {
  list: async (params: {
    skip?: number;
    limit?: number;
    keyword?: string;
    status?: string;
    catalog_kind?: string;
    file_type?: string;
    process_code?: string;
    product_model?: string;
    project_id?: number;
    production_view?: boolean;
  }) => {
    const res = await api.get(BASE, { params });
    return unwrapList<ProductionFile>(res);
  },
  get: async (id: number) => {
    const res = await api.get(`${BASE}/${id}`);
    return res as ProductionFile;
  },
  getDownloadUrl: async (
    id: number,
    options?: { version_id?: number; production_view?: boolean },
  ) => {
    const res = await api.get(`${BASE}/${id}/download`, {
      params: {
        version_id: options?.version_id,
        production_view: options?.production_view ? true : undefined,
      },
    });
    return res as { preview_url: string; file_name?: string | null; version_id?: number | null };
  },
  create: async (data: ProductionFilePayload) => {
    const res = await api.post(BASE, data);
    return res as ProductionFile;
  },
  update: async (id: number, data: Partial<ProductionFilePayload>) => {
    const res = await api.put(`${BASE}/${id}`, data);
    return res as ProductionFile;
  },
  submit: async (id: number) => {
    const res = await api.post(`${BASE}/${id}/submit`);
    return res as ProductionFile;
  },
  approve: async (id: number) => {
    const res = await api.post(`${BASE}/${id}/approve`);
    return res as ProductionFile;
  },
  reject: async (id: number) => {
    const res = await api.post(`${BASE}/${id}/reject`);
    return res as ProductionFile;
  },
  revise: async (
    id: number,
    data: {
      version?: string;
      change_summary?: string;
      file_uuid?: string;
      file_name?: string;
      release_date?: string | null;
      title?: string;
    },
  ) => {
    const res = await api.post(`${BASE}/${id}/revise`, data);
    return res as ProductionFile;
  },
  obsolete: async (id: number) => {
    const res = await api.post(`${BASE}/${id}/obsolete`);
    return res as ProductionFile;
  },
  issue: async (id: number, data: { receiver_names: string; remark?: string; version_id?: number }) => {
    const res = await api.post(`${BASE}/${id}/issue`, data);
    return res as ProductionFile;
  },
  recordAccess: async (
    id: number,
    data: { action: 'view' | 'download'; version_id?: number },
    productionView = false,
  ) => {
    const res = await api.post(`${BASE}/${id}/access`, data, {
      params: { production_view: productionView },
    });
    return res as ProductionFileAccessLog;
  },
  listVersions: async (id: number, productionView = false) => {
    const res = await api.get(`${BASE}/${id}/versions`, {
      params: { production_view: productionView },
    });
    const unwrapped = unwrapList<ProductionFileVersion>(res);
    const r = (res || {}) as Record<string, unknown>;
    return {
      ...unwrapped,
      audience: String(r.audience || ''),
      can_view_history: Boolean(r.can_view_history),
    };
  },
  listAccessLogs: async (id: number, params?: { action?: string; skip?: number; limit?: number }) => {
    const res = await api.get(`${BASE}/${id}/access-logs`, { params });
    return unwrapList<ProductionFileAccessLog>(res);
  },
  remove: async (id: number) => {
    await api.delete(`${BASE}/${id}`);
  },
};
