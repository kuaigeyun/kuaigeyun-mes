/**
 * 用户 API 服务
 *
 * 提供用户管理相关的 API 接口
 * 注意：所有 API 自动过滤当前租户的用户
 */

// 使用 apiRequest 统一处理 HTTP 请求
import { apiRequest } from './api';

/**
 * 用户信息接口
 */
export interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  is_active: boolean;
  is_superuser: boolean;
  is_tenant_admin: boolean;
  tenant_id: number;
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
  is_active?: boolean;
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
  email: string;
  password: string;
  full_name?: string;
  is_active?: boolean;
  is_superuser?: boolean;
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
  is_active?: boolean;
  is_superuser?: boolean;
  is_tenant_admin?: boolean;
}

/**
 * 获取用户列表
 *
 * 自动过滤当前租户的用户。
 *
 * @param params - 查询参数
 * @returns 用户列表响应数据
 */
export async function getUserList(params: UserListParams): Promise<UserListResponse> {
  return apiRequest<UserListResponse>('/users', {
    params,
  });
}

/**
 * 获取用户详情
 *
 * 自动验证租户权限：只能获取当前租户的用户。
 *
 * @param userId - 用户 ID
 * @returns 用户信息
 */
export async function getUserById(userId: number): Promise<User> {
  return apiRequest<User>(`/users/${userId}`);
}

/**
 * 创建用户
 *
 * 自动设置当前租户的 tenant_id。
 *
 * @param data - 用户创建数据（tenant_id 将从当前用户上下文自动获取）
 * @returns 创建的用户信息
 */
export async function createUser(data: CreateUserData): Promise<User> {
  return apiRequest<User>('/users', {
    method: 'POST',
    data,
  });
}

/**
 * 更新用户
 *
 * 自动验证租户权限：只能更新当前租户的用户。
 *
 * @param userId - 用户 ID
 * @param data - 用户更新数据
 * @returns 更新后的用户信息
 */
export async function updateUser(userId: number, data: UpdateUserData): Promise<User> {
  return apiRequest<User>(`/users/${userId}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除用户
 *
 * 自动验证租户权限：只能删除当前租户的用户。
 *
 * @param userId - 用户 ID
 */
export async function deleteUser(userId: number): Promise<void> {
  return apiRequest<void>(`/users/${userId}`, {
    method: 'DELETE',
  });
}

/**
 * 切换用户状态
 *
 * 切换用户的激活状态（激活/停用）。
 *
 * @param userId - 用户 ID
 * @returns 更新后的用户信息
 */
export async function toggleUserStatus(userId: number): Promise<User> {
  return apiRequest<User>(`/users/${userId}/toggle-status`, {
    method: 'PATCH',
  });
}

