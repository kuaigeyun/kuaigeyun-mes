/**
 * 认证 API 服务
 *
 * 提供登录、注册、Token 刷新等认证相关的 API 接口
 */

import { apiRequest } from './api';

/**
 * 登录请求数据接口
 */
export interface LoginRequest {
  username: string;
  password: string;
  tenant_id?: number; // 可选，用于多组织登录选择
}

/**
 * 登录响应数据接口
 *
 * 与后端返回的数据结构匹配：
 * - access_token: JWT 访问令牌
 * - token_type: 令牌类型（通常为 "bearer"）
 * - expires_in: 令牌过期时间（秒）
 * - user: 用户信息
 * - tenants: 用户可访问的组织列表（可选）
 * - default_tenant_id: 默认组织 ID（可选）
 * - requires_tenant_selection: 是否需要选择组织（当用户有多个组织时）
 */
export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: number;
    uuid: string;
    username: string;
    email?: string;
    full_name?: string;
    tenant_id?: number;
    tenant_name?: string;  // ⚠️ 关键修复：包含租户名称
    is_infra_admin?: boolean;
    is_tenant_admin?: boolean;
  };
  tenants?: Array<{
    id: number;
    uuid: string;
    name: string;
    domain: string;
    status: string;
  }>;
  default_tenant_id?: number;
  requires_tenant_selection?: boolean;
}

/**
 * 用户信息接口
 */
export interface CurrentUser {
  id: number;
  uuid: string;
  username: string;
  email?: string;
  full_name?: string;
  is_infra_admin?: boolean;
  is_tenant_admin?: boolean;
  tenant_id?: number;
}

// 导出类型别名，便于在其他地方使用
export type { CurrentUser as UserInfo };

/**
 * 登录
 *
 * @param data - 登录数据
 * @returns 登录响应数据
 */
export async function login(data: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    data,
  });
}

/**
 * 获取当前用户信息
 *
 * @returns 当前用户信息
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  return apiRequest<CurrentUser>('/auth/me');
}

/**
 * 刷新 Token
 *
 * @param refreshToken - 刷新令牌
 * @returns 新的 Token
 */
export async function refreshToken(refreshToken: string): Promise<{ token: string }> {
  return apiRequest<{ token: string }>('/auth/refresh', {
    method: 'POST',
    data: { refresh_token: refreshToken },
  });
}

/**
 * 免注册体验登录
 *
 * 获取或创建默认组织和预设的体验账户，直接返回登录响应。
 * 体验账户只有浏览权限（只读权限），无新建、编辑、删除权限。
 *
 * @returns 登录响应数据
 */
export async function guestLogin(): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/guest-login', {
    method: 'POST',
  });
}

/**
 * 登出
 */
export async function logout(): Promise<void> {
  return apiRequest<void>('/auth/logout', {
    method: 'POST',
  });
}

/**
 * 微信登录回调
 * 
 * 使用微信授权码换取 JWT Token
 * 
 * @param code - 微信授权码
 * @returns 登录响应数据
 */
export async function wechatLoginCallback(code: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/wechat/callback', {
    method: 'POST',
    data: { code },
  });
}
