/**
 * 拉取 core 文件二进制（CAD 预览等）
 *
 * 优先：调用方提供的 preview_url（含预览 token）
 * 回退：同域 /api/v1/core/files/{uuid}/download + Bearer
 * （避免 BASE_URL 指到错误主机时绝对 preview_url 404）
 */

import { getTenantId, getToken } from './auth';
import { toRelativeIfLocalhost } from './avatar';

function buildAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {};
  const token = getToken();
  const tenantId = getTenantId();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId != null) headers['X-Tenant-ID'] = String(tenantId);
  return headers;
}

/** 带登录态直下文件（相对路径，走 Vite/Caddy 同域代理） */
export async function fetchCoreFileBytesByUuid(
  fileUuid: string,
  errorLabel = 'File load failed',
): Promise<Uint8Array> {
  const response = await fetch(`/api/v1/core/files/${encodeURIComponent(fileUuid)}/download`, {
    method: 'GET',
    headers: buildAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`${errorLabel}: ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * @param fileUrl 预览 URL（可选）
 * @param fileUuid 文件 UUID（有则允许鉴权回退）
 */
export async function fetchCoreFileBytes(options: {
  fileUrl?: string;
  fileUuid?: string;
  errorLabel?: string;
}): Promise<Uint8Array> {
  const label = options.errorLabel || 'File load failed';
  const uuid = (options.fileUuid || '').trim();
  const rawUrl = (options.fileUrl || '').trim();

  if (rawUrl) {
    const url = toRelativeIfLocalhost(rawUrl);
    const response = await fetch(url, { method: 'GET' });
    if (response.ok) {
      return new Uint8Array(await response.arrayBuffer());
    }
    if (uuid && (response.status === 404 || response.status === 403 || response.status === 400)) {
      return fetchCoreFileBytesByUuid(uuid, label);
    }
    throw new Error(`${label}: ${response.status}`);
  }

  if (uuid) {
    return fetchCoreFileBytesByUuid(uuid, label);
  }

  throw new Error(`${label}: missing file url/uuid`);
}
