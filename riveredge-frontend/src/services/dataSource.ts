/**
 * 数据源管理服务
 *
 * 后端统一由 IntegrationConfig 承载；本服务仅访问 /core/data-sources，
 * 自动过滤直连数据库类型，不包含应用连接器或 REST API 类型。
 */

import { apiRequest } from './api';

export interface DataSource {
  uuid: string;
  tenant_id: number;
  name: string;
  code: string;
  description?: string;
  type: string;
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
  type: string;
  config: Record<string, any>;
  is_active?: boolean;
}

export interface UpdateDataSourceData {
  name?: string;
  code?: string;
  description?: string;
  type?: string;
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

/** 与后端 data_sources 列表 API 的 page_size 上限一致 */
export const DATA_SOURCE_LIST_MAX_PAGE_SIZE = 100;

const DATA_SOURCE_API = '/core/data-sources';

/**
 * 获取数据源列表
 *
 * 自动过滤当前组织的数据源（不含应用连接器）。
 */
export async function getDataSourceList(params?: DataSourceListParams): Promise<DataSourceListResponse> {
  return apiRequest<DataSourceListResponse>(DATA_SOURCE_API, {
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

/** 按筛选条件拉取全部数据源（多页拼接，每页不超过 {@link DATA_SOURCE_LIST_MAX_PAGE_SIZE}） */
export async function getDataSourceListAllMatching(
  params?: Omit<DataSourceListParams, 'page' | 'page_size'>,
): Promise<DataSource[]> {
  const page_size = DATA_SOURCE_LIST_MAX_PAGE_SIZE;
  let page = 1;
  const out: DataSource[] = [];
  for (;;) {
    const res = await getDataSourceList({ ...params, page, page_size });
    out.push(...res.items);
    if (res.items.length === 0 || res.items.length < page_size || out.length >= res.total) {
      break;
    }
    page += 1;
    if (page > 500) break;
  }
  return out;
}

export async function getDataSourceDriverAvailability(): Promise<Record<string, boolean>> {
  const result = await apiRequest<{ availability: Record<string, boolean> }>(
    `${DATA_SOURCE_API}/driver-availability`,
  );
  return result.availability ?? {};
}

/**
 * 获取数据源详情
 */
export async function getDataSourceByUuid(dataSourceUuid: string): Promise<DataSource> {
  return apiRequest<DataSource>(`${DATA_SOURCE_API}/${dataSourceUuid}`);
}

/**
 * 创建数据源
 */
export async function createDataSource(data: CreateDataSourceData): Promise<DataSource> {
  return apiRequest<DataSource>(DATA_SOURCE_API, {
    method: 'POST',
    data,
  });
}

/**
 * 更新数据源
 */
export async function updateDataSource(dataSourceUuid: string, data: UpdateDataSourceData): Promise<DataSource> {
  return apiRequest<DataSource>(`${DATA_SOURCE_API}/${dataSourceUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除数据源
 */
export async function deleteDataSource(dataSourceUuid: string): Promise<void> {
  return apiRequest<void>(`${DATA_SOURCE_API}/${dataSourceUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 测试数据源连接
 */
export async function testDataSourceConnection(dataSourceUuid: string): Promise<TestConnectionResponse> {
  const result = await apiRequest<any>(`${DATA_SOURCE_API}/${dataSourceUuid}/test`, {
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

export interface EnsureSystemDefaultDataSourceResponse {
  created: boolean;
  restored: boolean;
  item: DataSource;
}

/**
 * 加载默认数据源（确保当前租户存在 code=system_default 的应用主库连接）
 */
export async function ensureSystemDefaultDataSource(): Promise<EnsureSystemDefaultDataSourceResponse> {
  return apiRequest<EnsureSystemDefaultDataSourceResponse>(
    '/core/integration-configs/ensure-system-default',
    { method: 'POST' },
  );
}
