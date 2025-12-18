/**
 * 用户 API 服务
 *
 * 提供用户管理相关的 API 接口
 * 注意：所有 API 自动过滤当前组织的用户
 */

// 使用 apiRequest 统一处理 HTTP 请求
import { apiRequest } from './api';

/**
 * 用户信息接口
 */
export interface User {
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
  phone?: string;
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

/**
 * 批量导入用户
 *
 * 接收 uni_import 组件传递的二维数组数据，批量创建用户。
 *
 * @param data - 二维数组数据（第一行为表头，第二行为示例数据，从第三行开始为实际数据）
 * @returns 导入结果（成功数、失败数、错误列表）
 */
export async function importUsers(data: any[][]): Promise<{
  success_count: number;
  failure_count: number;
  errors: Array<{ row: number; message: string }>;
}> {
  return apiRequest<{
    success_count: number;
    failure_count: number;
    errors: Array<{ row: number; message: string }>;
  }>('/core/users/import', {
    method: 'POST',
    data: { data },
  });
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
  const response = await fetch(
    `${import.meta.env.VITE_API_TARGET || `http://${import.meta.env.VITE_BACKEND_HOST || '127.0.0.1'}:${import.meta.env.VITE_BACKEND_PORT || '8200'}`}/api/v1/core/users/export?${new URLSearchParams(
      Object.entries(params || {}).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          acc[key] = String(value);
        }
        return acc;
      }, {} as Record<string, string>)
    ).toString()}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    }
  );
  
  if (!response.ok) {
    throw new Error('导出失败');
  }
  
  return response.blob();
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
  }>('/core/users/batch/delete', {
    method: 'POST',
    data: {
      user_uuids: userUuids,
    },
  });
}

