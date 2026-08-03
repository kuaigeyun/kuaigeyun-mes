import type { UploadFile } from 'antd/es/upload/interface';
import {
  buildImageUploadFileUrls,
  FILE_IMAGE_SIZE_UPLOAD_THUMB,
  getFileDownloadUrlWithToken,
} from '../../../services/file';

const UUID_RE = /^[0-9a-f-]{36}$/i;

/** 编辑回填：photo_file_uuid → picture-card fileList */
export async function photoUuidToUploadList(uuid?: string | null): Promise<UploadFile[]> {
  const id = (uuid || '').trim();
  if (!id) return [];
  try {
    const { thumbUrl, url } = await buildImageUploadFileUrls(id);
    return [
      {
        uid: id,
        name: '设备照片',
        status: 'done',
        url,
        thumbUrl,
        response: { uuid: id },
      },
    ];
  } catch {
    let fallback = '';
    try {
      fallback = await getFileDownloadUrlWithToken(id, { size: FILE_IMAGE_SIZE_UPLOAD_THUMB });
    } catch {
      /* keep placeholder */
    }
    return [
      {
        uid: id,
        name: '设备照片',
        status: 'done',
        url: fallback || undefined,
        thumbUrl: fallback || undefined,
        response: { uuid: id },
      },
    ];
  }
}

/** 提交：picture-card fileList → photo_file_uuid（无图则为 null，便于清空） */
export function uploadListToPhotoUuid(list: unknown): string | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  const item = list[0] as { response?: { uuid?: string } | Array<{ uuid?: string }>; uid?: string };
  const fromResponse = Array.isArray(item?.response)
    ? item.response[0]?.uuid
    : item?.response?.uuid;
  if (fromResponse && UUID_RE.test(fromResponse)) return fromResponse;
  if (typeof item?.uid === 'string' && UUID_RE.test(item.uid)) return item.uid;
  return null;
}
