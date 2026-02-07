/**
 * 权限 API 服务
 * 
 * 提供权限管理相关的 API 接口
 * 注意：所有 API 自动过滤当前组织的权限
 */

import { apiRequest } from './api';

/**
 * 权限信息接口
 */
export interface Permission {
  uuid: string;
  name: string;
  code: string;
  description?: string;
  resource: string;
  action: string;
  permission_type: string;
  is_system: boolean;
  tenant_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * 权限列表查询参数
 */
export interface PermissionListParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  name?: string;
  code?: string;
  resource?: string;
  permission_type?: string;
}

/**
 * 权限列表响应数据
 */
export interface PermissionListResponse {
  items: Permission[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * 获取权限列表
 * 
 * 自动过滤当前组织的权限。
 * 
 * @param params - 查询参数
 * @returns 权限列表响应数据
 */
export async function getPermissionList(params?: PermissionListParams): Promise<PermissionListResponse> {
  return apiRequest<PermissionListResponse>('/core/permissions', {
    params,
  });
}

/**
 * 获取权限详情
 * 
 * 自动验证组织权限：只能获取当前组织的权限。
 * 
 * @param permissionUuid - 权限 UUID
 * @returns 权限信息
 */
export async function getPermissionByUuid(permissionUuid: string): Promise<Permission> {
  return apiRequest<Permission>(`/core/permissions/${permissionUuid}`);
}

