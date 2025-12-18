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
  type: 'OAuth' | 'API' | 'Webhook' | 'Database';
  description?: string;
  config: Record<string, any>;
  is_active: boolean;
  is_connected: boolean;
  last_connected_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
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

