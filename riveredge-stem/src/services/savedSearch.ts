/**
 * 保存搜索条件服务
 * 
 * 提供保存搜索条件的 API 调用
 */

import { apiRequest } from './api';

/**
 * 保存搜索条件接口
 */
export interface SavedSearch {
  id: number; // 自增ID（内部使用，性能优先）
  uuid: string; // 业务ID（UUID，对外暴露，安全且唯一）
  tenant_id?: number;
  user_id: number;
  page_path: string;
  name: string;
  is_shared: boolean;
  is_pinned: boolean;
  search_params: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * 创建保存搜索条件请求参数
 */
export interface CreateSavedSearchParams {
  page_path: string;
  name: string;
  is_shared: boolean;
  is_pinned?: boolean;
  search_params: Record<string, any>;
}

/**
 * 更新保存搜索条件请求参数
 */
export interface UpdateSavedSearchParams {
  name?: string;
  is_shared?: boolean;
  is_pinned?: boolean;
  search_params?: Record<string, any>;
}

/**
 * 保存搜索条件列表响应
 */
export interface SavedSearchListResponse {
  total: number;
  items: SavedSearch[];
}

/**
 * 获取保存的搜索条件列表
 * 
 * @param pagePath - 页面路径
 * @param includeShared - 是否包含共享搜索条件（默认 true）
 * @returns 搜索条件列表
 */
export async function getSavedSearchList(
  pagePath: string,
  includeShared: boolean = true
): Promise<SavedSearchListResponse> {
  const response = await apiRequest<SavedSearchListResponse>(
    '/saved-searches',
    {
      method: 'GET',
      params: {
        page_path: pagePath,
        include_shared: includeShared,
      },
    }
  );
  return response;
}

/**
 * 创建保存搜索条件
 * 
 * @param data - 创建参数
 * @returns 创建的搜索条件
 */
export async function createSavedSearch(
  data: CreateSavedSearchParams
): Promise<SavedSearch> {
  const response = await apiRequest<SavedSearch>(
    '/saved-searches',
    {
      method: 'POST',
      data,
    }
  );
  return response;
}

/**
 * 获取单个保存的搜索条件
 * 
 * @param searchUuid - 搜索条件 UUID（业务ID）
 * @returns 搜索条件
 */
export async function getSavedSearch(searchUuid: string): Promise<SavedSearch> {
  const response = await apiRequest<SavedSearch>(
    `/saved-searches/${searchUuid}`,
    {
      method: 'GET',
    }
  );
  return response;
}

/**
 * 更新保存的搜索条件
 * 
 * @param searchUuid - 搜索条件 UUID（业务ID）
 * @param data - 更新参数
 * @returns 更新后的搜索条件
 */
export async function updateSavedSearch(
  searchUuid: string,
  data: UpdateSavedSearchParams
): Promise<SavedSearch> {
  const response = await apiRequest<SavedSearch>(
    `/saved-searches/${searchUuid}`,
    {
      method: 'PUT',
      data,
    }
  );
  return response;
}

/**
 * 删除保存的搜索条件
 * 
 * @param searchUuid - 搜索条件 UUID（业务ID）
 */
export async function deleteSavedSearch(searchUuid: string): Promise<void> {
  await apiRequest(
    `/saved-searches/${searchUuid}`,
    {
      method: 'DELETE',
    }
  );
}

