/**
 * 数据备份管理服务
 * 
 * 提供数据备份的查询、创建、恢复和删除功能。
 */

import { apiRequest } from './api';

export interface DataBackup {
  uuid: string;
  tenant_id: number;
  name: string;
  backup_type: string;
  backup_scope: string;
  backup_tables?: string[];
  file_path?: string;
  file_uuid?: string;
  file_size?: number;
  status: string;
  inngest_run_id?: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface DataBackupListResponse {
  items: DataBackup[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateDataBackupData {
  name: string;
  backup_type: 'full' | 'incremental';
  backup_scope: 'all' | 'tenant' | 'table';
  backup_tables?: string[];
}

export interface RestoreBackupRequest {
  confirm: boolean;
}

export interface RestoreBackupResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * 创建备份任务
 */
export async function createBackup(data: CreateDataBackupData): Promise<DataBackup> {
  return apiRequest<DataBackup>('/core/data-backups', {
    method: 'POST',
    data,
  });
}

/**
 * 获取备份列表
 */
export async function getBackups(params?: {
  page?: number;
  page_size?: number;
  backup_type?: string;
  backup_scope?: string;
  status?: string;
}): Promise<DataBackupListResponse> {
  return apiRequest<DataBackupListResponse>('/core/data-backups', {
    params,
  });
}

/**
 * 获取备份详情
 */
export async function getBackupDetail(uuid: string): Promise<DataBackup> {
  return apiRequest<DataBackup>(`/core/data-backups/${uuid}`);
}

/**
 * 恢复备份
 */
export async function restoreBackup(uuid: string, confirm: boolean = true): Promise<RestoreBackupResponse> {
  return apiRequest<RestoreBackupResponse>(`/core/data-backups/${uuid}/restore`, {
    method: 'POST',
    data: { confirm },
  });
}

/**
 * 删除备份
 */
export async function deleteBackup(uuid: string): Promise<void> {
  return apiRequest<void>(`/core/data-backups/${uuid}`, {
    method: 'DELETE',
  });
}

/**
 * 下载备份文件（返回 Blob，用于触发浏览器下载）
 */
export async function downloadBackup(uuid: string): Promise<Blob> {
  const token = localStorage.getItem('token');
  const tenantId = localStorage.getItem('tenant_id');
  const url = `/api/v1/core/data-backups/${uuid}/download`;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (tenantId) headers['X-Tenant-Id'] = tenantId;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `下载失败: ${res.status}`);
  }
  return res.blob();
}

