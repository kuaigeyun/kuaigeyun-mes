/**
 * 超级管理员 API 服务
 * 
 * 提供超级管理员相关的 API 接口
 */

// 使用 apiRequest 统一处理 HTTP 请求


import { apiRequest } from './api';

/**
 * 超级管理员信息接口
 */
export interface SuperAdmin {
  id: number;
  username: string;
  email?: string;
  full_name?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
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
    basic: number;
    professional: number;
    enterprise: number;
  };
  updated_at: string;
}

/**
 * 组织活跃度数据接口
 */
export interface TenantActivity {
  tenant_id?: number;
  period_days: number;
  daily_active_users: number[];
  monthly_active_users: number;
  total_visits: number;
  api_calls: number;
  updated_at: string;
}

/**
 * 组织资源使用数据接口
 */
export interface TenantResourceUsage {
  tenant_id?: number;
  storage_used_mb: number;
  storage_limit_mb: number;
  api_calls_today: number;
  api_calls_month: number;
  user_count: number;
  data_count: number;
  updated_at: string;
}

/**
 * 组织数据统计接口
 */
export interface TenantDataStatistics {
  tenant_id?: number;
  user_count: number;
  order_count: number;
  business_data_count: number;
  updated_at: string;
}

/**
 * 系统运行状态接口
 */
export interface SystemStatus {
  status: 'healthy' | 'warning' | 'error';
  database: string;
  redis: string;
  uptime_seconds: number;
  start_time?: string;
  cpu_count?: number;
  cpu_count_logical?: number;
  timezone?: string;
  app_version?: string;
  environment?: string;
  updated_at: string;
}

/**
 * 系统资源使用情况接口
 */
export interface SystemResources {
  cpu_percent: number;
  memory_total_mb: number;
  memory_used_mb: number;
  memory_percent: number;
  disk_total_mb: number;
  disk_used_mb: number;
  disk_percent: number;
  updated_at: string;
}

/**
 * 系统性能指标接口
 */
export interface SystemPerformance {
  avg_response_time_ms: number;
  requests_per_second: number;
  error_rate: number;
  total_requests_today: number;
  updated_at: string;
}

/**
 * 超级管理员登录
 * 
 * @param data - 登录数据
 * @returns 登录响应数据
 */
export async function superadminLogin(data: {
  username: string;
  password: string;
}): Promise<{ token: string; token_type: string; expires_in: number; user: SuperAdmin }> {
  return apiRequest<{ token: string; token_type: string; expires_in: number; user: SuperAdmin }>('/superadmin/auth/login', {
    method: 'POST',
    data,
  });
}

/**
 * 获取当前超级管理员信息
 * 
 * @returns 当前超级管理员信息
 */
export async function getCurrentSuperAdmin(): Promise<SuperAdmin> {
  return apiRequest<SuperAdmin>('/superadmin/auth/me', {
    method: 'GET',
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
 * 获取组织活跃度数据
 * 
 * @param params - 查询参数
 * @returns 组织活跃度数据
 */
export async function getTenantActivity(params?: {
  tenant_id?: number;
  days?: number;
}): Promise<TenantActivity> {
  return apiRequest<TenantActivity>('/platform/monitoring/tenants/activity', {
    method: 'GET',
    params,
  });
}

/**
 * 获取组织资源使用数据
 * 
 * @param params - 查询参数
 * @returns 组织资源使用数据
 */
export async function getTenantResourceUsage(params?: {
  tenant_id?: number;
}): Promise<TenantResourceUsage> {
  return apiRequest<TenantResourceUsage>('/platform/monitoring/tenants/resource-usage', {
    method: 'GET',
    params,
  });
}

/**
 * 获取组织数据统计
 * 
 * @param params - 查询参数
 * @returns 组织数据统计
 */
export async function getTenantDataStatistics(params?: {
  tenant_id?: number;
}): Promise<TenantDataStatistics> {
  return apiRequest<TenantDataStatistics>('/platform/monitoring/tenants/data-statistics', {
    method: 'GET',
    params,
  });
}

/**
 * 获取系统运行状态
 * 
 * @returns 系统运行状态
 */
export async function getSystemStatus(): Promise<SystemStatus> {
  return apiRequest<SystemStatus>('/platform/monitoring/system/status', {
    method: 'GET',
  });
}

/**
 * 获取系统资源使用情况
 * 
 * @returns 系统资源使用情况
 */
export async function getSystemResources(): Promise<SystemResources> {
  return apiRequest<SystemResources>('/platform/monitoring/system/resources', {
    method: 'GET',
  });
}

/**
 * 获取系统性能指标
 * 
 * @returns 系统性能指标
 */
export async function getSystemPerformance(): Promise<SystemPerformance> {
  return apiRequest<SystemPerformance>('/platform/monitoring/system/performance', {
    method: 'GET',
  });
}

/**
 * 获取系统异常告警
 * 
 * @returns 系统异常告警列表
 */
export async function getSystemAlerts(): Promise<any[]> {
  return apiRequest<any[]>('/platform/monitoring/system/alerts', {
    method: 'GET',
  });
}

/**
 * 系统环境信息接口
 */
export interface SystemInfo {
  python_version: string;
  python_full_version: string;
  platform: string;
  system: string;
  release: string;
  version: string;
  machine: string;
  processor: string;
  architecture: string;
  hostname: string;
  network?: {
    interfaces?: Array<{
      interface: string;
      ip: string;
      netmask: string;
      type: string;
    }>;
    bytes_sent?: number;
    bytes_recv?: number;
    packets_sent?: number;
    packets_recv?: number;
    errin?: number;
    errout?: number;
    dropin?: number;
    dropout?: number;
    error?: string;
  };
  process?: {
    pid: number;
    name: string;
    status: string;
    create_time: string;
    num_threads: number;
    memory_info_mb: {
      rss: number;
      vms: number;
    };
    error?: string;
  };
  updated_at: string;
}

/**
 * 获取系统环境信息
 * 
 * @returns 系统环境信息
 */
export async function getSystemInfo(): Promise<SystemInfo> {
  return apiRequest<SystemInfo>('/platform/monitoring/system/info', {
    method: 'GET',
  });
}

