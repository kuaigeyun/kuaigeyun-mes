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
 * 组织搜索选项接口
 */
export interface TenantSearchOption {
  tenant_id: number;
  tenant_name: string;
  tenant_domain: string;
}

/**
 * 组织搜索响应接口
 */
export interface TenantSearchResponse {
  items: TenantSearchOption[];
  total: number;
}

/**
 * 个人注册请求数据接口
 */
export interface PersonalRegisterRequest {
  username: string;
  phone: string;
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
 * 搜索组织（支持组织代码或组织名模糊搜索）
 *
 * @param keyword - 搜索关键词（组织代码或组织名）
 * @returns 组织搜索结果
 */
export async function searchTenants(keyword: string): Promise<TenantSearchResponse> {
  return apiRequest<TenantSearchResponse>('/tenants/search', {
    params: { keyword, page: 1, page_size: 10 },
  });
}

/**
 * 检查组织是否存在（通过域名）
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
 * 组织注册请求数据接口
 */
export interface OrganizationRegisterRequest {
  tenant_name: string;
  phone: string;
  password: string;
  tenant_domain?: string;
  email?: string;
  full_name?: string;
}

/**
 * 组织注册响应接口
 */
export interface OrganizationRegisterResponse {
  success: boolean;
  message: string;
  tenant_id?: number;
  user_id?: number;
}

/**
 * 组织注册
 *
 * @param data - 组织注册数据
 * @returns 注册响应
 */
export async function registerOrganization(data: OrganizationRegisterRequest): Promise<OrganizationRegisterResponse> {
  return apiRequest<OrganizationRegisterResponse>('/auth/register/organization', {
    method: 'POST',
    data,
  });
}

/**
 * 发送验证码请求数据接口
 */
export interface SendVerificationCodeRequest {
  phone?: string;
  email?: string;
}

/**
 * 发送验证码响应接口
 */
export interface SendVerificationCodeResponse {
  success: boolean;
  message: string;
}

/**
 * 发送验证码
 *
 * @param data - 发送验证码数据（phone或email必填其一）
 * @returns 发送结果响应
 */
export async function sendVerificationCode(data: SendVerificationCodeRequest): Promise<SendVerificationCodeResponse> {
  return apiRequest<SendVerificationCodeResponse>('/auth/send-verification-code', {
    method: 'POST',
    data,
  });
}