import type { UploadFile } from 'antd/es/upload/interface';

import {
  buildImageUploadFileUrls,
  getFileDownloadUrl,
  getFileDownloadUrlWithToken,
  FILE_IMAGE_SIZE_UPLOAD_THUMB,
} from '../../../services/file';

/** 同步占位（无 token，仅用于非图片或临时占位） */
export function uuidsToUploadFileList(uuids: string[] | undefined): UploadFile[] {
  if (!uuids?.length) return [];
  return uuids.map((uuid) => ({
    uid: uuid,
    name: '附件',
    status: 'done' as const,
    url: getFileDownloadUrl(uuid),
    response: { uuid },
  }));
}

/** picture-card 回显/只读预览：带 token 的缩略图与预览 URL */
export async function uuidsToSecureUploadFileList(uuids: string[] | undefined): Promise<UploadFile[]> {
  if (!uuids?.length) return [];
  return Promise.all(
    uuids.map(async (uuid) => {
      try {
        const { thumbUrl, url } = await buildImageUploadFileUrls(uuid);
        return {
          uid: uuid,
          name: '附件',
          status: 'done' as const,
          url,
          thumbUrl,
          response: { uuid },
        };
      } catch {
        let fallback = '';
        try {
          fallback = await getFileDownloadUrlWithToken(uuid, { size: FILE_IMAGE_SIZE_UPLOAD_THUMB });
        } catch {
          /* 保留 uid 便于展示占位 */
        }
        return {
          uid: uuid,
          name: '附件',
          status: 'done' as const,
          url: fallback || undefined,
          thumbUrl: fallback || undefined,
          response: { uuid },
        };
      }
    }),
  );
}
