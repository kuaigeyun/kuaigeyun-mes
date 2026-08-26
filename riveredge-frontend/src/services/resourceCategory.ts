/**
 * 资源分类（接口 / 数据集）管理服务
 */

import { apiRequest } from './api';

export type ResourceCategoryType = 'api' | 'dataset';

export interface ResourceCategory {
  uuid: string;
  tenant_id: number;
  name: string;
  code: string;
  description?: string;
  resource_type: ResourceCategoryType;
  sort_order: number;
  is_active: boolean;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface ResourceCategoryListResponse {
  items: ResourceCategory[];
  total_count: number;
  uncategorized_count: number;
}

export interface CreateResourceCategoryData {
  name: string;
  code: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface UpdateResourceCategoryData {
  name?: string;
  code?: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface ResourceCategoryListFilter {
  category_uuid?: string;
  no_category?: boolean;
}

export const RESOURCE_CATEGORY_ALL_KEY = 'all';
export const RESOURCE_CATEGORY_UNCATEGORIZED_KEY = 'uncategorized';

function categoryBasePath(resourceType: ResourceCategoryType): string {
  return resourceType === 'api' ? '/core/apis/categories' : '/core/datasets/categories';
}

export async function listResourceCategories(
  resourceType: ResourceCategoryType,
): Promise<ResourceCategoryListResponse> {
  return apiRequest<ResourceCategoryListResponse>(categoryBasePath(resourceType));
}

export async function createResourceCategory(
  resourceType: ResourceCategoryType,
  data: CreateResourceCategoryData,
): Promise<ResourceCategory> {
  return apiRequest<ResourceCategory>(categoryBasePath(resourceType), {
    method: 'POST',
    data,
  });
}

export async function updateResourceCategory(
  resourceType: ResourceCategoryType,
  categoryUuid: string,
  data: UpdateResourceCategoryData,
): Promise<ResourceCategory> {
  return apiRequest<ResourceCategory>(`${categoryBasePath(resourceType)}/${categoryUuid}`, {
    method: 'PUT',
    data,
  });
}

export async function deleteResourceCategory(
  resourceType: ResourceCategoryType,
  categoryUuid: string,
): Promise<void> {
  return apiRequest<void>(`${categoryBasePath(resourceType)}/${categoryUuid}`, {
    method: 'DELETE',
  });
}

export function resolveResourceCategoryListFilter(
  selectedKey: string,
): ResourceCategoryListFilter {
  if (selectedKey === RESOURCE_CATEGORY_ALL_KEY) {
    return {};
  }
  if (selectedKey === RESOURCE_CATEGORY_UNCATEGORIZED_KEY) {
    return { no_category: true };
  }
  return { category_uuid: selectedKey };
}
