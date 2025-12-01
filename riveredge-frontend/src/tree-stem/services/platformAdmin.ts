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
export interface PlatformSuperAdmin {
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
export interface PlatformSuperAdminLoginRequest {
  username: string;
  password: string;
}

/**
 * 平台超级管理员登录响应接口
 */
export interface PlatformSuperAdminLoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: PlatformSuperAdmin;
}

/**
 * 平台超级管理员创建请求接口
 */
export interface PlatformSuperAdminCreateRequest {
  username: string;
  email?: string;
  password: string;
  full_name?: string;
  is_active?: boolean;
}

/**
 * 平台超级管理员更新请求接口
 */
export interface PlatformSuperAdminUpdateRequest {
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
export async function platformSuperAdminLogin(
  data: PlatformSuperAdminLoginRequest
): Promise<PlatformSuperAdminLoginResponse> {
  return apiRequest<PlatformSuperAdminLoginResponse>('/platform/auth/login', {
    method: 'POST',
    data,
  });
}

/**
 * 获取当前平台超级管理员信息
 * 
 * @returns 当前平台超级管理员信息
 */
export async function getCurrentPlatformSuperAdmin(): Promise<PlatformSuperAdmin> {
  return apiRequest<PlatformSuperAdmin>('/platform/auth/me', {
    method: 'GET',
  });
}

/**
 * 获取平台超级管理员信息
 * 
 * @returns 平台超级管理员信息
 */
export async function getPlatformSuperAdmin(): Promise<PlatformSuperAdmin> {
  return apiRequest<PlatformSuperAdmin>('/platform/admin', {
    method: 'GET',
  });
}

/**
 * 创建平台超级管理员
 * 
 * @param data - 创建数据
 * @returns 创建的平台超级管理员信息
 */
export async function createPlatformSuperAdmin(
  data: PlatformSuperAdminCreateRequest
): Promise<PlatformSuperAdmin> {
  return apiRequest<PlatformSuperAdmin>('/platform/admin', {
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
export async function updatePlatformSuperAdmin(
  data: PlatformSuperAdminUpdateRequest
): Promise<PlatformSuperAdmin> {
  return apiRequest<PlatformSuperAdmin>('/platform/admin', {
    method: 'PUT',
    data,
  });
}


