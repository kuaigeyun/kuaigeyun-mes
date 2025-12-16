/**
 * 平台超级管理员 API 服务
 * 
 * 提供平台超级管理员相关的 API 接口
 * 平台超级管理员是平台唯一的，独立于租户系统
 */

import { apiRequest } from './api';

/**
 * 平台超级管理员信息接口
 */
export interface InfraSuperAdmin {
  id: number;
  uuid: string;
  username: string;
  email?: string;
  full_name?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 平台超级管理员登录请求接口
 */
export interface InfraSuperAdminLoginRequest {
  username: string;
  password: string;
}

/**
 * 平台超级管理员登录响应接口
 */
export interface InfraSuperAdminLoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: InfraSuperAdmin;
  default_tenant_id?: number; // 默认租户 ID（可选，用于设置默认组织上下文）
}

/**
 * 平台超级管理员创建请求接口
 */
export interface InfraSuperAdminCreateRequest {
  username: string;
  email?: string;
  password: string;
  full_name?: string;
  is_active?: boolean;
}

/**
 * 平台超级管理员更新请求接口
 */
export interface InfraSuperAdminUpdateRequest {
  email?: string;
  full_name?: string;
  is_active?: boolean;
  password?: string;
}

/**
 * 平台超级管理员登录
 * 
 * @param data - 登录数据
 * @returns 登录响应数据
 */
export async function infraSuperAdminLogin(
  data: InfraSuperAdminLoginRequest
): Promise<InfraSuperAdminLoginResponse> {
  return apiRequest<InfraSuperAdminLoginResponse>('/infra/auth/login', {
    method: 'POST',
    data,
  });
}

/**
 * 获取当前平台超级管理员信息
 * 
 * @returns 当前平台超级管理员信息
 */
export async function getCurrentInfraSuperAdmin(): Promise<InfraSuperAdmin> {
  return apiRequest<InfraSuperAdmin>('/infra/auth/me', {
    method: 'GET',
  });
}

/**
 * 获取平台超级管理员信息
 * 
 * @returns 平台超级管理员信息
 */
export async function getInfraSuperAdmin(): Promise<InfraSuperAdmin> {
  return apiRequest<InfraSuperAdmin>('/infra/admin', {
    method: 'GET',
  });
}

/**
 * 创建平台超级管理员
 * 
 * @param data - 创建数据
 * @returns 创建的平台超级管理员信息
 */
export async function createInfraSuperAdmin(
  data: InfraSuperAdminCreateRequest
): Promise<InfraSuperAdmin> {
  return apiRequest<InfraSuperAdmin>('/infra/admin', {
    method: 'POST',
    data,
  });
}

/**
 * 更新平台超级管理员信息
 * 
 * @param data - 更新数据
 * @returns 更新后的平台超级管理员信息
 */
export async function updateInfraSuperAdmin(
  data: InfraSuperAdminUpdateRequest
): Promise<InfraSuperAdmin> {
  return apiRequest<InfraSuperAdmin>('/infra/admin', {
    method: 'PUT',
    data,
  });
}


