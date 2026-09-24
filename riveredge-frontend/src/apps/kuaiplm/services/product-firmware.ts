/**
 * 产品固件 API（R-15 #28）
 */

import { api } from '../../../services/api';

const BASE = '/apps/kuaiplm/product-firmwares';

export type ProductFirmwareStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'released'
  | 'obsolete';

export interface ProductFirmware {
  uuid: string;
  id?: number;
  firmware_code: string;
  project_id?: number | null;
  project_code: string;
  project_name: string;
  version: string;
  title: string;
  release_date?: string | null;
  status: ProductFirmwareStatus;
  file_uuid?: string | null;
  file_name?: string | null;
  checksum?: string | null;
  change_summary?: string | null;
  remarks?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  released_at?: string | null;
  obsolete_at?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
}

export interface ProductFirmwarePayload {
  project_id?: number | null;
  project_code?: string | null;
  project_name?: string | null;
  version: string;
  title: string;
  release_date?: string | null;
  firmware_code?: string;
  file_uuid?: string | null;
  file_name?: string | null;
  checksum?: string | null;
  change_summary?: string | null;
  remarks?: string | null;
}

function unwrapList(res: unknown): { items: ProductFirmware[]; total: number } {
  const r = (res || {}) as Record<string, unknown>;
  const items = (r.items ?? r.data ?? []) as ProductFirmware[];
  return { items: Array.isArray(items) ? items : [], total: Number(r.total ?? items.length) };
}

export const productFirmwareApi = {
  list: async (params: {
    skip?: number;
    limit?: number;
    keyword?: string;
    status?: string;
    project_id?: number;
    production_download_only?: boolean;
  }) => {
    const res = await api.get(BASE, { params });
    return unwrapList(res);
  },
  get: async (id: number, options?: { production_view?: boolean }) => {
    const res = await api.get(`${BASE}/${id}`, {
      params: options?.production_view ? { production_view: true } : undefined,
    });
    return res as ProductFirmware;
  },
  getDownloadUrl: async (id: number, options?: { production_view?: boolean }) => {
    const res = await api.get(`${BASE}/${id}/download`, {
      params: options?.production_view ? { production_view: true } : undefined,
    });
    return res as { preview_url: string; file_name?: string | null };
  },
  create: async (data: ProductFirmwarePayload) => {
    const res = await api.post(BASE, data);
    return res as ProductFirmware;
  },
  update: async (id: number, data: Partial<ProductFirmwarePayload>) => {
    const res = await api.put(`${BASE}/${id}`, data);
    return res as ProductFirmware;
  },
  submit: async (id: number) => {
    const res = await api.post(`${BASE}/${id}/submit`);
    return res as ProductFirmware;
  },
  approve: async (id: number) => {
    const res = await api.post(`${BASE}/${id}/approve`);
    return res as ProductFirmware;
  },
  reject: async (id: number) => {
    const res = await api.post(`${BASE}/${id}/reject`);
    return res as ProductFirmware;
  },
  release: async (id: number) => {
    const res = await api.post(`${BASE}/${id}/release`);
    return res as ProductFirmware;
  },
  obsolete: async (id: number) => {
    const res = await api.post(`${BASE}/${id}/obsolete`);
    return res as ProductFirmware;
  },
  revise: async (
    id: number,
    data?: {
      version?: string;
      title?: string;
      release_date?: string | null;
      file_uuid?: string | null;
      file_name?: string | null;
      checksum?: string | null;
      change_summary?: string | null;
    },
  ) => {
    const res = await api.post(`${BASE}/${id}/revise`, data || {});
    return res as ProductFirmware;
  },
  remove: async (id: number) => {
    await api.delete(`${BASE}/${id}`);
  },
};
