/**
 * 组织 API 服务
 * 
 * 提供组织管理相关的 API 接口
 * 注意：组织管理通常需要超级管理员权限
 */

// 使用 apiRequest 统一处理 HTTP 请求


import { apiRequest } from './api';

/**
 * 组织状态枚举
 */
export enum TenantStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
}

/**
 * 组织套餐枚举
 */
export enum TenantPlan {
  TRIAL = 'trial',           // 体验套餐
  BASIC = 'basic',           // 基础版
  PROFESSIONAL = 'professional',  // 专业版
  ENTERPRISE = 'enterprise',  // 企业版
}

/**
 * 套餐配置接口
 */
export interface PackageConfig {
  name: string;
  max_users: number;
  max_storage_mb: number;
  allow_pro_apps: boolean;
  description: string;
}

/**
 * 所有套餐配置
 */
export interface AllPackageConfigs {
  [key: string]: PackageConfig;
}

/**
 * 组织信息接口
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
 * 组织列表查询参数
 */
export interface TenantListParams {
  page?: number;
  page_size?: number;
  status?: TenantStatus;
  plan?: TenantPlan;
  keyword?: string;  // 关键词搜索（组织名称、域名，使用 OR 逻辑）
  name?: string;  // 组织名称搜索（精确搜索）
  domain?: string;  // 域名搜索（精确搜索）
  sort?: string;  // 排序字段（如 'name', 'created_at'）
  order?: 'asc' | 'desc';  // 排序方向
}

/**
 * 组织列表响应数据
 */
export interface TenantListResponse {
  items: Tenant[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * 创建组织数据
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
 * 更新组织数据
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
 * 获取组织列表
 * 
 * @param params - 查询参数
 * @param isSuperAdmin - 是否为超级管理员接口（默认 false，使用 /tenants；true 时使用 /superadmin/tenants）
 * @returns 组织列表响应数据
 */
export async function getTenantList(
  params: TenantListParams,
  isSuperAdmin: boolean = false
): Promise<TenantListResponse> {
  const endpoint = isSuperAdmin ? '/superadmin/tenants' : '/tenants';
  return apiRequest<TenantListResponse>(endpoint, {
    method: 'GET',
    params,
  });
}

/**
 * 获取组织详情
 * 
 * @param tenantId - 组织 ID
 * @returns 组织详情
 */
export async function getTenantById(tenantId: number): Promise<Tenant> {
  return apiRequest<Tenant>(`/tenants/${tenantId}`, {
    method: 'GET',
  });
}

/**
 * 创建组织
 * 
 * @param data - 组织创建数据
 * @returns 创建的组织
 */
export async function createTenant(data: CreateTenantData): Promise<Tenant> {
  return apiRequest<Tenant>('/tenants', {
    method: 'POST',
    data,
  });
}

/**
 * 更新组织
 * 
 * @param tenantId - 组织 ID
 * @param data - 组织更新数据
 * @returns 更新后的组织
 */
export async function updateTenant(tenantId: number, data: UpdateTenantData): Promise<Tenant> {
  return apiRequest<Tenant>(`/tenants/${tenantId}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除组织（软删除）
 * 
 * @param tenantId - 组织 ID
 */
export async function deleteTenant(tenantId: number): Promise<void> {
  return apiRequest<void>(`/tenants/${tenantId}`, {
    method: 'DELETE',
  });
}

/**
 * 激活组织
 * 
 * @param tenantId - 组织 ID
 * @returns 更新后的组织
 */
export async function activateTenant(tenantId: number): Promise<Tenant> {
  return apiRequest<Tenant>(`/tenants/${tenantId}/activate`, {
    method: 'POST',
  });
}

/**
 * 停用组织
 * 
 * @param tenantId - 组织 ID
 * @returns 更新后的组织
 */
export async function deactivateTenant(tenantId: number): Promise<Tenant> {
  return apiRequest<Tenant>(`/tenants/${tenantId}/deactivate`, {
    method: 'POST',
  });
}

/**
 * 获取所有套餐配置
 * 
 * @returns 所有套餐配置
 */
export async function getPackageConfigs(): Promise<AllPackageConfigs> {
  return apiRequest<AllPackageConfigs>('/tenants/packages/config', {
    method: 'GET',
  });
}

/**
 * 获取指定套餐配置
 * 
 * @param plan - 套餐类型
 * @returns 套餐配置
 */
export async function getPackageConfig(plan: TenantPlan): Promise<PackageConfig> {
  return apiRequest<PackageConfig>(`/tenants/packages/${plan}/config`, {
    method: 'GET',
  });
}

/**
 * 组织使用量统计接口
 */
export interface TenantUsage {
  tenant_id: number;
  user_count: number;
  max_users: number;
  storage_used_mb: number;
  max_storage_mb: number;
  user_usage_percent: number;
  storage_usage_percent: number;
  warnings: string[];
}

/**
 * 获取组织使用量统计
 * 
 * @param tenantId - 组织 ID
 * @returns 组织使用量统计
 */
export async function getTenantUsage(tenantId: number): Promise<TenantUsage> {
  return apiRequest<TenantUsage>(`/tenants/${tenantId}/usage`, {
    method: 'GET',
  });
}

/**
 * 组织活动日志接口
 */
export interface TenantActivityLog {
  id: number;
  tenant_id: number;
  action: string;
  description: string;
  operator_id?: number;
  operator_name?: string;
  created_at: string;
}

/**
 * 组织活动日志列表查询参数
 */
export interface TenantActivityLogListParams {
  page?: number;
  page_size?: number;
  action?: string;
}

/**
 * 组织活动日志列表响应数据
 */
export interface TenantActivityLogListResponse {
  items: TenantActivityLog[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * 获取组织活动日志列表
 * 
 * @param tenantId - 组织 ID
 * @param params - 查询参数
 * @returns 组织活动日志列表响应数据
 */
export async function getTenantActivityLogs(
  tenantId: number,
  params: TenantActivityLogListParams = {}
): Promise<TenantActivityLogListResponse> {
  return apiRequest<TenantActivityLogListResponse>(`/tenants/${tenantId}/activity-logs`, {
    method: 'GET',
    params,
  });
}

