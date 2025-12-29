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

/**
 * 系统参数接口定义
 */
export interface SystemParameter {
  id?: number;
  key: string;
  name: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  category: string;
  description?: string;
  options?: string[];
  required?: boolean;
}

/**
 * 编码规则接口定义
 */
export interface CodeRule {
  id?: number;
  code: string;
  name: string;
  prefix: string;
  dateFormat: string;
  sequenceLength: number;
  currentSequence?: number;
  sample?: string;
  description?: string;
}

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

// 系统参数API
export async function getSystemParameters(): Promise<SystemParameter[]> {
  return apiRequest<SystemParameter[]>({
    url: '/apps/kuaizhizao/common/system-parameters',
    method: 'GET',
  });
}

export async function updateSystemParameters(parameters: Record<string, any>): Promise<void> {
  return apiRequest<void>({
    url: '/apps/kuaizhizao/common/system-parameters',
    method: 'PUT',
    data: parameters,
  });
}

export async function getSystemParameter(key: string): Promise<SystemParameter> {
  return apiRequest<SystemParameter>({
    url: `/apps/kuaizhizao/common/system-parameters/${key}`,
    method: 'GET',
  });
}

export async function updateSystemParameter(key: string, value: any): Promise<void> {
  return apiRequest<void>({
    url: `/apps/kuaizhizao/common/system-parameters/${key}`,
    method: 'PUT',
    data: { value },
  });
}

// 编码规则API
export async function getCodeRules(): Promise<CodeRule[]> {
  return apiRequest<CodeRule[]>({
    url: '/apps/kuaizhizao/common/code-rules',
    method: 'GET',
  });
}

export async function createCodeRule(rule: Omit<CodeRule, 'id'>): Promise<CodeRule> {
  return apiRequest<CodeRule>({
    url: '/apps/kuaizhizao/common/code-rules',
    method: 'POST',
    data: rule,
  });
}

export async function updateCodeRule(id: number, rule: Partial<CodeRule>): Promise<CodeRule> {
  return apiRequest<CodeRule>({
    url: `/apps/kuaizhizao/common/code-rules/${id}`,
    method: 'PUT',
    data: rule,
  });
}

export async function deleteCodeRule(id: number): Promise<void> {
  return apiRequest<void>({
    url: `/apps/kuaizhizao/common/code-rules/${id}`,
    method: 'DELETE',
  });
}

export async function generateNextCode(ruleCode: string): Promise<string> {
  return apiRequest<string>({
    url: `/apps/kuaizhizao/common/code-rules/${ruleCode}/generate`,
    method: 'POST',
  });
}

/**
 * 通用工具函数
 */

// 文件下载工具
export function downloadFile(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

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
