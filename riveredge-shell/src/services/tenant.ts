/**
 * 租户 API 服务
 * 
 * 提供租户管理相关的 API 接口
 * 注意：租户管理通常需要超级管理员权限
 */

// 使用 apiRequest 统一处理 HTTP 请求


import { apiRequest } from './api';

/**
 * 租户状态枚举
 */
export enum TenantStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
}

/**
 * 租户套餐枚举
 */
export enum TenantPlan {
  BASIC = 'basic',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

/**
 * 租户信息接口
 */
export interface Tenant {
  id: number;
  name: string;
  domain: string;
  status: TenantStatus;
  plan: TenantPlan;
  settings: Record<string, any>;
  max_users: number;
  max_storage: number;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 租户列表查询参数
 */
export interface TenantListParams {
  page?: number;
  page_size?: number;
  status?: TenantStatus;
  plan?: TenantPlan;
  keyword?: string;
}

/**
 * 租户列表响应数据
 */
export interface TenantListResponse {
  items: Tenant[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * 创建租户数据
 */
export interface CreateTenantData {
  name: string;
  domain: string;
  status?: TenantStatus;
  plan?: TenantPlan;
  settings?: Record<string, any>;
  max_users?: number;
  max_storage?: number;
  expires_at?: string;
}

/**
 * 更新租户数据
 */
export interface UpdateTenantData {
  name?: string;
  domain?: string;
  status?: TenantStatus;
  plan?: TenantPlan;
  settings?: Record<string, any>;
  max_users?: number;
  max_storage?: number;
  expires_at?: string;
}

/**
 * 获取租户列表
 * 
 * @param params - 查询参数
 * @returns 租户列表响应数据
 */
export async function getTenantList(params: TenantListParams): Promise<TenantListResponse> {
  return request('/api/v1/tenants', {
    method: 'GET',
    params,
  });
}

/**
 * 获取租户详情
 * 
 * @param tenantId - 租户 ID
 * @returns 租户详情
 */
export async function getTenantById(tenantId: number): Promise<Tenant> {
  return request(`/api/v1/tenants/${tenantId}`, {
    method: 'GET',
  });
}

/**
 * 创建租户
 * 
 * @param data - 租户创建数据
 * @returns 创建的租户
 */
export async function createTenant(data: CreateTenantData): Promise<Tenant> {
  return request('/api/v1/tenants', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * 更新租户
 * 
 * @param tenantId - 租户 ID
 * @param data - 租户更新数据
 * @returns 更新后的租户
 */
export async function updateTenant(tenantId: number, data: UpdateTenantData): Promise<Tenant> {
  return request(`/api/v1/tenants/${tenantId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * 删除租户（软删除）
 * 
 * @param tenantId - 租户 ID
 */
export async function deleteTenant(tenantId: number): Promise<void> {
  return request(`/api/v1/tenants/${tenantId}`, {
    method: 'DELETE',
  });
}

/**
 * 激活租户
 * 
 * @param tenantId - 租户 ID
 * @returns 更新后的租户
 */
export async function activateTenant(tenantId: number): Promise<Tenant> {
  return request(`/api/v1/tenants/${tenantId}/activate`, {
    method: 'POST',
  });
}

/**
 * 停用租户
 * 
 * @param tenantId - 租户 ID
 * @returns 更新后的租户
 */
export async function deactivateTenant(tenantId: number): Promise<Tenant> {
  return request(`/api/v1/tenants/${tenantId}/deactivate`, {
    method: 'POST',
  });
}

