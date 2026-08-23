import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { getFileDownloadUrl, getFileDownloadUrlWithToken } from '../../../services/file';

export type DocumentAttachmentFile = {
  uid?: string;
  name?: string;
  status?: string;
  url?: string;
  response?: { uuid?: string; original_name?: string } | Array<{ uuid?: string; original_name?: string }>;
};

/** 从 Upload 条目或后端 attachments JSON 解析文件 UUID */
export function resolveDocumentAttachmentFileUuid(
  file: Pick<DocumentAttachmentFile, 'uid' | 'response'> | UploadFile,
): string | undefined {
  const response = (file as DocumentAttachmentFile).response;
  if (response) {
    if (Array.isArray(response) && response.length > 0 && response[0]?.uuid) {
      return String(response[0].uuid).trim() || undefined;
    }
    if (!Array.isArray(response) && response.uuid) {
      return String(response.uuid).trim() || undefined;
    }
  }
  const uid = String(file.uid ?? '').trim();
  return uid || undefined;
}

/** 鉴权打开附件（禁止裸 /download URL，浏览器无法带租户头） */
export async function openDocumentAttachment(
  file: Pick<DocumentAttachmentFile, 'uid' | 'response'> | UploadFile,
): Promise<void> {
  const fileUuid = resolveDocumentAttachmentFileUuid(file);
  if (!fileUuid) return;
  const url = await getFileDownloadUrlWithToken(fileUuid);
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** ProFormUploadDragger / Upload 共用：预览与下载均走带 token 的 URL */
export function buildDocumentAttachmentUploadHandlers(handlers?: {
  onOpenFailed?: () => void;
}): Pick<UploadProps, 'onPreview' | 'onDownload'> {
  const open = (file: UploadFile) => {
    void openDocumentAttachment(file).catch(() => {
      handlers?.onOpenFailed?.();
    });
  };
  return {
    onPreview: open,
    onDownload: open,
  };
}

/** 编辑回填：后端 attachments → Upload fileList */
export function mapAttachmentsToUploadList(attachments?: DocumentAttachmentFile[] | null) {
  return (attachments ?? []).map((file) => ({
    uid: file.uid ?? file.name ?? String(Math.random()),
    name: file.name ?? '附件',
    status: 'done' as const,
    url: file.url ?? (file.uid ? getFileDownloadUrl(file.uid) : undefined),
  }));
}

/** 提交前：Upload fileList → 后端 attachments JSON */
export function normalizeDocumentAttachments(list?: DocumentAttachmentFile[] | null) {
  return (list ?? []).map((file) => {
    if (file.response) {
      if (Array.isArray(file.response) && file.response.length > 0) {
        const res = file.response[0];
        return {
          uid: res.uuid,
          name: res.original_name,
          status: 'done',
          url: getFileDownloadUrl(res.uuid!),
        };
      }
      if (file.response.uuid) {
        return {
          uid: file.response.uuid,
          name: file.response.original_name,
          status: 'done',
          url: getFileDownloadUrl(file.response.uuid),
        };
      }
    }
    return {
      uid: file.uid,
      name: file.name,
      status: 'done',
      url: file.url,
    };
  });
}
