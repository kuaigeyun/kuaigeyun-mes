import { api, apiRequest } from '../../../services/api';
import type { MasterDataSyncBinding, MasterDataSyncFromSourceResult } from './supply-chain';
import type {
  MaterialUnit,
  MaterialUnitConversion,
  MaterialUnitConversionCreate,
  MaterialUnitConversionResolve,
  MaterialUnitConversionUpdate,
  MaterialUnitCreate,
  MaterialUnitEnsurePresetsResult,
  MaterialUnitUpdate,
} from '../types/material-unit';

const BASE = '/apps/master-data/materials';

export const materialUnitApi = {
  list: async (params?: {
    skip?: number;
    limit?: number;
    keyword?: string;
    is_active?: boolean;
    sort_by?: string;
    sort_order?: string;
  }): Promise<{ items: MaterialUnit[]; total: number }> => {
    const res = await api.get<{ items: MaterialUnit[]; total: number }>(`${BASE}/units`, { params });
    if (Array.isArray(res)) return { items: res, total: res.length };
    return { items: res?.items ?? [], total: res?.total ?? 0 };
  },

  create: (data: MaterialUnitCreate) => api.post<MaterialUnit>(`${BASE}/units`, data),

  get: (uuid: string) => api.get<MaterialUnit>(`${BASE}/units/${uuid}`),

  update: (uuid: string, data: MaterialUnitUpdate) =>
    api.put<MaterialUnit>(`${BASE}/units/${uuid}`, data),

  delete: (uuid: string) => api.delete(`${BASE}/units/${uuid}`),

  ensurePresets: () =>
    api.post<MaterialUnitEnsurePresetsResult>(`${BASE}/units/ensure-presets`),

  listConversions: async (params?: {
    skip?: number;
    limit?: number;
    keyword?: string;
    is_active?: boolean;
  }): Promise<{ items: MaterialUnitConversion[]; total: number }> => {
    const res = await api.get<{ items: MaterialUnitConversion[]; total: number }>(
      `${BASE}/unit-conversions`,
      { params },
    );
    if (Array.isArray(res)) return { items: res, total: res.length };
    return { items: res?.items ?? [], total: res?.total ?? 0 };
  },

  createConversion: (data: MaterialUnitConversionCreate) =>
    api.post<MaterialUnitConversion>(`${BASE}/unit-conversions`, data),

  updateConversion: (uuid: string, data: MaterialUnitConversionUpdate) =>
    api.put<MaterialUnitConversion>(`${BASE}/unit-conversions/${uuid}`, data),

  deleteConversion: (uuid: string) => api.delete(`${BASE}/unit-conversions/${uuid}`),

  resolveConversion: (baseUnit: string, auxUnit: string) =>
    api.get<MaterialUnitConversionResolve>(`${BASE}/unit-conversions/resolve`, {
      params: { baseUnit, auxUnit },
    }),
};

export async function getMaterialUnitSyncBinding(): Promise<MasterDataSyncBinding> {
  return api.get(`${BASE}/units/sync-binding`);
}

export async function syncMaterialUnitsFromSource(payload: {
  source_type?: 'api' | 'dataset';
  api_uuid?: string;
  dataset_uuid?: string;
  field_mapping?: Record<string, string>;
  save_binding?: boolean;
  sync_mode?: string;
  schedule_interval_minutes?: number;
  incremental?: boolean;
  active_only?: boolean;
}): Promise<MasterDataSyncFromSourceResult> {
  return apiRequest<MasterDataSyncFromSourceResult>(`${BASE}/units/sync-from-source`, {
    method: 'POST',
    data: payload,
    timeoutMs: 600_000,
  });
}
