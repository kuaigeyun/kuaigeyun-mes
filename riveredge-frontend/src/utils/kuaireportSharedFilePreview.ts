/**
 * 快报表分享页文件预览（凭分享 token，免登录）。
 * 放在公共 utils，避免 SecureImage 等核心组件静态/动态依赖可选的 apps/kuaireport。
 */

import { apiRequest } from '../services/api';

/** 分享页文件预览 URL（设备图等） */
export async function getDashboardSharedFilePreviewUrl(
  token: string,
  fileUuid: string,
  options?: { size?: number },
): Promise<string> {
  const params = new URLSearchParams({
    token,
    uuid: fileUuid,
  });
  if (options?.size != null) {
    params.set('size', String(options.size));
  }
  const res = await apiRequest<{ success: boolean; preview_url?: string; message?: string }>(
    `/apps/kuaireport/dashboards/shared/file-preview?${params.toString()}`,
    { method: 'GET' },
  );
  if (!res.success || !res.preview_url) {
    throw new Error(res.message || '预览加载失败');
  }
  return res.preview_url;
}
