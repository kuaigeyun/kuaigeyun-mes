/**
 * 注册 API 服务
 *
 * 提供注册相关的 API 接口
 */

import { apiRequest } from './api';

/**
 * 组织检查响应接口
 */
export interface TenantCheckResponse {
  exists: boolean;
  tenant_id?: number;
  tenant_name?: string;
}

/**
 * 个人注册请求数据接口
 */
export interface PersonalRegisterRequest {
  username: string;
  email?: string;
  password: string;
  full_name?: string;
  tenant_id?: number;
  invite_code?: string;
}

/**
 * 个人注册响应接口
 */
export interface PersonalRegisterResponse {
  success: boolean;
  message: string;
  user_id?: number;
}

/**
 * 检查组织是否存在
 *
 * @param domain - 组织域名
 * @returns 组织检查结果
 */
export async function checkTenantExists(domain: string): Promise<TenantCheckResponse> {
  return apiRequest<TenantCheckResponse>(`/tenants/check-domain/${domain}`);
}

/**
 * 个人注册
 *
 * @param data - 注册数据
 * @returns 注册响应
 */
export async function registerPersonal(data: PersonalRegisterRequest): Promise<PersonalRegisterResponse> {
  return apiRequest<PersonalRegisterResponse>('/auth/register/personal', {
    method: 'POST',
    data,
  });
}

/**
 * 组织注册
 *
 * @param data - 组织注册数据
 * @returns 注册响应
 */
export async function registerOrganization(data: any): Promise<any> {
  return apiRequest('/auth/register/organization', {
    method: 'POST',
    data,
  });
}