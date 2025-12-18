/**
 * 登录日志管理服务
 * 
 * 提供登录日志的查询和统计功能。
 */

import { apiRequest } from './api';

export interface LoginLog {
  uuid: string;
  tenant_id?: number;
  user_id?: number;
  username?: string;
  login_ip: string;
  login_location?: string;
  login_device?: string;
  login_browser?: string;
  login_status: string;
  failure_reason?: string;
  created_at: string;
}

export interface LoginLogListResponse {
  items: LoginLog[];
  total: number;
  page: number;
  page_size: number;
}

export interface LoginLogStats {
  total: number;
  success_count: number;
  failed_count: number;
  by_status: { [key: string]: number };
  by_user: { [key: string]: number };
}

/**
 * 获取登录日志列表
 */
export async function getLoginLogs(params?: {
  page?: number;
  page_size?: number;
  user_id?: number;
  username?: string;
  login_status?: string;
  login_ip?: string;
  start_time?: string;
  end_time?: string;
}): Promise<LoginLogListResponse> {
  return apiRequest<LoginLogListResponse>('/core/login-logs', {
    params,
  });
}

/**
 * 获取登录日志详情
 */
export async function getLoginLog(uuid: string): Promise<LoginLog> {
  return apiRequest<LoginLog>(`/core/login-logs/${uuid}`, {
    method: 'GET',
  });
}

/**
 * 获取登录日志统计
 */
export async function getLoginLogStats(): Promise<LoginLogStats> {
  return apiRequest<LoginLogStats>('/core/login-logs/statistics', {
    method: 'GET',
  });
}

