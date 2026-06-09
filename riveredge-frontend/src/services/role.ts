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
 * 角色信息接口
 */
export interface Role {
  uuid: string;
  name: string;
  code: string;
  description?: string;
  role_type: 'internal' | 'external';
  external_partner_type?: 'customer' | 'supplier';
  is_system: boolean;
  is_active: boolean;
  home_path?: string | null;
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
  name?: string;
  code?: string;
  is_active?: boolean;
  is_system?: boolean;
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
  role_type?: 'internal' | 'external';
  external_partner_type?: 'customer' | 'supplier';
  is_active?: boolean;
  home_path?: string | null;
  /** 是否同步创建同名同代码职位 */
  create_position?: boolean;
}

/**
 * 更新角色数据
 */
export interface UpdateRoleData {
  name?: string;
  code?: string;
  description?: string;
  role_type?: 'internal' | 'external';
  external_partner_type?: 'customer' | 'supplier';
  is_active?: boolean;
  home_path?: string | null;
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
  return apiRequest<RoleListResponse>('/core/roles', {
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
  return apiRequest<Role>(`/core/roles/${roleUuid}`);
}

export interface RoleUserListItem {
  uuid: string;
  username: string;
  full_name?: string | null;
  department_name?: string | null;
  is_active: boolean;
}

export interface RoleUserListResponse {
  items: RoleUserListItem[];
  total: number;
}

export async function getRoleUsers(roleUuid: string): Promise<RoleUserListResponse> {
  return apiRequest<RoleUserListResponse>(`/core/roles/${roleUuid}/users`);
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
  return apiRequest<Role>('/core/roles', {
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
  return apiRequest<Role>(`/core/roles/${roleUuid}`, {
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
  return apiRequest<void>(`/core/roles/${roleUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 分配权限给角色
 * 
 * 为角色分配权限列表，自动验证组织权限。
 * 
 * @param roleUuid - 角色 UUID
 * @param permissionUuids - 权限 UUID 列表
 * @returns 更新后的角色信息
 */
export async function assignPermissions(roleUuid: string, permissionUuids: string[]): Promise<Role> {
  return apiRequest<Role>(`/core/roles/${roleUuid}/permissions`, {
    method: 'POST',
    data: {
      permission_uuids: permissionUuids, // 后端期望对象格式：{ permission_uuids: [...] }
    },
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
  return apiRequest<Permission[]>(`/core/roles/${roleUuid}/permissions`);
}

/** 功能权限矩阵：服务端菜单树 + 按 code 授权 */
export interface FunctionGrantAction {
  action: string;
  code: string;
  label: string;
  uuid: string;
  granted: boolean;
  merged_codes?: string[] | null;
}

export interface FunctionGrantMenuNode {
  menu_uuid: string;
  title: string;
  path?: string | null;
  resource?: string | null;
  actions: FunctionGrantAction[];
  children: FunctionGrantMenuNode[];
}

export interface FunctionGrantStats {
  total_function_codes: number;
  granted_function_codes: number;
  granted_visible_on_tree: number;
  granted_not_on_tree: number;
}

export interface RoleFunctionGrants {
  role_uuid: string;
  granted_codes: string[];
  tree: FunctionGrantMenuNode[];
  stats: FunctionGrantStats;
}

export async function getRoleFunctionGrants(roleUuid: string): Promise<RoleFunctionGrants> {
  return apiRequest<RoleFunctionGrants>(`/core/roles/${roleUuid}/function-grants`);
}

export async function replaceRoleFunctionGrants(
  roleUuid: string,
  codes: string[]
): Promise<RoleFunctionGrants> {
  return apiRequest<RoleFunctionGrants>(`/core/roles/${roleUuid}/function-grants`, {
    method: 'PUT',
    data: { codes },
  });
}

/**
 * 获取所有权限列表
 * 
 * 获取当前组织的所有权限，用于权限分配。
 * 
 * @param params - 查询参数
 * @returns 权限列表响应数据
 */
export async function getAllPermissions(params?: {
  page?: number;
  page_size?: number;
  keyword?: string;
  exclude_derived_data?: boolean;
}): Promise<PermissionListResponse> {
  return apiRequest<PermissionListResponse>('/core/permissions', {
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

export interface DataPermissionPolicy {
  uuid: string;
  role_uuid: string;
  resource: string;
  scope_type: 'scope_all' | 'scope_department' | 'scope_self' | 'scope_custom';
  scope_payload?: Record<string, any>;
}

export interface FieldPermissionPolicy {
  uuid: string;
  role_uuid: string;
  resource: string;
  field_name: string;
  field_label?: string;
  mask_level: 'full' | 'masked' | 'hidden';
}

export async function getRoleDataPolicies(roleUuid: string): Promise<DataPermissionPolicy[]> {
  return apiRequest<DataPermissionPolicy[]>(`/core/permission-policies/roles/${roleUuid}/data`);
}

export async function saveRoleDataPolicies(
  roleUuid: string,
  items: Array<Pick<DataPermissionPolicy, 'resource' | 'scope_type' | 'scope_payload'>>
): Promise<DataPermissionPolicy[]> {
  return apiRequest<DataPermissionPolicy[]>(`/core/permission-policies/roles/${roleUuid}/data`, {
    method: 'PUT',
    data: items,
  });
}

export async function getRoleFieldPolicies(roleUuid: string): Promise<FieldPermissionPolicy[]> {
  return apiRequest<FieldPermissionPolicy[]>(`/core/permission-policies/roles/${roleUuid}/field`);
}

export async function saveRoleFieldPolicies(
  roleUuid: string,
  items: Array<Pick<FieldPermissionPolicy, 'resource' | 'field_name' | 'mask_level'>>
): Promise<FieldPermissionPolicy[]> {
  return apiRequest<FieldPermissionPolicy[]>(`/core/permission-policies/roles/${roleUuid}/field`, {
    method: 'PUT',
    data: items,
  });
}

/** 预设角色项（与后端 PRESET_ROLES 一致） */
export interface PresetRoleItem {
  name: string;
  code: string;
  description?: string;
}

export async function getRolePresetPreview(): Promise<PresetRoleItem[]> {
  return apiRequest<PresetRoleItem[]>('/core/roles/preset-preview');
}

/**
 * 加载中国中小制造业极简角色预设数据
 * @param codes 仅创建指定编码；不传则创建全部预设
 */
export async function loadPresetRoles(codes?: string[]): Promise<{ created: number; message: string }> {
  return apiRequest<{ created: number; message: string }>('/core/roles/load-preset', {
    method: 'POST',
    data: codes?.length ? { codes } : undefined,
  });
}

/**
 * 手动清理旧预设角色（迁移/合并/去重）
 */
export async function cleanupLegacyRoles(): Promise<{
  success: boolean;
  message: string;
  renamed: number;
  merged: number;
  soft_deleted: number;
  permission_synced: number;
}> {
  return apiRequest('/core/roles/cleanup-legacy', {
    method: 'POST',
  });
}

