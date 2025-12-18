/**
 * 在线用户管理服务
 * 
 * 提供在线用户的查询和会话管理功能。
 */

import { apiRequest } from './api';

export interface OnlineUser {
  user_id: number;
  username: string;
  email?: string;
  full_name?: string;
  tenant_id: number;
  login_ip?: string;
  login_time?: string;
  last_activity_time?: string;
  session_id?: string;
}

export interface OnlineUserListResponse {
  items: OnlineUser[];
  total: number;
}

export interface OnlineUserStats {
  total: number;
  active: number;
  by_tenant: Record<string, number>;
}

/**
 * 获取在线用户列表
 */
export async function getOnlineUsers(params?: {
  tenant_id?: number;
}): Promise<OnlineUserListResponse> {
  return apiRequest<OnlineUserListResponse>('/core/online-users', {
    params,
  });
}

/**
 * 根据用户ID获取在线用户信息
 */
export async function getOnlineUserByUserId(userId: number): Promise<OnlineUser> {
  return apiRequest<OnlineUser>(`/core/online-users/${userId}`);
}

/**
 * 强制用户下线
 */
export async function forceLogout(userId: number): Promise<void> {
  return apiRequest<void>(`/core/online-users/${userId}`, {
    method: 'DELETE',
  });
}

/**
 * 获取在线用户统计
 */
export async function getOnlineUserStats(params?: {
  tenant_id?: number;
}): Promise<OnlineUserStats> {
  return apiRequest<OnlineUserStats>('/core/online-users/statistics', {
    params,
  });
}

