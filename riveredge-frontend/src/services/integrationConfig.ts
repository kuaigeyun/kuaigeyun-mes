/**
 * 集成配置管理服务
 * 
 * 提供集成配置的 CRUD 操作和连接测试功能。
 * 注意：所有 API 自动过滤当前组织的集成配置
 */

import { apiRequest } from './api';

export interface IntegrationConfig {
  uuid: string;
  tenant_id: number;
  name: string;
  code: string;
  type: string; // postgresql|mysql|mongodb|api|feishu|dingtalk|wecom|sap|kingdee|yonyou|dsc|teamcenter|windchill|dassault_3dx|salesforce|xiaoshouyi|fenxiang 等
  description?: string;
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

/** 数据集选择数据连接时的分组选项 */
export interface DataConnectionGroupOption {
  label: string;
  options: { label: string; value: string }[];
}

export interface IntegrationConfigCreate {
  name: string;
  code: string;
  type: 'OAuth' | 'API' | 'Webhook' | 'Database';
  description?: string;
  config: Record<string, any>;
  is_active?: boolean;
}

export interface IntegrationConfigUpdate {
  name?: string;
  description?: string;
  config?: Record<string, any>;
  is_active?: boolean;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  data?: Record<string, any>;
  error?: string;
  /** 来自 data.verification_level：config_only 表示未真实建连 */
  verification_level?: 'config_only' | 'live';
}

export interface IntegrationConfigListResponse {
  items: IntegrationConfig[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * 获取集成配置列表（分页）
 */
/** 与后端 `integration_configs.list_integrations` 的 Query le= 一致，超出返回 422 */
export const INTEGRATION_CONFIG_LIST_MAX_PAGE_SIZE = 1000;

export async function getIntegrationConfigList(params?: {
  page?: number;
  page_size?: number;
  type?: string;
  is_active?: boolean;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}): Promise<IntegrationConfigListResponse> {
  return apiRequest<IntegrationConfigListResponse>('/core/integration-configs', {
    params: {
      page: params?.page ?? 1,
      page_size: params?.page_size ?? 100,
      type: params?.type,
      is_active: params?.is_active,
      search: params?.search,
      sort_by: params?.sort_by,
      sort_order: params?.sort_order,
    },
  });
}

/**
 * 按筛选条件拉取全部集成配置（多页拼接，每页不超过 {@link INTEGRATION_CONFIG_LIST_MAX_PAGE_SIZE}）。
 */
export async function getIntegrationConfigListAllMatching(params?: {
  type?: string;
  is_active?: boolean;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}): Promise<IntegrationConfig[]> {
  const page_size = INTEGRATION_CONFIG_LIST_MAX_PAGE_SIZE;
  let page = 1;
  const out: IntegrationConfig[] = [];
  for (;;) {
    const res = await getIntegrationConfigList({ ...params, page, page_size });
    out.push(...res.items);
    if (res.items.length === 0 || res.items.length < page_size || out.length >= res.total) {
      break;
    }
    page += 1;
    if (page > 500) break;
  }
  return out;
}

/**
 * 获取集成配置详情
 * 
 * 自动验证组织权限：只能获取当前组织的集成配置。
 * 
 * @param integrationUuid - 集成配置 UUID
 * @returns 集成配置信息
 */
export async function getIntegrationConfigByUuid(integrationUuid: string): Promise<IntegrationConfig> {
  return apiRequest<IntegrationConfig>(`/core/integration-configs/${integrationUuid}`);
}

/**
 * 创建集成配置
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 集成配置创建数据
 * @returns 创建的集成配置信息
 */
export async function createIntegrationConfig(data: IntegrationConfigCreate): Promise<IntegrationConfig> {
  return apiRequest<IntegrationConfig>('/core/integration-configs', {
    method: 'POST',
    data,
  });
}

/**
 * 更新集成配置
 * 
 * 自动验证组织权限：只能更新当前组织的集成配置。
 * 
 * @param integrationUuid - 集成配置 UUID
 * @param data - 集成配置更新数据
 * @returns 更新后的集成配置信息
 */
export async function updateIntegrationConfig(
  integrationUuid: string,
  data: IntegrationConfigUpdate
): Promise<IntegrationConfig> {
  return apiRequest<IntegrationConfig>(`/core/integration-configs/${integrationUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除集成配置
 * 
 * 自动验证组织权限：只能删除当前组织的集成配置。
 * 
 * @param integrationUuid - 集成配置 UUID
 */
export async function deleteIntegrationConfig(integrationUuid: string): Promise<void> {
  return apiRequest<void>(`/core/integration-configs/${integrationUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 测试连接
 * 
 * 测试集成配置的连接状态。
 * 
 * @param integrationUuid - 集成配置 UUID
 * @returns 连接测试结果
 */
export async function testConnection(integrationUuid: string): Promise<TestConnectionResponse> {
  const result = await apiRequest<any>(`/core/integration-configs/${integrationUuid}/test`, {
    method: 'POST',
  });
  return {
    success: result.success,
    message: result.message,
    data: result.data,
    error: result.error,
    verification_level: result.data?.verification_level,
  };
}

export interface TestConfigRequest {
  type: string;
  config: Record<string, any>;
}

/**
 * 保存前测试连接配置（不落库）
 * 
 * 用于新建/编辑时，在保存前验证连接配置是否有效。
 * 
 * @param data - 包含 type 和 config 的测试请求
 * @returns 连接测试结果
 */
export async function testConfig(data: TestConfigRequest): Promise<TestConnectionResponse> {
  const result = await apiRequest<any>('/core/integration-configs/test-config', {
    method: 'POST',
    data,
  });
  return {
    success: result.success,
    message: result.message,
    data: result.data,
    error: result.error,
    verification_level: result.data?.verification_level,
  };
}

/** 类型分组：数据库、API、协作、ERP、PLM、CRM */
const TYPE_CATEGORIES: Record<string, string[]> = {
  数据库: ['postgresql', 'mysql', 'mongodb', 'oracle', 'sqlserver', 'redis', 'clickhouse', 'influxdb', 'doris', 'starrocks', 'elasticsearch'],
  API: ['api'],
  协作: ['feishu', 'dingtalk', 'wecom'],
  ERP: ['sap', 'kingdee', 'yonyou', 'dsc', 'inspur', 'digiwin_e10', 'grasp_erp', 'super_erp', 'chanjet_tplus', 'kingdee_kis', 'oracle_netsuite', 'erpnext', 'odoo', 'sunlike_erp'],
  'PLM/PDM': ['teamcenter', 'windchill', 'caxa', 'sanpin_plm', 'sunlike_plm', 'sipm', 'inteplm'],
  CRM: ['salesforce', 'xiaoshouyi', 'fenxiang', 'qidian', 'supra_crm'],
  OA: ['weaver', 'seeyon', 'landray', 'cloudhub', 'tongda_oa', 'feishu', 'dingtalk', 'wecom'],
  IoT: ['rootcloud', 'casicloud', 'alicloud_iot', 'huaweicloud_iot', 'thingsboard', 'jetlinks'],
  WMS: ['flux_wms', 'kejian_wms', 'digiwin_wms', 'openwms'],
};

export interface DataConnectionsForDatasetResult {
  groups: DataConnectionGroupOption[];
  items: IntegrationConfig[];
}

/**
 * 获取数据集可用的数据连接列表（合并数据源 + 应用连接器）
 * 按类型分组：数据库、API、协作、ERP、PLM、CRM
 */
export async function getDataConnectionsForDataset(): Promise<DataConnectionsForDatasetResult> {
  // 须遵守后端 page_size le=1000；多页拼接以覆盖超过 1000 条连接的场景
  const items = await getIntegrationConfigListAllMatching();
  const byCategory: Record<string, { label: string; value: string }[]> = {};
  for (const [cat, types] of Object.entries(TYPE_CATEGORIES)) {
    byCategory[cat] = [];
    for (const ic of items) {
      if (types.includes(ic.type)) {
        byCategory[cat].push({
          label: `${ic.name} (${ic.code}) - ${ic.type}`,
          value: ic.uuid,
        });
      }
    }
  }
  const groups = Object.entries(byCategory)
    .filter(([, opts]) => opts.length > 0)
    .map(([label, options]) => ({ label, options }));
  return { groups, items };
}

