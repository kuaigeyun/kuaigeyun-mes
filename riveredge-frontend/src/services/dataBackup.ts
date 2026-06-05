/**
 * 数据备份管理服务
 * 
 * 提供数据备份的查询、创建、恢复和删除功能。
 */

import { updateLastActivity } from '../utils/activityUtils';
import { apiRequest } from './api';

export interface DataBackup {
  uuid: string;
  tenant_id: number;
  /** 备份 zip 内记录的导出租户 ID（用于恢复弹窗展示） */
  source_tenant_id?: number | null;
  name: string;
  backup_type: string;
  backup_scope: string;
  /** 是否包含 uploads 附件（false=仅数据表） */
  include_files?: boolean;
  backup_tables?: string[];
  file_path?: string;
  /** 当前 API 服务器上 zip 是否可访问 */
  file_available?: boolean;
  file_uuid?: string;
  file_size?: number;
  source_type?: 'generated' | 'uploaded';
  status: string;
  /** 异步任务 ID（Taskiq）；历史字段名 inngest_run_id 保持不变以兼容 API */
  inngest_run_id?: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  restore_status?: string | null;
  restore_started_at?: string;
  restore_completed_at?: string;
  restore_error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface DataBackupListResponse {
  items: DataBackup[];
  total: number;
  page: number;
  page_size: number;
}

export interface BackupWorkerHealth {
  status: 'online' | 'backlog' | 'idle';
  broker_ready: boolean;
  pending_total: number;
  pending_stalled: number;
  running_count: number;
  recent_completed: number;
  checked_at: string;
}

export interface CreateDataBackupData {
  name: string;
  backup_type: 'full' | 'incremental';
  backup_scope: 'all' | 'tenant' | 'table';
  include_files?: boolean;
  backup_tables?: string[];
}

export interface RestoreBackupRequest {
  confirm: boolean;
}

export interface RestoreBackupResponse {
  success: boolean;
  restore_status?: string;
  message?: string;
  error?: string;
}

export type RestorePollCallbacks = {
  onSuccess?: () => void;
  onFailed?: (errorMessage?: string) => void;
  onTimeout?: () => void;
};

/**
 * 轮询恢复状态，直到 success/failed 或超时
 */
export async function pollRestoreStatus(
  uuid: string,
  callbacks: RestorePollCallbacks = {},
  options: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<'success' | 'failed' | 'timeout' | 'idle'> {
  const intervalMs = options.intervalMs ?? 3000;
  const maxAttempts = options.maxAttempts ?? 120;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    const detail = await getBackupDetail(uuid);
    if (detail.restore_status === 'success') {
      callbacks.onSuccess?.();
      return 'success';
    }
    if (detail.restore_status === 'failed') {
      callbacks.onFailed?.(detail.restore_error_message || undefined);
      return 'failed';
    }
    if (detail.restore_status !== 'running') {
      return 'idle';
    }
  }

  callbacks.onTimeout?.();
  return 'timeout';
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
 * 获取备份 Worker 运行健康状态
 */
export async function getBackupWorkerHealth(): Promise<BackupWorkerHealth> {
  return apiRequest<BackupWorkerHealth>('/core/data-backups/worker-health');
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
 * 获取短效下载链接（Authorization 头鉴权，仅返回 URL，不缓冲文件）
 */
export async function getBackupDownloadUrl(uuid: string): Promise<string> {
  const res = await apiRequest<{ download_url: string }>(`/core/data-backups/${uuid}/download-url`);
  return res.download_url;
}

/**
 * 触发浏览器原生流式下载
 */
export async function startBackupDownload(uuid: string, filename: string): Promise<void> {
  updateLastActivity(true);
  const url = await getBackupDownloadUrl(uuid);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  updateLastActivity(true);
}
