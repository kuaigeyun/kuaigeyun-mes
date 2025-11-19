/**
 * 租户注册 API 服务
 * 
 * 提供租户注册相关的 API 接口
 */

// 使用 apiRequest 统一处理 HTTP 请求


import { apiRequest } from './api';

/**
 * 租户注册请求数据
 */
export interface TenantRegisterData {
  tenant_name: string;
  tenant_domain: string;
  username: string;
  email?: string;
  password: string;
  full_name?: string;
}

/**
 * 租户注册响应数据
 */
export interface TenantRegisterResponse {
  id: number;
  username: string;
  email?: string;
  message: string;
}

/**
 * 租户注册
 * 
 * @param data - 租户注册数据
 * @returns 注册响应数据
 */
export async function registerTenant(data: TenantRegisterData): Promise<TenantRegisterResponse> {
  return request('/api/v1/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

