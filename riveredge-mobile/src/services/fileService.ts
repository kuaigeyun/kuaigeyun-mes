import { apiRequest } from './api';

export interface FilePreviewResponse {
  preview_mode: 'simple' | 'kkfileview';
  preview_url: string;
  file_type?: string;
  supported: boolean;
}

/**
 * 获取文件预览信息
 * @param fileUuid 文件UUID
 * @param forAvatar 头像场景：强制返回直接下载URL，便于移动端 Image 组件加载
 */
export async function getFilePreview(fileUuid: string, forAvatar = false): Promise<FilePreviewResponse> {
  const qs = forAvatar ? '?for_avatar=true' : '';
  return apiRequest<FilePreviewResponse>(`/core/files/${fileUuid}/preview${qs}`);
}
