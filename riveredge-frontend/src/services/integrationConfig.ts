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
  config: Record<string, any>;
  is_active: boolean;
  is_connected: boolean;
  last_connected_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
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
}

/**
 * 获取集成配置列表
 * 
 * 自动过滤当前组织的集成配置。
 * 
 * @param params - 查询参数
 * @returns 集成配置列表
 */
export async function getIntegrationConfigList(params?: {
  skip?: number;
  limit?: number;
  type?: string;
  is_active?: boolean;
}): Promise<IntegrationConfig[]> {
  return apiRequest<IntegrationConfig[]>('/core/integration-configs', {
    params,
  });
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
  return apiRequest<TestConnectionResponse>(`/core/integration-configs/${integrationUuid}/test`, {
    method: 'POST',
  });
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
  return apiRequest<TestConnectionResponse>('/core/integration-configs/test-config', {
    method: 'POST',
    data,
  });
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
  const items = await getIntegrationConfigList({ skip: 0, limit: 1000 });
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

