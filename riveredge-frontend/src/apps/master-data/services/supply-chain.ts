/**
 * 供应链数据 API 服务
 * 
 * 提供客户、供应商的 API 调用方法
 */

import { api } from '../../../services/api';
import { useGlobalStore } from '../../../stores';
import { searchUserIdOptions } from '../../../utils/userDisplay';
import {
  getDictionaryItemsCached,
  getDictionaryItemsSync,
} from '../../../services/dataDictionaryCache';
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
   * 删除供应商
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/supply-chain/suppliers/${uuid}`);
  },
};

/**
 * 获取用户选项列表（供 Schema Form 使用）
 */
export const getUserOptions = async () => {
  try {
    const currentUser = useGlobalStore.getState().currentUser;
    const opts = await searchUserIdOptions({ pageSize: 200, isActive: true, currentUser });
    return opts.map((o) => ({ label: o.label, value: o.value }));
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return [];
  }
};

/**
 * 数据字典下拉选项（用于客户/供应商表单 optionsMap、列表标签映射等）。
 * 命中模块级缓存即同步返回；首次按 code 异步拉取并写缓存。
 * 同步缓存读取请改用 `getDictionaryOptionsSync(code)`。
 */
export const getDictionaryOptions = async (dictionaryCode: string) => {
  try {
    const items = await getDictionaryItemsCached(dictionaryCode);
    return items.map((item) => ({ label: item.label, value: item.value }));
  } catch {
    return [];
  }
};

/** 同步读取已缓存的字典选项；未命中返回 undefined（用于 useState 初始值） */
export const getDictionaryOptionsSync = (
  dictionaryCode: string,
): { label: string; value: string }[] | undefined => {
  const items = getDictionaryItemsSync(dictionaryCode);
  return items?.map((item) => ({ label: item.label, value: item.value }));
};

