/**
 * 应用管理服务
 * 
 * 提供应用的 CRUD 操作和安装/卸载功能。
 * 注意：所有 API 自动过滤当前组织的应用
 */

import { getToken } from '../utils/auth';
import { apiRequest } from './api';

export interface Application {
  uuid: string;
  tenant_id: number;
  name: string;
  code: string;
  description?: string;
  icon?: string;
  version?: string;
  changelog?: string;
  route_path?: string;
  entry_point?: string;
  menu_config?: Record<string, any>;
  permission_code?: string;
  is_system: boolean;
  /** 专用应用：仅平台绑定本组织后可在租户侧列出；平台管理员可见全部 */
  is_dedicated?: boolean;
  is_active: boolean;
  is_installed: boolean;
  is_pro?: boolean;
  can_access?: boolean;
  is_custom_name: boolean;
  is_custom_sort: boolean;
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
  changelog?: string;
  route_path?: string;
  entry_point?: string;
  menu_config?: Record<string, any>;
  permission_code?: string;
  is_system?: boolean;
  is_active?: boolean;
  is_custom_name?: boolean;
  is_custom_sort?: boolean;
  sort_order?: number;
}

export interface ApplicationUpdate {
  name?: string;
  description?: string;
  icon?: string;
  version?: string;
  changelog?: string;
  route_path?: string;
  entry_point?: string;
  menu_config?: Record<string, any>;
  permission_code?: string;
  is_active?: boolean;
  is_custom_name?: boolean;
  is_custom_sort?: boolean;
  sort_order?: number;
}

/** 扫描接口应快速返回；超时中止以免按钮长时间 loading */
const SCAN_APPLICATIONS_TIMEOUT_MS = 90_000;

async function postApplicationsScan(): Promise<Application[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCAN_APPLICATIONS_TIMEOUT_MS);
  try {
    return await apiRequest<Application[]>('/core/applications/scan', {
      method: 'POST',
      signal: controller.signal,
    });
  } catch (e: any) {
    const aborted =
      e?.name === 'AbortError' ||
      e?.originalError?.name === 'AbortError' ||
      /aborted/i.test(String(e?.message || ''));
    if (aborted) {
      throw new Error(
        `扫描应用超时（超过 ${SCAN_APPLICATIONS_TIMEOUT_MS / 1000} 秒），请查看后端日志或稍后重试`,
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 扫描并注册应用
 *
 * 从 riveredge-backend/src/apps 扫描 manifest.json 并注册到数据库。
 * 用于生产环境首次部署或应用中心为空时。
 *
 * @returns 已注册的应用列表
 */
export async function scanApplications(): Promise<Application[]> {
  return postApplicationsScan();
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
 * 使用 Key 激活 PRO 应用访问权限
 *
 * @param applicationUuid - 应用 UUID
 * @param key - 激活 Key（仅用于校验，服务端不会保存明文）
 * @returns 激活后的应用信息
 */
export async function activateProApplication(
  applicationUuid: string,
  licenseKey: string
): Promise<Application> {
  return apiRequest<Application>(`/core/applications/${applicationUuid}/activate-pro`, {
    method: 'POST',
    data: { license_key: licenseKey },
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
  return postApplicationsScan();
}

/**
 * 同步应用清单配置
 *
 * 从后端应用的 manifest.json 文件同步菜单配置到数据库。
 * 解决应用菜单更新后需要重新安装的问题。
 *
 * @param appCode - 应用代码
 * @returns 同步结果
 */
function formatSyncManifestApiError(
  errorData: unknown,
  status: number,
  statusText: string,
): string {
  if (!errorData || typeof errorData !== 'object') {
    return `HTTP ${status}: ${statusText}`;
  }
  const body = errorData as Record<string, unknown>;
  if (typeof body.detail === 'string' && body.detail.trim()) {
    return body.detail;
  }
  const err = body.error;
  if (err && typeof err === 'object') {
    const nested = err as Record<string, unknown>;
    const details = nested.details;
    if (details && typeof details === 'object') {
      const detailMessage = (details as Record<string, unknown>).message;
      if (typeof detailMessage === 'string' && detailMessage.trim()) {
        return detailMessage;
      }
    }
    if (typeof nested.message === 'string' && nested.message.trim()) {
      return nested.message;
    }
  }
  return `HTTP ${status}: ${statusText}`;
}

export async function syncApplicationManifest(appCode: string): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  // ⚠️ 特殊处理：sync-manifest API 返回的是 { success: true, message: ..., data: ... }
  // 但 apiRequest 会返回 data 字段的内容，我们需要整个响应对象
  const baseUrl = window.location.origin;
  const response = await fetch(`${baseUrl}/api/v1/core/applications/sync-manifest/${appCode}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
      'X-Tenant-ID': localStorage.getItem('tenant_id') || '',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(formatSyncManifestApiError(errorData, response.status, response.statusText));
  }

  const result = await response.json();
  return result; // 返回完整的响应对象 { success, message, data }
}

