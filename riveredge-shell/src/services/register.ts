/**
 * 注册 API 服务
 * 
 * 提供个人注册和组织注册相关的 API 接口
 */

import { apiRequest } from './api';

/**
 * 组织注册请求数据
 */
export interface OrganizationRegisterData {
  tenant_name: string;
  tenant_domain?: string;
  username: string;
  email?: string;
  password: string;
  full_name?: string;
}

/**
 * 组织注册响应数据
 */
export interface OrganizationRegisterResponse {
  id: number;
  username: string;
  email?: string;
  tenant_domain?: string; // 组织域名（格式：riveredge.cn/xxxxx）
  message: string;
}

/**
 * 个人注册请求数据
 */
export interface PersonalRegisterData {
  username: string;
  email?: string;
  password: string;
  full_name?: string;
  tenant_id?: number; // 可选，如果提供则在指定组织中创建用户，否则在默认组织中创建
  invite_code?: string; // 可选，如果同时提供组织ID和邀请码，则直接注册成功
}

/**
 * 个人注册响应数据
 */
export interface PersonalRegisterResponse {
  id: number;
  username: string;
  email?: string;
  message: string;
}

/**
 * 组织注册
 * 
 * @param data - 组织注册数据
 * @returns 注册响应数据
 */
export async function registerOrganization(data: OrganizationRegisterData): Promise<OrganizationRegisterResponse> {
  return apiRequest<OrganizationRegisterResponse>('/register/organization', {
    method: 'POST',
    data,
  });
}

/**
 * 个人注册（在默认组织中创建用户）
 * 
 * @param data - 个人注册数据
 * @returns 注册响应数据
 */
export async function registerPersonal(data: PersonalRegisterData): Promise<PersonalRegisterResponse> {
  return apiRequest<PersonalRegisterResponse>('/register/personal', {
    method: 'POST',
    data,
  });
}

/**
 * 检查组织是否存在
 * 
 * @param domain - 组织域名
 * @returns 组织存在性检查结果
 */
export interface TenantCheckResponse {
  exists: boolean;
  tenant_id?: number;
  tenant_name?: string;
  tenant_domain?: string;
  tenant_status?: string;
}

export async function checkTenantExists(domain: string): Promise<TenantCheckResponse> {
  return apiRequest<TenantCheckResponse>('/register/check-tenant', {
    method: 'GET',
    params: { domain },
  });
}

/**
 * 申请加入组织请求数据
 */
export interface TenantJoinData {
  tenant_id: number;
  username: string;
  email?: string;
  password: string;
  full_name?: string;
}

/**
 * 申请加入组织
 * 
 * @param data - 申请加入组织数据
 * @returns 注册响应数据
 */
export async function joinTenant(data: TenantJoinData): Promise<OrganizationRegisterResponse> {
  return apiRequest<OrganizationRegisterResponse>('/register/join', {
    method: 'POST',
    data,
  });
}

