/**
 * 系统参数 API 服务
 * 
 * 提供系统参数管理相关的 API 接口
 * 注意：所有 API 自动过滤当前组织的系统参数
 */

import { apiRequest } from './api';

/**
 * 系统参数信息接口
 */
export interface SystemParameter {
  uuid: string;
  key: string;
  value: string | number | boolean | object | any[];
  type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  is_system: boolean;
  is_active: boolean;
  tenant_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * 系统参数列表查询参数
 */
export interface SystemParameterListParams {
  page?: number;
  page_size?: number;
  is_active?: boolean;
}

/**
 * 系统参数列表响应数据
 */
export interface SystemParameterListResponse {
  items: SystemParameter[];
  total: number;
}

/**
 * 创建系统参数数据
 */
export interface CreateSystemParameterData {
  key: string;
  value: string | number | boolean | object | any[];
  type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  is_system?: boolean;
  is_active?: boolean;
}

/**
 * 更新系统参数数据
 */
export interface UpdateSystemParameterData {
  value?: string | number | boolean | object | any[];
  description?: string;
  is_active?: boolean;
}

/**
 * 批量更新系统参数数据
 */
export interface BatchUpdateSystemParameterData {
  [key: string]: string | number | boolean | object | any[];
}

/**
 * 获取系统参数列表
 * 
 * 自动过滤当前组织的系统参数。
 * 
 * @param params - 查询参数
 * @returns 系统参数列表响应数据
 */
export async function getSystemParameterList(params?: SystemParameterListParams): Promise<SystemParameterListResponse> {
  return apiRequest<SystemParameterListResponse>('/core/system-parameters', {
    params,
  });
}

/**
 * 获取系统参数详情
 * 
 * 自动验证组织权限：只能获取当前组织的系统参数。
 * 
 * @param parameterUuid - 系统参数 UUID
 * @returns 系统参数信息
 */
export async function getSystemParameterByUuid(parameterUuid: string): Promise<SystemParameter> {
  return apiRequest<SystemParameter>(`/core/system-parameters/${parameterUuid}`);
}

/**
 * 根据键获取系统参数（优先从缓存读取）
 * 
 * @param key - 参数键
 * @returns 系统参数信息
 */
export async function getSystemParameterByKey(key: string): Promise<SystemParameter> {
  return apiRequest<SystemParameter>(`/core/system-parameters/key/${key}`);
}

/**
 * 创建系统参数
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 系统参数创建数据
 * @returns 创建的系统参数信息
 */
export async function createSystemParameter(data: CreateSystemParameterData): Promise<SystemParameter> {
  return apiRequest<SystemParameter>('/core/system-parameters', {
    method: 'POST',
    data,
  });
}

/**
 * 更新系统参数
 * 
 * 自动验证组织权限：只能更新当前组织的系统参数。
 * 
 * @param parameterUuid - 系统参数 UUID
 * @param data - 系统参数更新数据
 * @returns 更新后的系统参数信息
 */
export async function updateSystemParameter(parameterUuid: string, data: UpdateSystemParameterData): Promise<SystemParameter> {
  return apiRequest<SystemParameter>(`/core/system-parameters/${parameterUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除系统参数
 * 
 * 自动验证组织权限：只能删除当前组织的系统参数。
 * 系统参数不可删除。
 * 
 * @param parameterUuid - 系统参数 UUID
 */
export async function deleteSystemParameter(parameterUuid: string): Promise<void> {
  return apiRequest<void>(`/core/system-parameters/${parameterUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 批量更新系统参数
 * 
 * @param data - 批量更新数据（key 为参数键，value 为参数值）
 * @returns 更新后的系统参数列表
 */
export async function batchUpdateSystemParameters(data: BatchUpdateSystemParameterData): Promise<SystemParameter[]> {
  return apiRequest<SystemParameter[]>('/core/system-parameters/batch-update', {
    method: 'POST',
    data,
  });
}

