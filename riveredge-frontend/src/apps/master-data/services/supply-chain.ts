/**
 * 供应链数据 API 服务
 * 
 * 提供客户、供应商的 API 调用方法
 */

import { api, apiRequest } from '../../../services/api';
import { searchUserIdOptions } from '../../../utils/userDisplay';
import { getSessionCurrentUser } from '../../../utils/sessionCurrentUser';
import {
  getDictionaryItemsCached,
  getDictionaryItemsSync,
} from '../../../services/dataDictionaryCache';
import { dedupeDictionaryOptionsByValue } from '../../../utils/dictionaryQuickCreate';
import type {
  Customer,
  CustomerCreate,
  CustomerUpdate,
  CustomerListParams,
  CustomerListResponse,
  Supplier,
  SupplierCreate,
  SupplierUpdate,
  SupplierListParams,
  SupplierListResponse,
} from '../types/supply-chain';

/** 客户/供应商列表统一为 { data, total }，下拉等场景取数组 */
export function unwrapSupplyPagedList<T>(res: { data?: T[]; total?: number } | T[] | null | undefined): T[] {
  if (res == null) return [];
  if (Array.isArray(res)) return res;
  return Array.isArray(res.data) ? res.data : [];
}

/**
 * 客户 API 服务
 */
export const customerApi = {
  /**
   * 创建客户
   */
  create: async (data: CustomerCreate): Promise<Customer> => {
    return api.post('/apps/master-data/supply-chain/customers', data);
  },

  /**
   * 批量创建客户（导入分片，单次最多 200）
   */
  bulkCreate: async (
    items: CustomerCreate[],
  ): Promise<{
    createdCount: number;
    failedCount: number;
    requestedCount: number;
    failedItems: Array<{ index: number; reason: string }>;
  }> => {
    const raw = (await api.post('/apps/master-data/supply-chain/customers/batch-create', {
      items,
    })) as Record<string, unknown>;
    const failedRaw = Array.isArray(raw?.failedItems)
      ? (raw.failedItems as Array<Record<string, unknown>>)
      : Array.isArray(raw?.failed_items)
        ? (raw.failed_items as Array<Record<string, unknown>>)
        : [];
    return {
      createdCount: Number(raw?.createdCount ?? raw?.created_count ?? 0) || 0,
      failedCount: Number(raw?.failedCount ?? raw?.failed_count ?? 0) || 0,
      requestedCount:
        Number(raw?.requestedCount ?? raw?.requested_count ?? items.length) || items.length,
      failedItems: failedRaw.map((f) => ({
        index: Number(f.index ?? 0) || 0,
        reason: String(f.reason ?? ''),
      })),
    };
  },

  /**
   * 获取客户列表
   */
  list: async (params?: CustomerListParams): Promise<CustomerListResponse> => {
    return api.get('/apps/master-data/supply-chain/customers', { params });
  },

  /**
   * 获取客户详情
   */
  get: async (uuid: string): Promise<Customer> => {
    return api.get(`/apps/master-data/supply-chain/customers/${uuid}`);
  },

  /**
   * 更新客户
   */
  update: async (uuid: string, data: CustomerUpdate): Promise<Customer> => {
    return api.put(`/apps/master-data/supply-chain/customers/${uuid}`, data);
  },

  /**
   * 删除客户
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/supply-chain/customers/${uuid}`);
  },
};

export type MasterDataSyncBinding = {
  source_type?: 'api' | 'dataset' | null;
  api_uuid?: string | null;
  dataset_uuid?: string | null;
  field_mapping: Record<string, string>;
  match_key_field?: string;
  sync_mode?: string;
  schedule_interval_minutes?: number;
  last_success_at?: string | null;
  last_attempt_at?: string | null;
  last_error?: string | null;
};

export type MasterDataSyncFromSourceResult = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
};

export async function getCustomerSyncBinding(): Promise<MasterDataSyncBinding> {
  return api.get('/apps/master-data/supply-chain/customers/sync-binding');
}

export async function syncCustomersFromSource(
  payload: {
    source_type?: 'api' | 'dataset';
    api_uuid?: string;
    dataset_uuid?: string;
    field_mapping?: Record<string, string>;
    save_binding?: boolean;
    sync_mode?: string;
    schedule_interval_minutes?: number;
    incremental?: boolean;
  active_only?: boolean;
  },
  onProgress?: (message: string) => void,
): Promise<MasterDataSyncFromSourceResult> {
  const { apiRequestSyncNdjson } = await import(
    '../../../components/sync-from-source-modal/apiRequestSyncNdjson'
  );
  return apiRequestSyncNdjson<MasterDataSyncFromSourceResult>(
    '/apps/master-data/supply-chain/customers/sync-from-source',
    {
      data: payload,
      timeoutMs: 600_000,
      onProgress,
    },
  );
}

export async function getSupplierSyncBinding(): Promise<MasterDataSyncBinding> {
  return api.get('/apps/master-data/supply-chain/suppliers/sync-binding');
}

export async function syncSuppliersFromSource(payload: {
  source_type?: 'api' | 'dataset';
  api_uuid?: string;
  dataset_uuid?: string;
  field_mapping?: Record<string, string>;
  save_binding?: boolean;
  skip_prerequisite_syncs?: boolean;
  sync_mode?: string;
  schedule_interval_minutes?: number;
  incremental?: boolean;
  active_only?: boolean;
}): Promise<MasterDataSyncFromSourceResult> {
  return apiRequest<MasterDataSyncFromSourceResult>(
    '/apps/master-data/supply-chain/suppliers/sync-from-source',
    {
      method: 'POST',
      data: payload,
      timeoutMs: 600_000,
    },
  );
}

/**
 * 供应商 API 服务
 */
export const supplierApi = {
  /**
   * 创建供应商
   */
  create: async (data: SupplierCreate): Promise<Supplier> => {
    return api.post('/apps/master-data/supply-chain/suppliers', data);
  },

  /**
   * 批量创建供应商（导入分片，单次最多 200）
   */
  bulkCreate: async (
    items: SupplierCreate[],
  ): Promise<{
    createdCount: number;
    failedCount: number;
    requestedCount: number;
    failedItems: Array<{ index: number; reason: string }>;
  }> => {
    const raw = (await api.post('/apps/master-data/supply-chain/suppliers/batch-create', {
      items,
    })) as Record<string, unknown>;
    const failedRaw = Array.isArray(raw?.failedItems)
      ? (raw.failedItems as Array<Record<string, unknown>>)
      : Array.isArray(raw?.failed_items)
        ? (raw.failed_items as Array<Record<string, unknown>>)
        : [];
    return {
      createdCount: Number(raw?.createdCount ?? raw?.created_count ?? 0) || 0,
      failedCount: Number(raw?.failedCount ?? raw?.failed_count ?? 0) || 0,
      requestedCount:
        Number(raw?.requestedCount ?? raw?.requested_count ?? items.length) || items.length,
      failedItems: failedRaw.map((f) => ({
        index: Number(f.index ?? 0) || 0,
        reason: String(f.reason ?? ''),
      })),
    };
  },

  /**
   * 获取供应商列表
   */
  list: async (params?: SupplierListParams): Promise<SupplierListResponse> => {
    return api.get('/apps/master-data/supply-chain/suppliers', { params });
  },

  /**
   * 获取供应商详情
   */
  get: async (uuid: string): Promise<Supplier> => {
    return api.get(`/apps/master-data/supply-chain/suppliers/${uuid}`);
  },

  /**
   * 更新供应商
   */
  update: async (uuid: string, data: SupplierUpdate): Promise<Supplier> => {
    return api.put(`/apps/master-data/supply-chain/suppliers/${uuid}`, data);
  },

  /**
   * 按交期/来料合格率重算评级
   */
  recalculateRating: async (
    uuid: string,
    lookbackDays = 90,
  ): Promise<{
    ratingGrade: string;
    ratingScore: number;
    otdRate?: number;
    qualityRate?: number;
  }> => {
    const raw = (await api.post(
      `/apps/master-data/supply-chain/suppliers/${uuid}/recalculate-rating`,
      null,
      { params: { lookback_days: lookbackDays } },
    )) as Record<string, unknown>;
    return {
      ratingGrade: String(raw.rating_grade ?? raw.ratingGrade ?? ''),
      ratingScore: Number(raw.rating_score ?? raw.ratingScore ?? 0),
      otdRate: raw.otd_rate != null ? Number(raw.otd_rate) : undefined,
      qualityRate: raw.quality_rate != null ? Number(raw.quality_rate) : undefined,
    };
  },

  /**
   * 删除供应商
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/supply-chain/suppliers/${uuid}`);
  },
};

/**
 * 获取用户选项列表（供 Schema Form / 业务选人使用）。
 * @param hostResource 宿主 {app}:{module}，无 system:user:read 时靠其隐式鉴权 display-search
 */
export const getUserOptions = async (hostResource?: string) => {
  const currentUser = getSessionCurrentUser();
  const opts = await searchUserIdOptions({
    pageSize: 200,
    isActive: true,
    currentUser,
    hostResource,
  });
  return opts.map((o) => ({ label: o.label, value: o.value }));
};

/**
 * 数据字典下拉选项（用于客户/供应商表单 optionsMap、列表标签映射等）。
 * 命中模块级缓存即同步返回；首次按 code 异步拉取并写缓存。
 * 同步缓存读取请改用 `getDictionaryOptionsSync(code)`。
 */
export const getDictionaryOptions = async (dictionaryCode: string) => {
  try {
    const items = await getDictionaryItemsCached(dictionaryCode);
    return dedupeDictionaryOptionsByValue(
      items.map((item) => ({ label: item.label, value: item.value, color: item.color })),
    );
  } catch {
    return [];
  }
};

/** 同步读取已缓存的字典选项；未命中返回 undefined（用于 useState 初始值） */
export const getDictionaryOptionsSync = (
  dictionaryCode: string,
): { label: string; value: string; color?: string }[] | undefined => {
  const items = getDictionaryItemsSync(dictionaryCode);
  return items?.map((item) => ({ label: item.label, value: item.value, color: item.color }));
};

