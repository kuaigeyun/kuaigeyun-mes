/**
 * 数据集管理服务
 * 
 * 提供数据集的 CRUD 操作和查询执行功能。
 * 注意：所有 API 自动过滤当前组织的数据集
 */

import { apiRequest } from './api';

export interface Dataset {
  uuid: string;
  tenant_id: number;
  name: string;
  code: string;
  description?: string;
  query_type: 'sql' | 'api';
  query_config: Record<string, any>;
  is_active: boolean;
  data_source_uuid: string;
  last_executed_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface DatasetListParams {
  page?: number;
  page_size?: number;
  search?: string;
  query_type?: string;
  data_source_uuid?: string;
  is_active?: boolean;
}

export interface DatasetListResponse {
  items: Dataset[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateDatasetData {
  name: string;
  code: string;
  description?: string;
  query_type: 'sql' | 'api';
  query_config: Record<string, any>;
  data_source_uuid: string;
  is_active?: boolean;
}

export interface UpdateDatasetData {
  name?: string;
  code?: string;
  description?: string;
  query_type?: 'sql' | 'api';
  query_config?: Record<string, any>;
  is_active?: boolean;
}

export interface ExecuteQueryRequest {
  parameters?: Record<string, any>;
  limit?: number;
  offset?: number;
}

export interface ExecuteQueryResponse {
  success: boolean;
  data: Record<string, any>[];
  total?: number;
  columns?: string[];
  elapsed_time: number;
  error?: string;
}

/**
 * 获取数据集列表
 * 
 * 自动过滤当前组织的数据集。
 * 
 * @param params - 查询参数
 * @returns 数据集列表
 */
export async function getDatasetList(params?: DatasetListParams): Promise<DatasetListResponse> {
  return apiRequest<DatasetListResponse>('/core/datasets', {
    params,
  });
}

/**
 * 获取数据集详情
 * 
 * 自动验证组织权限：只能获取当前组织的数据集。
 * 
 * @param datasetUuid - 数据集 UUID
 * @returns 数据集信息
 */
export async function getDatasetByUuid(datasetUuid: string): Promise<Dataset> {
  return apiRequest<Dataset>(`/core/datasets/${datasetUuid}`);
}

/**
 * 创建数据集
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 数据集创建数据
 * @returns 创建的数据集信息
 */
export async function createDataset(data: CreateDatasetData): Promise<Dataset> {
  return apiRequest<Dataset>('/core/datasets', {
    method: 'POST',
    data,
  });
}

/**
 * 更新数据集
 * 
 * 自动验证组织权限：只能更新当前组织的数据集。
 * 
 * @param datasetUuid - 数据集 UUID
 * @param data - 数据集更新数据
 * @returns 更新后的数据集信息
 */
export async function updateDataset(datasetUuid: string, data: UpdateDatasetData): Promise<Dataset> {
  return apiRequest<Dataset>(`/core/datasets/${datasetUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除数据集
 * 
 * 自动验证组织权限：只能删除当前组织的数据集。
 * 
 * @param datasetUuid - 数据集 UUID
 */
export async function deleteDataset(datasetUuid: string): Promise<void> {
  return apiRequest<void>(`/core/datasets/${datasetUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 执行数据集查询
 * 
 * 执行数据集查询并返回查询结果。
 * 
 * @param datasetUuid - 数据集 UUID
 * @param executeRequest - 执行查询请求
 * @returns 查询结果
 */
export async function executeDatasetQuery(
  datasetUuid: string,
  executeRequest: ExecuteQueryRequest
): Promise<ExecuteQueryResponse> {
  return apiRequest<ExecuteQueryResponse>(`/core/datasets/${datasetUuid}/execute`, {
    method: 'POST',
    data: executeRequest,
  });
}

/**
 * 通过数据集代码查询数据集数据（供业务模块使用）
 * 
 * 这是一个便捷方法，供业务模块通过数据集代码快速获取数据。
 * 仅返回已启用且未删除的数据集数据。
 * 
 * @param datasetCode - 数据集代码
 * @param executeRequest - 执行查询请求
 * @returns 查询结果
 */
export async function queryDatasetByCode(
  datasetCode: string,
  executeRequest: ExecuteQueryRequest
): Promise<ExecuteQueryResponse> {
  return apiRequest<ExecuteQueryResponse>(`/core/datasets/code/${datasetCode}/query`, {
    method: 'POST',
    data: executeRequest,
  });
}

