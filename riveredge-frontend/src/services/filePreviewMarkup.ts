/**
 * 文件预览批注 API
 */

import { apiRequest } from './api';
import type { PreviewMarkupPayload, PreviewMarkupResponse, PreviewMarkupScope } from '../utils/previewMarkupTypes';

export async function getFilePreviewMarkup(
  fileUuid: string,
  scope: PreviewMarkupScope = 'default',
): Promise<PreviewMarkupResponse> {
  const params = new URLSearchParams({ scope });
  return apiRequest<PreviewMarkupResponse>(
    `/core/files/${encodeURIComponent(fileUuid)}/preview-markup?${params.toString()}`,
  );
}

export async function saveFilePreviewMarkup(
  fileUuid: string,
  payload: PreviewMarkupPayload,
  scope: PreviewMarkupScope = 'default',
): Promise<PreviewMarkupResponse> {
  return apiRequest<PreviewMarkupResponse>(
    `/core/files/${encodeURIComponent(fileUuid)}/preview-markup`,
    {
      method: 'PUT',
      data: { scope, payload },
    },
  );
}
