/**
 * 数据源管理服务
 *
 * 后端已统一：数据源由「数据连接」IntegrationConfig 承载，仅 type 为 postgresql/mysql/mongodb/api 的配置。
 * 本服务请求兼容层 /core/data-sources（底层读写 IntegrationConfig），自动过滤当前组织。
 */

import { apiRequest } from './api';
import { getIntegrationConfigListAllMatching } from './integrationConfig';

export interface DataSource {
  uuid: string;
  tenant_id: number;
  name: string;
  code: string;
  description?: string;
  type: 'OAuth' | 'API' | 'Webhook' | 'Database' | 'postgresql' | 'mysql' | 'mongodb';
  config: Record<string, any>; // 已脱敏，密码不暴露
  is_active: boolean;
  is_connected: boolean;
  last_connected_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
  /** 是否系统默认数据源（密码来自ENV，不可编辑） */
  is_system_default?: boolean;
  /** 是否可编辑 */
  is_editable?: boolean;
}

export interface DataSourceListParams {
  page?: number;
  page_size?: number;
  search?: string;
  type?: string;
  is_active?: boolean;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
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
  /** 后端 data.verification_level：config_only 表示未真实建连，仅配置检查通过 */
  verification_level?: 'config_only' | 'live';
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
  return apiRequest<DataSourceListResponse>('/core/integration-configs', {
    params: {
      page: params?.page ?? 1,
      page_size: params?.page_size ?? 20,
      search: params?.search,
      type: params?.type,
      is_active: params?.is_active,
      sort_by: params?.sort_by,
      sort_order: params?.sort_order,
    },
  });
}

/** 与集成配置共用接口；按筛选条件分页拉全量（单请求 page_size 不得超过后端上限）。 */
export async function getDataSourceListAllMatching(
  params?: Omit<DataSourceListParams, 'page' | 'page_size'>,
): Promise<DataSource[]> {
  return getIntegrationConfigListAllMatching(params) as Promise<DataSource[]>;
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
    verification_level: result.data?.verification_level,
  };
}

export interface TestConfigRequest {
  type: string;
  config: Record<string, any>;
}

/**
 * 保存前测试连接配置（不落库）
 * 用于新建/编辑数据源时，在保存前验证连接配置是否有效。
 */
export async function testDataSourceConfig(data: TestConfigRequest): Promise<TestConnectionResponse> {
  const result = await apiRequest<any>('/core/integration-configs/test-config', {
    method: 'POST',
    data,
  });
  return {
    success: result.success,
    message: result.message,
    elapsed_time: result.data?.elapsed_time || 0,
    verification_level: result.data?.verification_level,
  };
}

export interface SchemaTable {
  name: string;
  columns: { name: string; type: string }[];
}

export interface DataSourceSchemaResponse {
  tables: SchemaTable[];
  error?: string;
}

/**
 * 获取数据源的表/列元数据（用于图形化查询构建器）
 */
export async function getDataSourceSchema(dataSourceUuid: string): Promise<DataSourceSchemaResponse> {
  return apiRequest<DataSourceSchemaResponse>(`/core/integration-configs/${dataSourceUuid}/schema`);
}

