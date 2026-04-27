/**
 * 数据备份管理服务
 * 
 * 提供数据备份的查询、创建、恢复和删除功能。
 */

import { getToken } from '../utils/auth';
import { updateLastActivity, incrementPendingRequests, decrementPendingRequests } from '../utils/activityUtils';
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
  source_type?: 'generated' | 'uploaded';
  status: string;
  /** 异步任务 ID（Taskiq）；历史字段名 inngest_run_id 保持不变以兼容 API */
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
 * 上传备份文件
 */
export async function uploadBackup(file: File, name?: string): Promise<DataBackup> {
  const formData = new FormData();
  formData.append('file', file);
  if (name) formData.append('name', name);
  return apiRequest<DataBackup>('/core/data-backups/upload', {
    method: 'POST',
    body: formData,
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
 * @param createPreRestoreBackup 恢复前自动创建当前状态备份，便于误覆盖时撤回（默认 true）
 * @param sourceTenantId 备份中的租户ID，用于恢复时替换；上传备份或元数据缺失时需手动指定
 */
export async function restoreBackup(
  uuid: string,
  confirm: boolean = true,
  createPreRestoreBackup: boolean = true,
  sourceTenantId?: number
): Promise<RestoreBackupResponse> {
  const data: Record<string, unknown> = { confirm, create_pre_restore_backup: createPreRestoreBackup };
  if (sourceTenantId != null) data.source_tenant_id = sourceTenantId;
  return apiRequest<RestoreBackupResponse>(`/core/data-backups/${uuid}/restore`, {
    method: 'POST',
    data,
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
  updateLastActivity(true); // 下载发起即视为用户活动，避免长耗时下载期间被误判为无操作
  incrementPendingRequests();
  try {
    const token = getToken();
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
  } finally {
    updateLastActivity(true);
    decrementPendingRequests();
  }
}

