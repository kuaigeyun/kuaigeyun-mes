import type { UploadFile } from 'antd/es/upload/interface';
import {
  mapAttachmentsToUploadList,
  normalizeDocumentAttachments,
  type DocumentAttachmentFile,
} from '../../kuaizhizao/utils/documentAttachments';

/** 后端 attachments 可能是列表或文控 { files: [...] } */
export function mapSopAttachmentsToUploadList(raw: unknown): UploadFile[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return mapAttachmentsToUploadList(raw as DocumentAttachmentFile[]);
  }
  if (typeof raw === 'object') {
    const files = (raw as { files?: unknown }).files;
    if (Array.isArray(files)) {
      return mapAttachmentsToUploadList(
        files.map((file) => {
          if (!file || typeof file !== 'object') return file as DocumentAttachmentFile;
          const item = file as Record<string, unknown>;
          return {
            uid: String(item.uuid ?? item.uid ?? ''),
            name: String(item.name ?? item.original_name ?? '附件'),
            status: 'done',
          } satisfies DocumentAttachmentFile;
        }),
      );
    }
  }
  return [];
}

/** 创建/更新：无附件时不传字段，避免旧版后端把 [] 当成非法 dict */
export function resolveSopAttachmentsPayload(list?: DocumentAttachmentFile[] | null) {
  const normalized = normalizeDocumentAttachments(list);
  return normalized.length > 0 ? normalized : undefined;
}
