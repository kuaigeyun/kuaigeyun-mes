/**
 * 文件管理服务
 * 
 * 提供文件的 CRUD 操作、上传、下载、预览等功能。
 * 注意：所有 API 自动过滤当前组织的文件
 */

import { apiRequest } from './api';

export interface File {
  uuid: string;
  tenant_id: number;
  name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  file_type?: string;
  file_extension?: string;
  preview_url?: string;
  category?: string;
  tags?: string[];
  description?: string;
  is_active: boolean;
  upload_status: string;
  created_at: string;
  updated_at: string;
}

export interface FileListParams {
  page?: number;
  page_size?: number;
  search?: string;
  category?: string;
  file_type?: string;
}

export interface FileListResponse {
  items: File[];
  total: number;
  page: number;
  page_size: number;
}

export interface FileUpdate {
  name?: string;
  category?: string;
  tags?: string[];
  description?: string;
  is_active?: boolean;
}

export interface FilePreviewResponse {
  preview_mode: 'simple' | 'kkfileview';
  preview_url: string;
  file_type?: string;
  supported: boolean;
}

export interface FileUploadResponse {
  uuid: string;
  name: string;
  original_name: string;
  file_size: number;
  file_type?: string;
  file_extension?: string;
  file_path: string;
}

/**
 * 获取文件列表
 * 
 * 自动过滤当前组织的文件。
 * 
 * @param params - 查询参数
 * @returns 文件列表
 */
export async function getFileList(params?: FileListParams): Promise<FileListResponse> {
  return apiRequest<FileListResponse>('/system/files', {
    params,
  });
}

/**
 * 获取文件详情
 * 
 * 自动验证组织权限：只能获取当前组织的文件。
 * 
 * @param fileUuid - 文件 UUID
 * @returns 文件信息
 */
export async function getFileByUuid(fileUuid: string): Promise<File> {
  return apiRequest<File>(`/system/files/${fileUuid}`);
}

/**
 * 上传文件（单文件）
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param file - 文件对象
 * @param options - 上传选项（分类、标签、描述）
 * @returns 上传后的文件信息
 */
export async function uploadFile(
  file: File | Blob,
  options?: {
    category?: string;
    tags?: string[];
    description?: string;
  }
): Promise<FileUploadResponse> {
  const formData = new FormData();
  
  // 处理文件
  if (file instanceof File) {
    formData.append('file', file);
  } else if (file instanceof Blob) {
    formData.append('file', file, 'uploaded-file');
  }
  
  // 构建查询参数（后端 API 期望 category、tags、description 作为 Query 参数）
  const queryParams = new URLSearchParams();
  if (options?.category) {
    queryParams.append('category', options.category);
  }
  if (options?.tags) {
    queryParams.append('tags', JSON.stringify(options.tags));
  }
  if (options?.description) {
    queryParams.append('description', options.description);
  }
  
  const url = queryParams.toString() 
    ? `/system/files/upload?${queryParams.toString()}`
    : '/system/files/upload';
  
  return apiRequest<FileUploadResponse>(url, {
    method: 'POST',
    body: formData,
    // 注意：上传文件时不要设置 Content-Type，让浏览器自动设置（包含 boundary）
    headers: {},
  });
}

/**
 * 上传文件（多文件）
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param files - 文件列表
 * @param options - 上传选项（分类）
 * @returns 上传后的文件信息列表
 */
export async function uploadMultipleFiles(
  files: (File | Blob)[],
  options?: {
    category?: string;
  }
): Promise<FileUploadResponse[]> {
  const formData = new FormData();
  
  // 添加所有文件
  files.forEach((file, index) => {
    if (file instanceof File) {
      formData.append('files', file);
    } else if (file instanceof Blob) {
      formData.append('files', file, `file-${index}`);
    }
  });
  
  // 添加可选参数
  if (options?.category) {
    formData.append('category', options.category);
  }
  
  return apiRequest<FileUploadResponse[]>('/system/files/upload/multiple', {
    method: 'POST',
    body: formData,
    headers: {},
  });
}

/**
 * 更新文件信息
 * 
 * 自动验证组织权限：只能更新当前组织的文件。
 * 
 * @param fileUuid - 文件 UUID
 * @param data - 文件更新数据
 * @returns 更新后的文件信息
 */
export async function updateFile(
  fileUuid: string,
  data: FileUpdate
): Promise<File> {
  return apiRequest<File>(`/system/files/${fileUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除文件
 * 
 * 自动验证组织权限：只能删除当前组织的文件。
 * 
 * @param fileUuid - 文件 UUID
 */
export async function deleteFile(fileUuid: string): Promise<void> {
  return apiRequest<void>(`/system/files/${fileUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 批量删除文件
 * 
 * 自动验证组织权限：只能删除当前组织的文件。
 * 
 * @param fileUuids - 文件 UUID 列表
 * @returns 删除的文件数量
 */
export async function batchDeleteFiles(fileUuids: string[]): Promise<{ deleted_count: number }> {
  return apiRequest<{ deleted_count: number }>('/system/files/batch-delete', {
    method: 'POST',
    data: fileUuids,
  });
}

/**
 * 获取文件预览信息
 * 
 * 根据配置返回简单预览或 kkFileView 预览URL。
 * 
 * @param fileUuid - 文件 UUID
 * @returns 预览信息
 */
export async function getFilePreview(fileUuid: string): Promise<FilePreviewResponse> {
  return apiRequest<FilePreviewResponse>(`/system/files/${fileUuid}/preview`);
}

/**
 * 下载文件
 * 
 * 获取文件下载URL（包含权限验证token）。
 * 
 * @param fileUuid - 文件 UUID
 * @returns 文件下载URL
 */
export function getFileDownloadUrl(fileUuid: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  return `${baseUrl}/api/v1/system/files/${fileUuid}/download`;
}

/**
 * 检查 kkFileView 服务健康状态
 * 
 * @returns 健康状态信息
 */
export async function checkKKFileViewHealth(): Promise<{
  healthy: boolean;
  service: string;
  url: string;
}> {
  return apiRequest('/system/files/kkfileview/health');
}

