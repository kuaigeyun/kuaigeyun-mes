/**
 * 数据源管理服务
 *
 * 后端已统一：数据源由「数据连接」IntegrationConfig 承载，仅 type 为 postgresql/mysql/mongodb/api 的配置。
 * 本服务请求兼容层 /core/data-sources（底层读写 IntegrationConfig），自动过滤当前组织。
 */

import { apiRequest } from './api';

export interface DataSource {
  uuid: string;
  tenant_id: number;
  name: string;
  code: string;
  description?: string;
  type: 'OAuth' | 'API' | 'Webhook' | 'Database' | 'postgresql' | 'mysql' | 'mongodb';
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
}

export interface CreateDataSourceData {
  name: string;
  code: string;
  description?: string;
  type: 'OAuth' | 'API' | 'Webhook' | 'Database' | 'postgresql' | 'mysql' | 'mongodb';
  config: Record<string, any>;
  is_active?: boolean;
}

export interface UpdateDataSourceData {
  name?: string;
  code?: string;
  description?: string;
  type?: 'OAuth' | 'API' | 'Webhook' | 'Database' | 'postgresql' | 'mysql' | 'mongodb';
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
  // 切换到全量集成配置 API
  const items = await apiRequest<DataSource[]>('/core/integration-configs', {
    params: {
      skip: params?.page && params?.page_size ? (params.page - 1) * params.page_size : undefined,
      limit: params?.page_size,
      type: params?.type,
      is_active: params?.is_active,
    },
  });
  
  return {
    items,
    total: items.length, // 注意：由于后端列表 API 可能不返回 total，这里暂时取长度或者后续优化
    page: params?.page || 1,
    page_size: params?.page_size || 20,
  } as DataSourceListResponse;
}

/**
 * 获取数据源详情
 */
export async function getDataSourceByUuid(dataSourceUuid: string): Promise<DataSource> {
  return apiRequest<DataSource>(`/core/integration-configs/${dataSourceUuid}`);
}

/**
 * 创建数据源
 */
export async function createDataSource(data: CreateDataSourceData): Promise<DataSource> {
  return apiRequest<DataSource>('/core/integration-configs', {
    method: 'POST',
    data,
  });
}

/**
 * 更新数据源
 */
export async function updateDataSource(dataSourceUuid: string, data: UpdateDataSourceData): Promise<DataSource> {
  return apiRequest<DataSource>(`/core/integration-configs/${dataSourceUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除数据源
 */
export async function deleteDataSource(dataSourceUuid: string): Promise<void> {
  return apiRequest<void>(`/core/integration-configs/${dataSourceUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 测试数据源连接
 */
export async function testDataSourceConnection(dataSourceUuid: string): Promise<TestConnectionResponse> {
  const result = await apiRequest<any>(`/core/integration-configs/${dataSourceUuid}/test`, {
    method: 'POST',
  });
  return {
    success: result.success,
    message: result.message,
    elapsed_time: result.data?.elapsed_time || 0,
  };
}

