import type { UploadFile } from 'antd/es/upload/interface';
import {
  buildImageUploadFileUrls,
  getFileDownloadUrl,
  getFileDownloadUrlWithToken,
  FILE_IMAGE_SIZE_UPLOAD_THUMB,
} from '../../../../../services/file';

export function normUploadUuids(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  const out: string[] = [];
  for (const item of val) {
    const anyItem = item as { response?: { uuid?: string }; uid?: string };
    const u =
      anyItem?.response?.uuid ??
      (typeof anyItem?.uid === 'string' && /^[0-9a-f-]{36}$/i.test(anyItem.uid) ? anyItem.uid : null);
    if (u) out.push(u);
  }
  return out;
}

export function uuidsToUploadFileList(uuids: string[] | undefined): UploadFile[] {
  if (!uuids?.length) return [];
  return uuids.map((uuid) => ({
    uid: uuid,
    name: '照片',
    status: 'done' as const,
    url: getFileDownloadUrl(uuid),
    response: { uuid },
  }));
}

/** 编辑表单回显：带 token 的分级缩略图 URL（生产环境 Upload 预览必需） */
export async function uuidsToSecureUploadFileList(uuids: string[] | undefined): Promise<UploadFile[]> {
  if (!uuids?.length) return [];
  return Promise.all(
    uuids.map(async (uuid) => {
      try {
        const { thumbUrl, url } = await buildImageUploadFileUrls(uuid);
        return {
          uid: uuid,
          name: '照片',
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
          /* 预览失败时仍保留 uid 便于删除/提交 */
        }
        return {
          uid: uuid,
          name: '照片',
          status: 'done' as const,
          url: fallback || undefined,
          thumbUrl: fallback || undefined,
          response: { uuid },
        };
      }
    }),
  );
}
