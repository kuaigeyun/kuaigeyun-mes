/**
 * 角色 API 服务
 * 
 * 提供角色管理相关的 API 接口
 * 注意：所有 API 自动过滤当前组织的角色
 */

// 使用 apiRequest 统一处理 HTTP 请求


import { apiRequest } from './api';

/**
 * 权限信息接口
 */
export interface Permission {
  id: number;
  name: string;
  code: string;
  description?: string;
  resource: string;
  action: string;
  is_system: boolean;
  tenant_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * 角色信息接口
 */
export interface Role {
  uuid: string;
  name: string;
  code: string;
  description?: string;
  is_system: boolean;
  is_active: boolean;
  tenant_id: number;
  permission_count?: number;
  user_count?: number;
  permissions?: Permission[];
  created_at: string;
  updated_at: string;
}

/**
 * 角色列表查询参数
 */
export interface RoleListParams {
  page?: number;
  page_size?: number;
  keyword?: string;
}

/**
 * 角色列表响应数据
 */
export interface RoleListResponse {
  items: Role[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * 创建角色数据
 * 
 * 注意：tenant_id 将从当前用户上下文自动获取，无需在请求中提供
 */
export interface CreateRoleData {
  name: string;
  code: string;
  description?: string;
  is_system?: boolean;
}

/**
 * 更新角色数据
 */
export interface UpdateRoleData {
  name?: string;
  code?: string;
  description?: string;
  is_system?: boolean;
}

/**
 * 获取角色列表
 * 
 * 自动过滤当前组织的角色。
 * 
 * @param params - 查询参数
 * @returns 角色列表响应数据
 */
export async function getRoleList(params?: RoleListParams): Promise<RoleListResponse> {
  return apiRequest<RoleListResponse>('/system/roles', {
    params,
  });
}

/**
 * 获取角色详情
 * 
 * 自动验证组织权限：只能获取当前组织的角色。
 * 
 * @param roleId - 角色 ID
 * @returns 角色信息
 */
export async function getRoleByUuid(roleUuid: string): Promise<Role> {
  return apiRequest<Role>(`/system/roles/${roleUuid}`);
}

/**
 * 创建角色
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 角色创建数据（tenant_id 将从当前用户上下文自动获取）
 * @returns 创建的角色信息
 */
export async function createRole(data: CreateRoleData): Promise<Role> {
  return apiRequest<Role>('/system/roles', {
    method: 'POST',
    data,
  });
}

/**
 * 更新角色
 * 
 * 自动验证组织权限：只能更新当前组织的角色。
 * 
 * @param roleId - 角色 ID
 * @param data - 角色更新数据
 * @returns 更新后的角色信息
 */
export async function updateRole(roleUuid: string, data: UpdateRoleData): Promise<Role> {
  return apiRequest<Role>(`/system/roles/${roleUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除角色
 * 
 * 自动验证组织权限：只能删除当前组织的角色。
 * 系统角色不可删除。
 * 
 * @param roleId - 角色 ID
 */
export async function deleteRole(roleUuid: string): Promise<void> {
  return apiRequest<void>(`/system/roles/${roleUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 分配权限给角色
 * 
 * 为角色分配权限列表，自动验证组织权限。
 * 
 * @param roleId - 角色 ID
 * @param permissionIds - 权限 ID 列表
 * @returns 更新后的角色信息
 */
export async function assignPermissions(roleUuid: string, permissionUuids: string[]): Promise<Role> {
  return apiRequest<Role>(`/system/roles/${roleUuid}/permissions`, {
    method: 'POST',
    data: permissionUuids, // 后端 Body 接收 UUID 数组
  });
}

/**
 * 获取角色权限列表
 * 
 * 获取角色的所有权限，自动过滤组织。
 * 
 * @param roleId - 角色 ID
 * @returns 权限列表
 */
export async function getRolePermissions(roleUuid: string): Promise<Permission[]> {
  return apiRequest<Permission[]>(`/system/roles/${roleUuid}/permissions`);
}

/**
 * 获取所有权限列表
 * 
 * 获取当前组织的所有权限，用于权限分配。
 * 
 * @param params - 查询参数
 * @returns 权限列表响应数据
 */
export async function getAllPermissions(params?: { page?: number; page_size?: number; keyword?: string }): Promise<PermissionListResponse> {
  return apiRequest<PermissionListResponse>('/system/permissions', {
    params,
  });
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

