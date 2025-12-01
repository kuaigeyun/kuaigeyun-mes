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
 * 套餐信息接口
 */
export interface Package {
  id: number;
  name: string;
  plan: string;
  max_users: number;
  max_storage_mb: number;
  allow_pro_apps: boolean;
  description?: string;
  features?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 套餐创建请求接口
 */
export interface PackageCreate {
  name: string;
  plan: string;
  max_users: number;
  max_storage_mb: number;
  allow_pro_apps: boolean;
  description?: string;
  features?: string[];
  is_active?: boolean;
}

/**
 * 套餐更新请求接口
 */
export interface PackageUpdate {
  name?: string;
  plan?: string;
  max_users?: number;
  max_storage_mb?: number;
  allow_pro_apps?: boolean;
  description?: string;
  features?: string[];
  is_active?: boolean;
}

/**
 * 套餐列表响应接口
 */
export interface PackageListResponse {
  items: Package[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * 组织统计信息接口
 */
export interface TenantStatistics {
  total: number;
  by_status: {
    active: number;
    inactive: number;
    expired: number;
    suspended: number;
  };
  by_plan: {
    trial: number;
    basic: number;
    professional: number;
    enterprise: number;
  };
  updated_at: string;
}

/**
 * 系统监控信息接口
 */
export interface SystemInfo {
  hostname: string;
  platform: string;
  platform_version: string;
  architecture: string;
  python_version: string;
  uptime: number;
  cpu: {
    count: number;
    usage_percent: number;
    load_average: [number, number, number];
  };
  memory: {
    total: number;
    available: number;
    used: number;
    usage_percent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage_percent: number;
  };
  network: {
    interfaces: Array<{
      name: string;
      ip_address: string;
      mac_address: string;
    }>;
  };
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
 * @param isSuperAdmin - 是否为平台超级管理员接口（默认 false，使用 /tenants；true 时使用 /platform/tenants）
 * @returns 组织列表响应数据
 */
export async function getTenantList(
  params: TenantListParams,
  isSuperAdmin: boolean = false
): Promise<TenantListResponse> {
  const endpoint = isSuperAdmin ? '/platform/tenants' : '/tenants';
  return apiRequest<TenantListResponse>(endpoint, {
    method: 'GET',
    params,
  });
}

/**
 * 获取套餐列表
 *
 * @param params - 查询参数
 * @returns 套餐列表响应数据
 */
export async function getPackageList(params: {
  page: number;
  pageSize: number;
  plan?: string;
  name?: string;
  is_active?: boolean;
  allow_pro_apps?: boolean;
  sort?: string;
  order?: string;
}): Promise<PackageListResponse> {
  return apiRequest<PackageListResponse>('/platform/packages', {
    method: 'GET',
    params,
  });
}

/**
 * 创建套餐
 *
 * @param data - 套餐创建数据
 * @returns 创建的套餐
 */
export async function createPackage(data: PackageCreate): Promise<Package> {
  return apiRequest<Package>('/platform/packages', {
    method: 'POST',
    data,
  });
}

/**
 * 更新套餐
 *
 * @param packageId - 套餐ID
 * @param data - 套餐更新数据
 * @returns 更新后的套餐
 */
export async function updatePackage(packageId: number, data: PackageUpdate): Promise<Package> {
  return apiRequest<Package>(`/platform/packages/${packageId}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除套餐
 *
 * @param packageId - 套餐ID
 */
export async function deletePackage(packageId: number): Promise<void> {
  return apiRequest<void>(`/platform/packages/${packageId}`, {
    method: 'DELETE',
  });
}

/**
 * 获取组织统计信息
 *
 * @returns 组织统计信息
 */
export async function getTenantStatistics(): Promise<TenantStatistics> {
  return apiRequest<TenantStatistics>('/platform/monitoring/tenants/statistics', {
    method: 'GET',
  });
}

/**
 * 获取系统监控信息
 *
 * @returns 系统监控信息
 */
export async function getSystemInfo(): Promise<SystemInfo> {
  return apiRequest<SystemInfo>('/platform/monitoring/system/info', {
    method: 'GET',
  });
}

/**
 * 获取组织详情
 * 
 * @param tenantId - 组织 ID
 * @param isSuperAdmin - 是否为平台超级管理员接口（默认 false，使用 /tenants；true 时使用 /platform/tenants）
 * @returns 组织详情
 */
export async function getTenantById(tenantId: number, isSuperAdmin: boolean = false): Promise<Tenant> {
  const endpoint = isSuperAdmin ? `/platform/tenants/${tenantId}` : `/tenants/${tenantId}`;
  return apiRequest<Tenant>(endpoint, {
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
 * 删除组织（平台超级管理员，软删除）
 * 
 * @param tenantId - 组织 ID
 */
export async function deleteTenantBySuperAdmin(tenantId: number): Promise<void> {
  return apiRequest<void>(`/platform/tenants/${tenantId}`, {
    method: 'DELETE',
  });
}

/**
 * 激活组织
 * 
 * @param tenantId - 组织 ID
 * @returns 更新后的组织
 */
/**
 * 激活组织（平台超级管理员）
 * 
 * @param tenantId - 组织 ID
 * @returns 更新后的组织
 */
export async function activateTenant(tenantId: number): Promise<Tenant> {
  return apiRequest<Tenant>(`/platform/tenants/${tenantId}/activate`, {
    method: 'POST',
  });
}

/**
 * 停用组织（平台超级管理员）
 * 
 * @param tenantId - 组织 ID
 * @returns 更新后的组织
 */
export async function deactivateTenant(tenantId: number): Promise<Tenant> {
  return apiRequest<Tenant>(`/platform/tenants/${tenantId}/deactivate`, {
    method: 'POST',
  });
}

/**
 * 获取所有套餐配置
 * 
 * @returns 所有套餐配置
 */
/**
 * 获取所有套餐配置（平台超级管理员）
 *
 * @returns 所有套餐配置
 */
export async function getPackageConfigs(): Promise<AllPackageConfigs> {
  try {
    return await apiRequest<AllPackageConfigs>('/platform/packages/config', {
      method: 'GET',
    });
  } catch (error: any) {
    // 如果 API 返回 401（认证失败），使用默认套餐配置
    if (error.message?.includes('401') || error.message?.includes('认证已过期')) {
      console.warn('⚠️ 无法获取套餐配置，使用默认配置');
      return getDefaultPackageConfigs();
    }
    throw error;
  }
}

/**
 * 获取默认套餐配置（后备方案）
 *
 * @returns 默认套餐配置
 */
function getDefaultPackageConfigs(): AllPackageConfigs {
  return {
    trial: {
      name: '体验套餐',
      max_users: 10,
      max_storage_mb: 1024,
      allow_pro_apps: false,
      description: '适合快速体验系统功能，限制用户数和存储空间',
    },
    basic: {
      name: '基础版',
      max_users: 50,
      max_storage_mb: 5120,
      allow_pro_apps: false,
      description: '适合小型团队使用，提供基础功能',
    },
    professional: {
      name: '专业版',
      max_users: 200,
      max_storage_mb: 20480,
      allow_pro_apps: true,
      description: '适合中型企业使用，提供完整功能和 PRO 应用支持',
    },
    enterprise: {
      name: '企业版',
      max_users: 1000,
      max_storage_mb: 102400,
      allow_pro_apps: true,
      description: '适合大型企业使用，提供最高配置和完整功能',
    },
  };
}

/**
 * 获取指定套餐配置（平台超级管理员）
 * 
 * @param plan - 套餐类型
 * @returns 套餐配置
 */
export async function getPackageConfig(plan: TenantPlan): Promise<PackageConfig> {
  return apiRequest<PackageConfig>(`/platform/packages/${plan}/config`, {
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

