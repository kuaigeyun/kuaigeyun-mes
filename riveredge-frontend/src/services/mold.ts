/**
 * 模具管理 API 服务
 * 
 * 提供模具和模具使用记录相关的 API 接口
 * 注意：所有 API 自动过滤当前组织的模具
 */

import { apiRequest } from './api';

/**
 * 模具信息接口
 */
export interface Mold {
  id?: number;
  uuid: string;
  code: string;
  name: string;
  type?: string;
  category?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  supplier?: string;
  purchase_date?: string;
  installation_date?: string;
  warranty_period?: number;
  technical_parameters?: Record<string, any>;
  status: string;
  is_active: boolean;
  description?: string;
  total_usage_count: number;
  tenant_id: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/**
 * 模具使用记录信息接口
 */
export interface MoldUsage {
  uuid: string;
  usage_no: string;
  mold_uuid: string;
  mold_id: number;
  mold_name: string;
  source_type?: string;
  source_id?: number;
  source_no?: string;
  usage_date: string;
  usage_count: number;
  operator_id?: number;
  operator_name?: string;
  status: string;
  return_date?: string;
  remark?: string;
  tenant_id: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/**
 * 模具列表查询参数
 */
export interface MoldListParams {
  skip?: number;
  limit?: number;
  type?: string;
  status?: string;
  is_active?: boolean;
  search?: string;
}

/**
 * 模具列表响应数据
 */
export interface MoldListResponse {
  items: Mold[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * 模具使用记录列表查询参数
 */
export interface MoldUsageListParams {
  skip?: number;
  limit?: number;
  mold_uuid?: string;
  status?: string;
  search?: string;
}

/**
 * 模具使用记录列表响应数据
 */
export interface MoldUsageListResponse {
  items: MoldUsage[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * 创建模具数据
 */
export interface CreateMoldData {
  code?: string;
  name: string;
  type?: string;
  category?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  supplier?: string;
  purchase_date?: string;
  installation_date?: string;
  warranty_period?: number;
  technical_parameters?: Record<string, any>;
  status?: string;
  is_active?: boolean;
  description?: string;
}

/**
 * 更新模具数据
 */
export interface UpdateMoldData {
  code?: string;
  name?: string;
  type?: string;
  category?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  supplier?: string;
  purchase_date?: string;
  installation_date?: string;
  warranty_period?: number;
  technical_parameters?: Record<string, any>;
  status?: string;
  is_active?: boolean;
  description?: string;
}

/**
 * 创建模具使用记录数据
 */
export interface CreateMoldUsageData {
  usage_no?: string;
  mold_uuid: string;
  source_type?: string;
  source_id?: number;
  source_no?: string;
  usage_date: string;
  usage_count?: number;
  operator_id?: number;
  operator_name?: string;
  status?: string;
  return_date?: string;
  remark?: string;
}

/**
 * 更新模具使用记录数据
 */
export interface UpdateMoldUsageData {
  usage_date?: string;
  usage_count?: number;
  operator_id?: number;
  operator_name?: string;
  status?: string;
  return_date?: string;
  remark?: string;
}

/**
 * 获取模具列表
 * 
 * 自动过滤当前组织的模具。
 * 
 * @param params - 查询参数
 * @returns 模具列表响应数据
 */
export async function getMoldList(params?: MoldListParams): Promise<MoldListResponse> {
  return apiRequest<MoldListResponse>('/apps/kuaizhizao/molds', {
    params,
  });
}

/**
 * 获取模具详情
 * 
 * 自动验证组织权限：只能获取当前组织的模具。
 * 
 * @param moldUuid - 模具 UUID
 * @returns 模具信息
 */
export async function getMoldByUuid(moldUuid: string): Promise<Mold> {
  return apiRequest<Mold>(`/apps/kuaizhizao/molds/${moldUuid}`);
}

/**
 * 创建模具
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 模具创建数据
 * @returns 创建的模具信息
 */
export async function createMold(data: CreateMoldData): Promise<Mold> {
  return apiRequest<Mold>('/apps/kuaizhizao/molds', {
    method: 'POST',
    data,
  });
}

/**
 * 更新模具
 * 
 * 自动验证组织权限：只能更新当前组织的模具。
 * 
 * @param moldUuid - 模具 UUID
 * @param data - 模具更新数据
 * @returns 更新后的模具信息
 */
export async function updateMold(moldUuid: string, data: UpdateMoldData): Promise<Mold> {
  return apiRequest<Mold>(`/apps/kuaizhizao/molds/${moldUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除模具
 * 
 * 自动验证组织权限：只能删除当前组织的模具。
 * 
 * @param moldUuid - 模具 UUID
 */
export async function deleteMold(moldUuid: string): Promise<void> {
  return apiRequest<void>(`/apps/kuaizhizao/molds/${moldUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 获取模具使用记录列表
 * 
 * 自动过滤当前组织的模具使用记录。
 * 
 * @param params - 查询参数
 * @returns 模具使用记录列表响应数据
 */
export async function getMoldUsageList(params?: MoldUsageListParams): Promise<MoldUsageListResponse> {
  return apiRequest<MoldUsageListResponse>('/apps/kuaizhizao/molds/usages', {
    params,
  });
}

/**
 * 获取模具使用记录详情
 * 
 * 自动验证组织权限：只能获取当前组织的模具使用记录。
 * 
 * @param usageUuid - 模具使用记录 UUID
 * @returns 模具使用记录信息
 */
export async function getMoldUsageByUuid(usageUuid: string): Promise<MoldUsage> {
  return apiRequest<MoldUsage>(`/apps/kuaizhizao/molds/usages/${usageUuid}`);
}

/**
 * 创建模具使用记录
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 模具使用记录创建数据
 * @returns 创建的模具使用记录信息
 */
export async function createMoldUsage(data: CreateMoldUsageData): Promise<MoldUsage> {
  return apiRequest<MoldUsage>('/apps/kuaizhizao/molds/usages', {
    method: 'POST',
    data,
  });
}

/**
 * 更新模具使用记录
 * 
 * 自动验证组织权限：只能更新当前组织的模具使用记录。
 * 
 * @param usageUuid - 模具使用记录 UUID
 * @param data - 模具使用记录更新数据
 * @returns 更新后的模具使用记录信息
 */
export async function updateMoldUsage(usageUuid: string, data: UpdateMoldUsageData): Promise<MoldUsage> {
  return apiRequest<MoldUsage>(`/apps/kuaizhizao/molds/usages/${usageUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除模具使用记录
 * 
 * 自动验证组织权限：只能删除当前组织的模具使用记录。
 * 
 * @param usageUuid - 模具使用记录 UUID
 */
export async function deleteMoldUsage(usageUuid: string): Promise<void> {
  return apiRequest<void>(`/apps/kuaizhizao/molds/usages/${usageUuid}`, {
    method: 'DELETE',
  });
}

