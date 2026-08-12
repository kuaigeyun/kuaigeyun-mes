/**
 * 文件管理服务
 * 
 * 提供文件的 CRUD 操作、上传、下载、预览等功能。
 * 注意：所有 API 自动过滤当前组织的文件
 */

import { apiRequest } from './api';
import { compressImageForUpload } from '../utils/compressImageForUpload';

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
  storage_backend?: string;
  storage_connection_uuid?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileStorageSettings {
  backend: 'local' | 'connection' | string;
  connection_uuid?: string | null;
  key_prefix?: string;
  delete_local_after_migrate?: boolean;
}

export interface FileStorageMigrateRequest {
  connection_uuid?: string | null;
  dry_run?: boolean;
  cursor?: number;
  limit?: number;
}

export interface FileStorageMigrateResult {
  total: number;
  cursor: number;
  next_cursor: number;
  limit: number;
  done: boolean;
  migrated: number;
  skipped: number;
  failed: number;
  failures: Array<{ uuid: string; reason: string }>;
  dry_run: boolean;
  connection_uuid: string;
}

export interface FileListParams {
  page?: number;
  page_size?: number;
  search?: string;
  category?: string;
  file_type?: string;
  include_preview_url?: boolean;
}

export interface FileListResponse {
  items: File[];
  total: number;
  page: number;
  page_size: number;
  /** 有文件的 attachment category（含物料/图纸等业务引用） */
  non_empty_attachment_categories?: string[];
}

export interface FileUpdate {
  name?: string;
  category?: string;
  tags?: string[];
  description?: string;
  is_active?: boolean;
}

export interface FilePreviewResponse {
  /** 固定为浏览器直连带 token 的下载预览 */
  preview_mode: 'simple';
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
  return apiRequest<FileListResponse>('/core/files', {
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
  return apiRequest<File>(`/core/files/${fileUuid}`);
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

  const payload = await compressImageForUpload(file);

  // 处理文件
  if (payload instanceof File) {
    formData.append('file', payload);
  } else if (payload instanceof Blob) {
    formData.append('file', payload, 'uploaded-file');
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
    ? `/core/files/upload?${queryParams.toString()}`
    : '/core/files/upload';
  
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

  const compressed = await Promise.all(files.map((f) => compressImageForUpload(f)));

  // 添加所有文件
  compressed.forEach((file, index) => {
    if (file instanceof File) {
      formData.append('files', file);
    } else if (file instanceof Blob) {
      formData.append('files', file, `file-${index}`);
    }
  });
  
  // 构建查询参数（与单文件上传一致：category 走 Query，后端 multipart 只解析 files 字段）
  const queryParams = new URLSearchParams();
  if (options?.category) {
    queryParams.append('category', options.category);
  }

  const url = queryParams.toString()
    ? `/core/files/upload/multiple?${queryParams.toString()}`
    : '/core/files/upload/multiple';

  return apiRequest<FileUploadResponse[]>(url, {
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
  return apiRequest<File>(`/core/files/${fileUuid}`, {
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
  return apiRequest<void>(`/core/files/${fileUuid}`, {
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
  return apiRequest<{ deleted_count: number }>('/core/files/batch-delete', {
    method: 'POST',
    data: fileUuids,
  });
}

/** 列表/卡片小缩略图边长（与后端 download?size= 对齐） */
export const FILE_IMAGE_SIZE_THUMB = 64;
/** 预览弹层中等图边长（后端当前上限 512） */
export const FILE_IMAGE_SIZE_MEDIUM = 512;
/** 头像场景缩略图边长 */
export const FILE_IMAGE_SIZE_AVATAR = 128;
/** Upload 卡片缩略图边长 */
export const FILE_IMAGE_SIZE_UPLOAD_THUMB = 128;

export type FilePreviewOptions = {
  /** @deprecated 请使用 size=FILE_IMAGE_SIZE_AVATAR */
  forAvatar?: boolean;
  /** 缩略图边长；不传则原图 URL */
  size?: number;
};

function resolvePreviewSize(options?: FilePreviewOptions): number | undefined {
  if (options?.size != null) return options.size;
  if (options?.forAvatar) return FILE_IMAGE_SIZE_AVATAR;
  return undefined;
}

function previewCacheKey(fileUuid: string, options?: FilePreviewOptions): string {
  const size = resolvePreviewSize(options);
  return `${fileUuid}_${size ?? 'original'}`;
}

// 全局文件预览 URL 缓存，减少重复请求（每会话单次请求即可）
const previewUrlCache = new Map<string, FilePreviewResponse>();
// 仅会话内的 404 负缓存：文件确实不存在时避免重复请求；不做持久化，上传/更换后可立即恢复
const missingSiteLogoKeys = new Set<string>();

// 清理历史版本遗留的持久化负缓存（曾导致 LOGO 被永久判定为丢失）
try {
  localStorage.removeItem('missing_site_logo_uuids');
} catch {
  // ignore
}

/** img/src 使用：将 core/files 预览地址规范为相对路径，避免 BASE_URL 与页面 origin 不一致 */
export function normalizeFilePreviewUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();
  if (trimmed.startsWith('/api/v1/core/files/')) {
    return trimmed;
  }
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://local';
    const parsed = new URL(trimmed, base);
    if (parsed.pathname.startsWith('/api/v1/core/files/')) {
      return parsed.pathname + parsed.search;
    }
    const host = parsed.hostname.toLowerCase();
    if (host === '127.0.0.1' || host === 'localhost' || host === '0.0.0.0' || host === '::1') {
      return parsed.pathname + parsed.search;
    }
  } catch {
    // keep as-is
  }
  return trimmed;
}

function withNormalizedPreviewUrl(result: FilePreviewResponse): FilePreviewResponse {
  if (!result.preview_url) return result;
  return { ...result, preview_url: normalizeFilePreviewUrl(result.preview_url) };
}

const BRANDING_FILE_CATEGORIES = ['platform-favicon', 'platform-logo', 'site-logo'] as const;

function isHttp404(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'response' in error &&
      (error as { response?: { status?: number } }).response?.status === 404,
  );
}

/**
 * 站点/平台 Logo 预览（公开分类接口，支持跨租户 logo 文件与缩略图）。
 * 仅当后端明确返回 404（文件不存在）时返回 null，由调用方回退默认 Logo；
 * 其余错误直接抛出，不做可达性探测或负缓存兜底。
 */
export async function getSiteLogoPreview(
  fileUuid: string,
  options?: FilePreviewOptions,
): Promise<FilePreviewResponse | null> {
  const cacheKey = `site-logo:${previewCacheKey(fileUuid, options)}`;
  if (missingSiteLogoKeys.has(cacheKey)) {
    return null;
  }
  const cached = previewUrlCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const size = resolvePreviewSize(options);
  for (const category of BRANDING_FILE_CATEGORIES) {
    try {
      const params = new URLSearchParams({ category });
      if (size != null) {
        params.set('size', String(size));
      }
      const result = withNormalizedPreviewUrl(
        await apiRequest<FilePreviewResponse>(
          `/core/files/${fileUuid}/preview/public?${params.toString()}`,
        ),
      );
      if (result.preview_url) {
        previewUrlCache.set(cacheKey, result);
        return result;
      }
    } catch (error) {
      if (!isHttp404(error)) {
        throw error;
      }
    }
  }

  missingSiteLogoKeys.add(cacheKey);
  return null;
}

/** 上传或更换站点/平台 Logo 后清除预览缓存，避免 404 负缓存或旧 URL 残留 */
export function invalidateSiteLogoPreviewCache(fileUuid?: string): void {
  const shouldPurgeSiteLogo = (key: string) =>
    key.startsWith('site-logo:') && (!fileUuid || key.includes(fileUuid));
  for (const key of missingSiteLogoKeys) {
    if (shouldPurgeSiteLogo(key)) {
      missingSiteLogoKeys.delete(key);
    }
  }
  for (const key of [...previewUrlCache.keys()]) {
    if (shouldPurgeSiteLogo(key)) {
      previewUrlCache.delete(key);
      continue;
    }
    if (fileUuid && key.startsWith(`${fileUuid}_`)) {
      previewUrlCache.delete(key);
    }
  }
}

/**
 * 公司印章预览（须登录；不加入公开 preview 接口，站点设置页展示时前端做模糊处理）。
 */
export async function getCompanySealPreview(
  fileUuid: string,
): Promise<FilePreviewResponse | null> {
  try {
    return await getFilePreview(fileUuid, { size: 128 });
  } catch {
    return null;
  }
}

export function invalidateCompanySealPreviewCache(fileUuid?: string): void {
  for (const key of [...previewUrlCache.keys()]) {
    if (!fileUuid || key.includes(fileUuid)) {
      previewUrlCache.delete(key);
    }
  }
}

/**
 * 获取文件预览信息
 *
 * 返回带 token 的下载 URL，供 img/iframe 等直接使用。
 * size 或 forAvatar 时返回对应缩略图 URL。
 *
 * @param fileUuid - 文件 UUID
 * @param options - 可选 size / forAvatar
 * @returns 预览信息
 */
export async function getFilePreview(
  fileUuid: string,
  options?: FilePreviewOptions
): Promise<FilePreviewResponse> {
  const cacheKey = previewCacheKey(fileUuid, options);
  const cached = previewUrlCache.get(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams();
    const size = resolvePreviewSize(options);
    if (size != null) {
      params.set('size', String(size));
    } else if (options?.forAvatar) {
      params.set('for_avatar', 'true');
    }
    const qs = params.toString();
    const url = qs ? `/core/files/${fileUuid}/preview?${qs}` : `/core/files/${fileUuid}/preview`;
    const result = withNormalizedPreviewUrl(await apiRequest<FilePreviewResponse>(url));

    previewUrlCache.set(cacheKey, result);
    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * 下载文件
 * 
 * 获取文件下载URL（不含 token，仅用于已带 token 的 URL 或开发环境）。
 * 生产环境 img 标签无法携带 Authorization 头，需使用 getFileDownloadUrlWithToken 或 SecureImage 组件。
 * 
 * @param fileUuid - 文件 UUID
 * @returns 文件下载URL
 */
export function getFileDownloadUrl(fileUuid: string): string {
  // 使用相对路径，便于局域网访问（避免 VITE_API_BASE_URL 硬编号 127.0.0.1）
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  return `${baseUrl}/api/v1/core/files/${fileUuid}/download`;
}

/**
 * 获取带 token 的文件下载 URL（用于 img 等无法携带请求头的场景）
 * 
 * 生产环境必须使用此方法，否则图片会因鉴权失败无法显示。
 * 
 * @param fileUuid - 文件 UUID
 * @param options - 可选，forAvatar 为头像场景时请求缩略图
 * @returns 带 token 的 preview_url
 */
export async function getFileDownloadUrlWithToken(
  fileUuid: string,
  options?: FilePreviewOptions
): Promise<string> {
  const preview = await getFilePreview(fileUuid, options);
  return preview.preview_url;
}

/**
 * 为 Upload picture-card 构建分级 URL：thumbUrl 小图，url 预览中等图。
 */
export async function buildImageUploadFileUrls(fileUuid: string): Promise<{
  thumbUrl: string;
  url: string;
}> {
  const [thumbUrl, url] = await Promise.all([
    getFileDownloadUrlWithToken(fileUuid, { size: FILE_IMAGE_SIZE_UPLOAD_THUMB }),
    getFileDownloadUrlWithToken(fileUuid, { size: FILE_IMAGE_SIZE_MEDIUM }),
  ]);
  return { thumbUrl, url };
}

export interface ImageTierBackfillResult {
  total_images: number;
  batch_size: number;
  processed: number;
  generated: number;
  skipped: number;
  failed: number;
  next_offset: number;
  remaining: number;
  done: boolean;
  errors: string[];
}

/**
 * 存量图片三档压缩（缩略图 64 / 预览图 512），循环调用直至 done。
 */
export async function backfillImageTiers(params?: {
  limit?: number;
  offset?: number;
  category?: string;
  force?: boolean;
}): Promise<ImageTierBackfillResult> {
  const query = new URLSearchParams();
  if (params?.limit != null) query.set('limit', String(params.limit));
  if (params?.offset != null) query.set('offset', String(params.offset));
  if (params?.category) query.set('category', params.category);
  if (params?.force) query.set('force', 'true');
  const qs = query.toString();
  const url = qs ? `/core/files/image-tiers/backfill?${qs}` : '/core/files/image-tiers/backfill';
  return apiRequest<ImageTierBackfillResult>(url, { method: 'POST' });
}

/** 获取文件存储位置设置（本环境） */
export async function getFileStorageSettings(): Promise<FileStorageSettings> {
  return apiRequest<FileStorageSettings>('/core/files/storage-settings');
}

/** 保存文件存储位置设置 */
export async function saveFileStorageSettings(
  data: FileStorageSettings,
): Promise<FileStorageSettings> {
  return apiRequest<FileStorageSettings>('/core/files/storage-settings', {
    method: 'PUT',
    data,
  });
}

/**
 * 本环境本地文件迁移到 COS（单批）。前端循环调用直至 done。
 */
export async function migrateFileStorageToCos(
  data?: FileStorageMigrateRequest,
): Promise<FileStorageMigrateResult> {
  return apiRequest<FileStorageMigrateResult>('/core/files/storage-migrate', {
    method: 'POST',
    data: data || {},
  });
}

