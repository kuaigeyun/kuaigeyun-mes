/**
 * 用户 API 服务
 *
 * 提供用户管理相关的 API 接口
 * 注意：所有 API 自动过滤当前组织的用户
 */

// 使用 apiRequest 统一处理 HTTP 请求
import { getToken, getTenantId } from '../utils/auth';
import { updateLastActivity, incrementPendingRequests, decrementPendingRequests } from '../utils/activityUtils';
import { apiRequest } from './api';
import { requestDisplayResolve, requestDisplaySearch } from './displayContract';

/**
 * 用户信息接口
 */
export interface User {
  id: number;
  uuid: string;
  username: string;
  email?: string;
  full_name?: string;
  phone?: string;
  is_active: boolean;
  is_infra_admin?: boolean;
  is_tenant_admin: boolean;
  tenant_id: number;
  department_uuid?: string;
  department?: {
    uuid: string;
    name: string;
    code?: string;
  };
  position_uuid?: string;
  position?: {
    uuid: string;
    name: string;
    code?: string;
  };
  roles?: Array<{
    uuid: string;
    name: string;
    code: string;
  }>;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 用户列表查询参数
 */
export interface UserListParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  username?: string;
  email?: string;
  full_name?: string;
  phone?: string;
  department_uuid?: string;
  position_uuid?: string;
  is_active?: boolean;
  is_tenant_admin?: boolean;
}

/**
 * 用户列表响应数据
 */
export interface UserListResponse {
  items: User[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * 创建用户数据
 *
 * 注意：tenant_id 将从当前用户上下文自动获取，无需在请求中提供
 */
export interface CreateUserData {
  username: string;
  email?: string;
  password: string;
  full_name?: string;
  phone: string;  // 修改为必填，与后端UserCreateRequest一致
  department_uuid?: string;
  position_uuid?: string;
  role_uuids?: string[];
  is_active?: boolean;
  is_tenant_admin?: boolean;
}

/**
 * 更新用户数据
 */
export interface UpdateUserData {
  username?: string;
  email?: string;
  password?: string;
  full_name?: string;
  phone?: string;
  department_uuid?: string;
  position_uuid?: string;
  role_uuids?: string[];
  is_active?: boolean;
  is_tenant_admin?: boolean;
}

export interface UserDataScopeBindingItem {
  dimension: string;
  scope_code: string;
  scope_name?: string;
}

export interface UserDataScopeBindingReplacePayload {
  dimension: string;
  items: UserDataScopeBindingItem[];
}

/**
 * 获取用户列表
 *
 * 自动过滤当前组织的用户。
 *
 * @param params - 查询参数
 * @returns 用户列表响应数据
 */
export async function getUserList(params?: UserListParams): Promise<UserListResponse> {
  return apiRequest<UserListResponse>('/core/users', {
    params,
  });
}

/**
 * 获取用户详情
 *
 * 自动验证组织权限：只能获取当前组织的用户。
 *
 * @param userUuid - 用户 UUID
 * @returns 用户信息
 */
export async function getUserByUuid(userUuid: string): Promise<User> {
  return apiRequest<User>(`/core/users/${userUuid}`);
}

/**
 * 创建用户
 *
 * 自动设置当前组织的 tenant_id。
 *
 * @param data - 用户创建数据（tenant_id 将从当前用户上下文自动获取）
 * @returns 创建的用户信息
 */
export async function createUser(data: CreateUserData): Promise<User> {
  return apiRequest<User>('/core/users', {
    method: 'POST',
    data,
  });
}

/**
 * 更新用户
 *
 * 自动验证组织权限：只能更新当前组织的用户。
 *
 * @param userUuid - 用户 UUID
 * @param data - 用户更新数据
 * @returns 更新后的用户信息
 */
export async function updateUser(userUuid: string, data: UpdateUserData): Promise<User> {
  return apiRequest<User>(`/core/users/${userUuid}`, {
    method: 'PUT',
    data,
  });
}

export async function getUserDataScopeBindings(
  userUuid: string,
  dimension?: string
): Promise<UserDataScopeBindingItem[]> {
  return apiRequest<UserDataScopeBindingItem[]>(`/core/users/by-uuid/${userUuid}/data-scope-bindings`, {
    params: dimension ? { dimension } : undefined,
  });
}

export async function replaceUserDataScopeBindings(
  userUuid: string,
  payload: UserDataScopeBindingReplacePayload
): Promise<UserDataScopeBindingItem[]> {
  return apiRequest<UserDataScopeBindingItem[]>(`/core/users/by-uuid/${userUuid}/data-scope-bindings`, {
    method: 'PUT',
    data: payload,
  });
}

/**
 * 删除用户
 *
 * 自动验证组织权限：只能删除当前组织的用户。
 * 平台管理员和当前登录用户不可删除。
 *
 * @param userUuid - 用户 UUID
 */
export async function deleteUser(userUuid: string): Promise<void> {
  return apiRequest<void>(`/core/users/${userUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 重置用户密码
 *
 * 重置指定用户的密码为默认密码。
 *
 * @param userUuid - 用户 UUID
 * @param newPassword - 新密码（可选，不提供则使用默认密码）
 * @returns 更新后的用户信息
 */
export async function resetUserPassword(userUuid: string, newPassword?: string): Promise<User> {
  return apiRequest<User>(`/core/users/${userUuid}/reset-password`, {
    method: 'POST',
    data: newPassword ? { password: newPassword } : {},
  });
}

export interface UserImportPreviewResult {
  missing_departments: string[];
  missing_positions: string[];
  missing_roles: string[];
  has_missing: boolean;
}

export interface UserImportResult {
  success_count: number;
  failure_count: number;
  errors: Array<{ row: number; message: string }>;
}

function normalizeUserImportErrors(
  errors: Array<{ row: number; message?: string; error?: string }>
): Array<{ row: number; message: string }> {
  return errors.map(item => ({
    row: item.row,
    message: item.message ?? item.error ?? '',
  }));
}

/**
 * 预览用户导入：返回系统中不存在的部门、职位、角色
 */
export async function previewUserImport(data: any[][]): Promise<UserImportPreviewResult> {
  return apiRequest<UserImportPreviewResult>('/core/users/import/preview', {
    method: 'POST',
    data: { data },
  });
}

/**
 * 批量导入用户
 *
 * 接收 uni_import 组件传递的二维数组数据，批量创建用户。
 *
 * @param data - 二维数组数据（第一行为表头，第二行为示例数据，从第三行开始为实际数据）
 * @param options.autoCreateReferences - 为 true 时自动创建不存在的部门/职位/角色
 * @returns 导入结果（成功数、失败数、错误列表）
 */
export async function importUsers(
  data: any[][],
  options?: { autoCreateReferences?: boolean }
): Promise<UserImportResult> {
  const result = await apiRequest<{
    success_count: number;
    failure_count: number;
    errors: Array<{ row: number; message?: string; error?: string }>;
  }>('/core/users/import', {
    method: 'POST',
    data: {
      data,
      auto_create_references: options?.autoCreateReferences ?? false,
    },
  });
  return {
    success_count: result.success_count,
    failure_count: result.failure_count,
    errors: normalizeUserImportErrors(result.errors ?? []),
  };
}

/**
 * 导出用户
 *
 * 根据筛选条件导出用户列表到 CSV 文件。
 *
 * @param params - 导出筛选条件
 * @returns 文件下载 URL
 */
export async function exportUsers(params?: UserListParams): Promise<Blob> {
  updateLastActivity(true);
  incrementPendingRequests();
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${getToken()}`,
    };
    const tenantId = getTenantId();
    if (tenantId != null) {
      headers['X-Tenant-ID'] = String(tenantId);
    }

    const response = await fetch(
      `/api/v1/core/users/export?${new URLSearchParams(
        Object.entries(params || {}).reduce((acc, [key, value]) => {
          if (value !== undefined && value !== null) {
            acc[key] = String(value);
          }
          return acc;
        }, {} as Record<string, string>)
      ).toString()}`,
      {
        method: 'GET',
        headers,
      }
    );

    if (!response.ok) {
      throw new Error('导出失败');
    }

    return response.blob();
  } finally {
    // 与 apiRequest 一致：结束时刻刷新活动，避免长导出结束后立刻被判无操作
    updateLastActivity(true);
    decrementPendingRequests();
  }
}

/**
 * 批量更新用户状态
 *
 * 批量启用或禁用用户。
 *
 * @param userUuids - 用户 UUID 列表
 * @param isActive - 是否激活
 * @returns 更新结果
 */
export async function batchUpdateUsersStatus(userUuids: string[], isActive: boolean): Promise<{
  success_count: number;
  failure_count: number;
}> {
  return apiRequest<{
    success_count: number;
    failure_count: number;
  }>('/core/users/batch/status', {
    method: 'POST',
    data: {
      user_uuids: userUuids,
      is_active: isActive,
    },
  });
}

/**
 * 批量删除用户
 *
 * 批量删除用户（软删除）。
 *
 * @param userUuids - 用户 UUID 列表
 * @returns 删除结果
 */
export async function batchDeleteUsers(userUuids: string[]): Promise<{
  success_count: number;
  failure_count: number;
  errors: Array<{ uuid: string; message: string }>;
}> {
  return apiRequest<{
    success_count: number;
    failure_count: number;
    errors: Array<{ uuid: string; message: string }>;
  }>('/core/users/batch-delete', {
    method: 'POST',
    data: {
      user_uuids: userUuids,
    },
  });
}

/**
 * 生成人员二维码
 *
 * @param userUuid - 用户 UUID
 * @param username - 用户名
 * @param fullName - 姓名
 * @returns 二维码生成响应
 */
export async function generateUserQRCode(userUuid: string, username: string, fullName?: string): Promise<any> {
  const { qrcodeApi } = await import('./qrcode');
  return qrcodeApi.generateEmployee({
    employee_uuid: userUuid,
    employee_code: username,
    employee_name: fullName || username,
  });
}

/** 人员展示项（选人/回显，非人员管理全量读） */
export interface UserDisplayRoleItem {
  uuid: string;
  name: string;
  code?: string;
}

export interface UserDisplayItem {
  id: number;
  uuid: string;
  username: string;
  full_name?: string | null;
  label: string;
  department_uuid?: string | null;
  roles?: UserDisplayRoleItem[];
}

export interface UserDisplayListParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  department_uuid?: string;
  position_uuid?: string;
  is_active?: boolean;
  host_resource?: string;
}

export interface UserDisplayListResponse {
  items: UserDisplayItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface UserDisplayResolvePayload {
  user_ids?: number[];
  user_uuids?: string[];
  host_resource?: string;
}

/**
 * 人员展示搜索（是否允许由后端统一鉴权裁决）
 */
export async function searchUserDisplay(
  params?: UserDisplayListParams,
): Promise<UserDisplayListResponse> {
  const safeParams: UserDisplayListParams = {
    ...(params || {}),
    page_size:
      params?.page_size == null
        ? params?.page_size
        : Math.max(1, Math.min(200, Number(params.page_size) || 50)),
  };
  return requestDisplaySearch<UserDisplayListResponse>(
    '/core/users/display-search',
    safeParams,
    '人员展示加载失败',
  );
}

/** 平台超管：在指定租户上下文中搜索人员（如极光推送测试） */
export async function searchUserDisplayInTenant(
  tenantId: number,
  params?: UserDisplayListParams,
): Promise<UserDisplayListResponse> {
  return requestDisplaySearch<UserDisplayListResponse>(
    '/core/users/display-search',
    params || {},
    '人员展示加载失败',
    { headers: { 'X-Tenant-ID': String(tenantId) }, autoHostResource: false },
  );
}

/**
 * 按 ID/UUID 批量解析人员展示名
 */
export async function resolveUserDisplay(
  payload: UserDisplayResolvePayload,
): Promise<UserDisplayItem[]> {
  const res = await requestDisplayResolve<{ items: UserDisplayItem[] }>(
    '/core/users/display-resolve',
    payload || {},
    '人员展示解析失败',
  );
  return res.items || [];
}

/**
 * 获取指定用户的生物特征注册选项
 */
export async function getUserBiometricRegisterOptions(userUuid: string): Promise<any> {
  return apiRequest(`/core/users/${userUuid}/biometric/register-options`);
}

/**
 * 完成指定用户的生物特征注册
 */
export async function finalizeUserBiometricRegistration(userUuid: string, data: any): Promise<any> {
  return apiRequest(`/core/users/${userUuid}/biometric/register-finalize`, {
    method: 'POST',
    data,
  });
}
