/**
 * 接口管理服务
 * 
 * 提供接口的 CRUD 操作和接口测试功能。
 * 注意：所有 API 自动过滤当前组织的接口
 */

import { apiRequest } from './api';

export interface API {
  uuid: string;
  tenant_id: number;
  name: string;
  code: string;
  description?: string;
  path: string;
  method: string;
  request_headers?: Record<string, any>;
  request_params?: Record<string, any>;
  request_body?: Record<string, any>;
  response_format?: Record<string, any>;
  response_example?: Record<string, any>;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface APIListParams {
  page?: number;
  page_size?: number;
  search?: string;
  method?: string;
  is_active?: boolean;
}

export interface APIListResponse {
  items: API[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateAPIData {
  name: string;
  code: string;
  description?: string;
  path: string;
  method: string;
  request_headers?: Record<string, any>;
  request_params?: Record<string, any>;
  request_body?: Record<string, any>;
  response_format?: Record<string, any>;
  response_example?: Record<string, any>;
  is_active?: boolean;
  is_system?: boolean;
}

export interface UpdateAPIData {
  name?: string;
  code?: string;
  description?: string;
  path?: string;
  method?: string;
  request_headers?: Record<string, any>;
  request_params?: Record<string, any>;
  request_body?: Record<string, any>;
  response_format?: Record<string, any>;
  response_example?: Record<string, any>;
  is_active?: boolean;
}

export interface APITestRequest {
  headers?: Record<string, any>;
  params?: Record<string, any>;
  body?: Record<string, any>;
}

export interface APITestResponse {
  status_code: number;
  headers: Record<string, any>;
  body: any;
  elapsed_time: number;
}

/**
 * 获取接口列表
 * 
 * 自动过滤当前组织的接口。
 * 
 * @param params - 查询参数
 * @returns 接口列表
 */
export async function getAPIList(params?: APIListParams): Promise<APIListResponse> {
  return apiRequest<APIListResponse>('/core/apis', {
    params,
  });
}

/**
 * 获取接口详情
 * 
 * 自动验证组织权限：只能获取当前组织的接口。
 * 
 * @param apiUuid - 接口 UUID
 * @returns 接口信息
 */
export async function getAPIByUuid(apiUuid: string): Promise<API> {
  return apiRequest<API>(`/core/apis/${apiUuid}`);
}

/**
 * 创建接口
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 接口创建数据
 * @returns 创建的接口信息
 */
export async function createAPI(data: CreateAPIData): Promise<API> {
  return apiRequest<API>('/core/apis', {
    method: 'POST',
    data,
  });
}

/**
 * 更新接口
 * 
 * 自动验证组织权限：只能更新当前组织的接口。
 * 
 * @param apiUuid - 接口 UUID
 * @param data - 接口更新数据
 * @returns 更新后的接口信息
 */
export async function updateAPI(apiUuid: string, data: UpdateAPIData): Promise<API> {
  return apiRequest<API>(`/core/apis/${apiUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除接口
 * 
 * 自动验证组织权限：只能删除当前组织的接口。
 * 系统接口不可删除。
 * 
 * @param apiUuid - 接口 UUID
 */
export async function deleteAPI(apiUuid: string): Promise<void> {
  return apiRequest<void>(`/core/apis/${apiUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 测试接口调用
 * 
 * 调用接口并返回测试结果。
 * 
 * @param apiUuid - 接口 UUID
 * @param testRequest - 测试请求数据（可覆盖接口定义的参数）
 * @param timeout - 请求超时时间（秒）
 * @returns 测试结果
 */
export async function testAPI(
  apiUuid: string,
  testRequest: APITestRequest,
  timeout?: number
): Promise<APITestResponse> {
  return apiRequest<APITestResponse>(`/core/apis/${apiUuid}/test`, {
    method: 'POST',
    data: testRequest,
    params: timeout ? { timeout } : undefined,
  });
}

