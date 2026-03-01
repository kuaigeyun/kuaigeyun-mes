/**
 * 移动端认证服务
 * 对接 /api/v1/auth/login，支持用户名/密码登录
 */

import { apiRequest } from './api';
import * as authStorage from './authStorage';

export interface LoginRequest {
  username: string;
  password: string;
  tenant_id?: number;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user?: {
    id: number;
    uuid: string;
    username: string;
    full_name?: string;
    tenant_id?: number;
    tenant_name?: string;
  };
  tenants?: Array<{ id: number; name: string; domain: string }>;
  default_tenant_id?: number;
  requires_tenant_selection?: boolean;
}

export interface UserInfo {
  id: number;
  uuid: string;
  username: string;
  full_name?: string;
  tenant_id?: number;
  tenant_name?: string;
  avatar?: string;
  roles?: Array<{ uuid: string; name: string; code: string }>;
  position?: { uuid: string; name: string };
  department?: { uuid: string; name: string };
}

/**
 * 登录
 */
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const res = await apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    data,
  });
  if (res?.access_token) {
    await authStorage.setToken(res.access_token);
    if (res.user) {
      await authStorage.setStoredUser(JSON.stringify(res.user));
    }
    const tenantId = res.default_tenant_id ?? res.user?.tenant_id;
    if (tenantId != null) {
      await authStorage.setStoredTenantId(String(tenantId));
    }
  }
  return res;
}

/**
 * 获取存储的 Token
 */
export async function getToken(): Promise<string | null> {
  return authStorage.getToken();
}

/**
 * 获取当前用户信息（从本地存储）
 */
export async function getStoredUser(): Promise<UserInfo | null> {
  const raw = await authStorage.getStoredUser();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserInfo;
  } catch {
    return null;
  }
}

/**
 * 获取当前租户 ID
 */
export async function getStoredTenantId(): Promise<string | null> {
  return authStorage.getStoredTenantId();
}

/**
 * 登出：清除本地存储
 */
export async function logout(): Promise<void> {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch {
    // 忽略登出接口失败
  }
  await authStorage.clearAuth();
}

/**
 * 检查是否已登录（有 token）
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await authStorage.getToken();
  return !!token;
}
