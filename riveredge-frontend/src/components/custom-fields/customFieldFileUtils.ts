/**
 * 自定义字段图片/附件值与 Upload 互转
 */

import type { UploadFile } from 'antd/es/upload/interface';
import { buildImageUploadFileUrls, getFileByUuid } from '../../services/file';

const UUID_RE = /^[0-9a-f-]{36}$/i;

/** 从 API 返回值解析文件 UUID 列表 */
export function normalizeCustomFieldFileUuids(value: unknown): string[] {
  if (value == null || value === '') return [];
  if (typeof value === 'string' && UUID_RE.test(value)) return [value];
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string' && UUID_RE.test(v));
  }
  if (typeof value === 'object' && value !== null && 'uuids' in value) {
    const uuids = (value as { uuids?: unknown }).uuids;
    if (Array.isArray(uuids)) {
      return uuids.filter((v): v is string => typeof v === 'string' && UUID_RE.test(v));
    }
  }
  return [];
}

/** Upload 组件要求 fileList 必须为数组；表单/API 可能传入 UUID 字符串等 */
export function normalizeUploadFileList(value: unknown): UploadFile[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is UploadFile => item != null && typeof item === 'object' && 'uid' in item,
  );
}

/** 从 Upload fileList 提取已上传文件的 UUID */
export function extractUploadFileUuids(fileList: UploadFile[] | undefined): string[] {
  const list = normalizeUploadFileList(fileList);
  if (!list.length) return [];
  const out: string[] = [];
  for (const file of list) {
    const res = file.response as { uuid?: string } | undefined;
    const uid =
      res?.uuid ??
      (typeof file.uid === 'string' && UUID_RE.test(file.uid) ? file.uid : null);
    if (uid) out.push(uid);
  }
  return out;
}

/** API 存储值 → Upload 回填 */
export async function customFieldFileValueToUploadFiles(
  value: unknown,
  options?: { image?: boolean },
): Promise<UploadFile[]> {
  const uuids = normalizeCustomFieldFileUuids(value);
  if (uuids.length === 0) return [];

  const files: UploadFile[] = [];
  for (const uuid of uuids) {
    try {
      const meta = await getFileByUuid(uuid);
      const file: UploadFile = {
        uid: uuid,
        name: meta.original_name || meta.name || uuid,
        status: 'done',
        response: { uuid },
      };
      if (options?.image) {
        const urls = await buildImageUploadFileUrls(uuid);
        file.thumbUrl = urls.thumbUrl;
        file.url = urls.url;
      }
      files.push(file);
    } catch {
      files.push({
        uid: uuid,
        name: uuid,
        status: 'done',
        response: { uuid },
      });
    }
  }
  return files;
}

/** Upload fileList → API 存储值（image 单文件，file 多文件） */
export function uploadFileListToCustomFieldValue(
  fileList: UploadFile[] | unknown,
  fieldType: 'image' | 'file',
): string | string[] | null {
  const uuids = extractUploadFileUuids(normalizeUploadFileList(fileList));
  if (uuids.length === 0) return null;
  if (fieldType === 'image') return uuids[0] ?? null;
  return uuids;
}

/** 根据字段 config 生成 accept 字符串 */
export function buildCustomFieldAccept(
  allowedTypes: string[] | undefined,
  fallback: string,
): string {
  if (!allowedTypes?.length) return fallback;
  return allowedTypes
    .map((t) => (t.startsWith('.') ? t : `.${t}`))
    .join(',');
}

/** 上传前校验扩展名与大小（config.maxSize 单位 KB） */
export function makeCustomFieldBeforeUpload(
  allowedTypes: string[] | undefined,
  maxSizeKb: number | undefined,
  onReject: (msg: string) => void,
) {
  return (file: File) => {
    if (allowedTypes?.length) {
      const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : '';
      const normalized = allowedTypes.map((t) => t.replace(/^\./, '').toLowerCase());
      if (!ext || !normalized.includes(ext)) {
        onReject(`仅支持：${allowedTypes.join(', ')}`);
        return false;
      }
    }
    if (maxSizeKb && file.size > maxSizeKb * 1024) {
      onReject(`文件不能超过 ${maxSizeKb} KB`);
      return false;
    }
    return true;
  };
}
