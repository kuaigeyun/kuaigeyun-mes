/**
 * 应用管理服务
 * 
 * 提供应用的 CRUD 操作和安装/卸载功能。
 * 注意：所有 API 自动过滤当前组织的应用
 */

import { apiRequest } from './api';

export interface Application {
  uuid: string;
  tenant_id: number;
  name: string;
  code: string;
  description?: string;
  icon?: string;
  version?: string;
  route_path?: string;
  entry_point?: string;
  menu_config?: Record<string, any>;
  permission_code?: string;
  is_system: boolean;
  is_active: boolean;
  is_installed: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ApplicationCreate {
  name: string;
  code: string;
  description?: string;
  icon?: string;
  version?: string;
  route_path?: string;
  entry_point?: string;
  menu_config?: Record<string, any>;
  permission_code?: string;
  is_system?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

export interface ApplicationUpdate {
  name?: string;
  description?: string;
  icon?: string;
  version?: string;
  route_path?: string;
  entry_point?: string;
  menu_config?: Record<string, any>;
  permission_code?: string;
  is_active?: boolean;
  sort_order?: number;
}

/**
 * 获取应用列表
 * 
 * 自动过滤当前组织的应用。
 * 
 * @param params - 查询参数
 * @returns 应用列表
 */
export async function getApplicationList(params?: {
  skip?: number;
  limit?: number;
  is_installed?: boolean;
  is_active?: boolean;
}): Promise<Application[]> {
  return apiRequest<Application[]>('/core/applications', {
    params,
  });
}

/**
 * 获取已安装的应用列表
 * 
 * @param params - 查询参数
 * @returns 已安装的应用列表
 */
export async function getInstalledApplicationList(params?: {
  is_active?: boolean;
}): Promise<Application[]> {
  return apiRequest<Application[]>('/core/applications/installed', {
    params,
  });
}

/**
 * 获取应用详情
 * 
 * 自动验证组织权限：只能获取当前组织的应用。
 * 
 * @param applicationUuid - 应用 UUID
 * @returns 应用信息
 */
export async function getApplicationByUuid(applicationUuid: string): Promise<Application> {
  return apiRequest<Application>(`/core/applications/${applicationUuid}`);
}

/**
 * 创建应用
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 应用创建数据
 * @returns 创建的应用信息
 */
export async function createApplication(data: ApplicationCreate): Promise<Application> {
  return apiRequest<Application>('/core/applications', {
    method: 'POST',
    data,
  });
}

/**
 * 更新应用
 * 
 * 自动验证组织权限：只能更新当前组织的应用。
 * 
 * @param applicationUuid - 应用 UUID
 * @param data - 应用更新数据
 * @returns 更新后的应用信息
 */
export async function updateApplication(
  applicationUuid: string,
  data: ApplicationUpdate
): Promise<Application> {
  return apiRequest<Application>(`/core/applications/${applicationUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除应用
 * 
 * 自动验证组织权限：只能删除当前组织的应用。
 * 系统应用不可删除。
 * 
 * @param applicationUuid - 应用 UUID
 */
export async function deleteApplication(applicationUuid: string): Promise<void> {
  return apiRequest<void>(`/core/applications/${applicationUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 安装应用
 * 
 * @param applicationUuid - 应用 UUID
 * @returns 安装后的应用信息
 */
export async function installApplication(applicationUuid: string): Promise<Application> {
  return apiRequest<Application>(`/core/applications/${applicationUuid}/install`, {
    method: 'POST',
  });
}

/**
 * 卸载应用
 * 
 * 系统应用不可卸载。
 * 
 * @param applicationUuid - 应用 UUID
 * @returns 卸载后的应用信息
 */
export async function uninstallApplication(applicationUuid: string): Promise<Application> {
  return apiRequest<Application>(`/core/applications/${applicationUuid}/uninstall`, {
    method: 'POST',
  });
}

/**
 * 启用应用
 * 
 * @param applicationUuid - 应用 UUID
 * @returns 启用后的应用信息
 */
export async function enableApplication(applicationUuid: string): Promise<Application> {
  return apiRequest<Application>(`/core/applications/${applicationUuid}/enable`, {
    method: 'POST',
  });
}

/**
 * 禁用应用
 * 
 * @param applicationUuid - 应用 UUID
 * @returns 禁用后的应用信息
 */
export async function disableApplication(applicationUuid: string): Promise<Application> {
  return apiRequest<Application>(`/core/applications/${applicationUuid}/disable`, {
    method: 'POST',
  });
}

/**
 * 扫描插件目录并自动注册插件应用
 * 
 * 从 riveredge-apps 目录扫描所有插件的 manifest.json 文件，
 * 自动在数据库中创建或更新应用记录。
 * 
 * @returns 已注册的应用列表
 */
export async function scanPlugins(): Promise<Application[]> {
  return apiRequest<Application[]>('/core/applications/scan', {
    method: 'POST',
  });
}

