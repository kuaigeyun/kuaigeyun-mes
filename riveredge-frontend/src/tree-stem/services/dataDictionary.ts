/**
 * 数据字典 API 服务
 * 
 * 提供数据字典管理相关的 API 接口
 * 注意：所有 API 自动过滤当前组织的数据字典
 */

import { apiRequest } from './api';

/**
 * 数据字典信息接口
 */
export interface DataDictionary {
  uuid: string;
  name: string;
  code: string;
  description?: string;
  is_system: boolean;
  is_active: boolean;
  tenant_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * 字典项信息接口
 */
export interface DictionaryItem {
  uuid: string;
  dictionary_uuid: string;
  label: string;
  value: string;
  description?: string;
  color?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  tenant_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * 数据字典列表查询参数
 */
export interface DataDictionaryListParams {
  page?: number;
  page_size?: number;
  is_active?: boolean;
}

/**
 * 数据字典列表响应数据
 */
export interface DataDictionaryListResponse {
  items: DataDictionary[];
  total: number;
}

/**
 * 创建数据字典数据
 */
export interface CreateDataDictionaryData {
  name: string;
  code: string;
  description?: string;
  is_system?: boolean;
  is_active?: boolean;
}

/**
 * 更新数据字典数据
 */
export interface UpdateDataDictionaryData {
  name?: string;
  code?: string;
  description?: string;
  is_active?: boolean;
}

/**
 * 创建字典项数据
 */
export interface CreateDictionaryItemData {
  dictionary_uuid: string;
  label: string;
  value: string;
  description?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
  is_active?: boolean;
}

/**
 * 更新字典项数据
 */
export interface UpdateDictionaryItemData {
  label?: string;
  value?: string;
  description?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
  is_active?: boolean;
}

/**
 * 获取数据字典列表
 * 
 * 自动过滤当前组织的数据字典。
 * 
 * @param params - 查询参数
 * @returns 数据字典列表响应数据
 */
export async function getDataDictionaryList(params?: DataDictionaryListParams): Promise<DataDictionaryListResponse> {
  return apiRequest<DataDictionaryListResponse>('/system/data-dictionaries', {
    params,
  });
}

/**
 * 获取数据字典详情
 * 
 * 自动验证组织权限：只能获取当前组织的数据字典。
 * 
 * @param dictionaryUuid - 数据字典 UUID
 * @returns 数据字典信息
 */
export async function getDataDictionaryByUuid(dictionaryUuid: string): Promise<DataDictionary> {
  return apiRequest<DataDictionary>(`/system/data-dictionaries/${dictionaryUuid}`);
}

/**
 * 根据代码获取数据字典
 * 
 * @param code - 字典代码
 * @returns 数据字典信息
 */
export async function getDataDictionaryByCode(code: string): Promise<DataDictionary> {
  return apiRequest<DataDictionary>(`/system/data-dictionaries/code/${code}`);
}

/**
 * 创建数据字典
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 数据字典创建数据
 * @returns 创建的数据字典信息
 */
export async function createDataDictionary(data: CreateDataDictionaryData): Promise<DataDictionary> {
  return apiRequest<DataDictionary>('/system/data-dictionaries', {
    method: 'POST',
    data,
  });
}

/**
 * 更新数据字典
 * 
 * 自动验证组织权限：只能更新当前组织的数据字典。
 * 
 * @param dictionaryUuid - 数据字典 UUID
 * @param data - 数据字典更新数据
 * @returns 更新后的数据字典信息
 */
export async function updateDataDictionary(dictionaryUuid: string, data: UpdateDataDictionaryData): Promise<DataDictionary> {
  return apiRequest<DataDictionary>(`/system/data-dictionaries/${dictionaryUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除数据字典
 * 
 * 自动验证组织权限：只能删除当前组织的数据字典。
 * 系统字典不可删除。
 * 
 * @param dictionaryUuid - 数据字典 UUID
 */
export async function deleteDataDictionary(dictionaryUuid: string): Promise<void> {
  return apiRequest<void>(`/system/data-dictionaries/${dictionaryUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 获取字典项列表
 * 
 * 获取指定字典的所有字典项。
 * 
 * @param dictionaryUuid - 字典 UUID
 * @param is_active - 是否启用（可选）
 * @returns 字典项列表
 */
export async function getDictionaryItemList(dictionaryUuid: string, is_active?: boolean): Promise<DictionaryItem[]> {
  const params: any = {};
  if (is_active !== undefined) {
    params.is_active = is_active;
  }
  return apiRequest<DictionaryItem[]>(`/system/data-dictionaries/${dictionaryUuid}/items`, {
    params,
  });
}

/**
 * 创建字典项
 * 
 * @param dictionaryUuid - 字典 UUID
 * @param data - 字典项创建数据（会自动设置 dictionary_uuid）
 * @returns 创建的字典项信息
 */
export async function createDictionaryItem(dictionaryUuid: string, data: Omit<CreateDictionaryItemData, 'dictionary_uuid'>): Promise<DictionaryItem> {
  return apiRequest<DictionaryItem>(`/system/data-dictionaries/${dictionaryUuid}/items`, {
    method: 'POST',
    data: {
      ...data,
      dictionary_uuid: dictionaryUuid,
    },
  });
}

/**
 * 更新字典项
 * 
 * @param itemUuid - 字典项 UUID
 * @param data - 字典项更新数据
 * @returns 更新后的字典项信息
 */
export async function updateDictionaryItem(itemUuid: string, data: UpdateDictionaryItemData): Promise<DictionaryItem> {
  return apiRequest<DictionaryItem>(`/system/data-dictionaries/items/${itemUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除字典项
 * 
 * @param itemUuid - 字典项 UUID
 */
export async function deleteDictionaryItem(itemUuid: string): Promise<void> {
  return apiRequest<void>(`/system/data-dictionaries/items/${itemUuid}`, {
    method: 'DELETE',
  });
}

