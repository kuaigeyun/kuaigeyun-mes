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
 * 用户注册统计信息接口
 */
export interface UserStatistics {
  total_users: number;
  new_today: number;
  new_week: number;
  new_month: number;
  by_source: Record<string, number>;
  by_region?: Record<string, number>;
  registration_trend: Array<{ date: string; count: number }>;
  updated_at: string;
}

/**
 * 访问/登录统计信息接口
 */
export interface AccessStatistics {
  total_logins: number;
  success_count: number;
  failed_count: number;
  logins_today: number;
  dau_today: number;
  login_trend: Array<{ date: string; count: number }>;
  dau_trend: Array<{ date: string; count: number }>;
  by_region?: Record<string, number>;
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
 * 超级管理员登录
 * 
 * @param data - 登录数据
 * @returns 登录响应数据
 */
export async function superadminLogin(data: {
  username: string;
  password: string;
}): Promise<{ token: string; token_type: string; expires_in: number; user: SuperAdmin }> {
  return apiRequest<{ token: string; token_type: string; expires_in: number; user: SuperAdmin }>('/infra/auth/login', {
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
  return apiRequest<SuperAdmin>('/infra/auth/me', {
    method: 'GET',
  });
}

/**
 * 获取组织统计信息
 * 
 * @returns 组织统计信息
 */
export async function getTenantStatistics(): Promise<TenantStatistics> {
  return apiRequest<TenantStatistics>('/infra/monitoring/tenants/statistics', {
    method: 'GET',
  });
}

/**
 * 获取用户注册统计信息
 * 
 * @param params - 查询参数（start、end 为 ISO 日期字符串）
 * @returns 用户注册统计信息
 */
export async function getUserStatistics(params?: {
  start?: string;
  end?: string;
}): Promise<UserStatistics> {
  return apiRequest<UserStatistics>('/infra/monitoring/users/statistics', {
    method: 'GET',
    params,
  });
}

/**
 * 获取访问/登录统计信息
 * 
 * @param params - 查询参数（start、end 为 ISO 日期字符串）
 * @returns 访问/登录统计信息
 */
export async function getAccessStatistics(params?: {
  start?: string;
  end?: string;
}): Promise<AccessStatistics> {
  return apiRequest<AccessStatistics>('/infra/monitoring/access/statistics', {
    method: 'GET',
    params,
  });
}
