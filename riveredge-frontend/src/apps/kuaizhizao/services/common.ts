/**
 * 通用功能API服务
 *
 * 提供数据导入导出、系统设置等通用功能的API调用接口
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import { apiRequest } from '../../../services/api';

/**
 * 数据导入导出接口定义
 */
export interface ImportTask {
  id?: number;
  fileName: string;
  dataType: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  totalRecords?: number;
  successRecords?: number;
  failedRecords?: number;
  progress?: number;
  startTime?: string;
  endTime?: string;
  errorMessage?: string;
}

export interface ExportTask {
  id?: number;
  dataType: string;
  fileName?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  recordCount?: number;
  progress?: number;
  startTime?: string;
  endTime?: string;
  downloadUrl?: string;
}

// 注意：SystemParameter 和 CodeRule 接口定义已移至系统级
// 如需使用，请从系统级服务中导入

// 数据导入导出API
export async function uploadImportFile(file: File, dataType: string): Promise<ImportTask> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('dataType', dataType);

  return apiRequest<ImportTask>({
    url: '/apps/kuaizhizao/common/data-import',
    method: 'POST',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}

export async function getImportTasks(): Promise<ImportTask[]> {
  return apiRequest<ImportTask[]>({
    url: '/apps/kuaizhizao/common/import-tasks',
    method: 'GET',
  });
}

export async function startExport(dataType: string, filters?: Record<string, any>): Promise<ExportTask> {
  return apiRequest<ExportTask>({
    url: '/apps/kuaizhizao/common/data-export',
    method: 'POST',
    data: { dataType, filters },
  });
}

export async function getExportTasks(): Promise<ExportTask[]> {
  return apiRequest<ExportTask[]>({
    url: '/apps/kuaizhizao/common/export-tasks',
    method: 'GET',
  });
}

export async function downloadExportFile(taskId: number): Promise<Blob> {
  return apiRequest<Blob>({
    url: `/apps/kuaizhizao/common/export-tasks/${taskId}/download`,
    method: 'GET',
    responseType: 'blob',
  });
}

// 注意：系统参数和编码规则API已在系统级（core）实现
// 系统参数：/api/v1/core/system-parameters
// 编码规则：/api/v1/core/code-rules
// 请在系统级菜单中使用这些API，不要在应用级重复实现

/**
 * 通用工具函数
 * downloadFile 已抽离至 src/utils/fileDownload，此处复导以保持向后兼容
 */
export { downloadFile } from '../../../utils/fileDownload';

// 文件大小格式化
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 日期格式化
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
