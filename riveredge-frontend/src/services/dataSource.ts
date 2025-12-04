/**
 * 数据源管理服务
 * 
 * 提供数据源的 CRUD 操作和连接测试功能。
 * 注意：所有 API 自动过滤当前组织的数据源
 */

import { apiRequest } from './api';

export interface DataSource {
  uuid: string;
  tenant_id: number;
  name: string;
  code: string;
  description?: string;
  type: 'postgresql' | 'mysql' | 'mongodb' | 'api';
  config: Record<string, any>;
  is_active: boolean;
  is_connected: boolean;
  last_connected_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface DataSourceListParams {
  page?: number;
  page_size?: number;
  search?: string;
  type?: string;
  is_active?: boolean;
}

export interface DataSourceListResponse {
  items: DataSource[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateDataSourceData {
  name: string;
  code: string;
  description?: string;
  type: 'postgresql' | 'mysql' | 'mongodb' | 'api';
  config: Record<string, any>;
  is_active?: boolean;
}

export interface UpdateDataSourceData {
  name?: string;
  code?: string;
  description?: string;
  type?: 'postgresql' | 'mysql' | 'mongodb' | 'api';
  config?: Record<string, any>;
  is_active?: boolean;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  elapsed_time: number;
}

/**
 * 获取数据源列表
 * 
 * 自动过滤当前组织的数据源。
 * 
 * @param params - 查询参数
 * @returns 数据源列表
 */
export async function getDataSourceList(params?: DataSourceListParams): Promise<DataSourceListResponse> {
  return apiRequest<DataSourceListResponse>('/system/data-sources', {
    params,
  });
}

/**
 * 获取数据源详情
 * 
 * 自动验证组织权限：只能获取当前组织的数据源。
 * 
 * @param dataSourceUuid - 数据源 UUID
 * @returns 数据源信息
 */
export async function getDataSourceByUuid(dataSourceUuid: string): Promise<DataSource> {
  return apiRequest<DataSource>(`/system/data-sources/${dataSourceUuid}`);
}

/**
 * 创建数据源
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 数据源创建数据
 * @returns 创建的数据源信息
 */
export async function createDataSource(data: CreateDataSourceData): Promise<DataSource> {
  return apiRequest<DataSource>('/system/data-sources', {
    method: 'POST',
    data,
  });
}

/**
 * 更新数据源
 * 
 * 自动验证组织权限：只能更新当前组织的数据源。
 * 
 * @param dataSourceUuid - 数据源 UUID
 * @param data - 数据源更新数据
 * @returns 更新后的数据源信息
 */
export async function updateDataSource(dataSourceUuid: string, data: UpdateDataSourceData): Promise<DataSource> {
  return apiRequest<DataSource>(`/system/data-sources/${dataSourceUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除数据源
 * 
 * 自动验证组织权限：只能删除当前组织的数据源。
 * 
 * @param dataSourceUuid - 数据源 UUID
 */
export async function deleteDataSource(dataSourceUuid: string): Promise<void> {
  return apiRequest<void>(`/system/data-sources/${dataSourceUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 测试数据源连接
 * 
 * 测试数据源连接并返回测试结果。
 * 
 * @param dataSourceUuid - 数据源 UUID
 * @returns 测试结果
 */
export async function testDataSourceConnection(dataSourceUuid: string): Promise<TestConnectionResponse> {
  return apiRequest<TestConnectionResponse>(`/system/data-sources/${dataSourceUuid}/test`, {
    method: 'POST',
  });
}

