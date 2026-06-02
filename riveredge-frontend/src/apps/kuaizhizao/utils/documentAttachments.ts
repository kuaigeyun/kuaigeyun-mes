import { getFileDownloadUrl } from '../../../services/file';

export type DocumentAttachmentFile = {
  uid?: string;
  name?: string;
  status?: string;
  url?: string;
  response?: { uuid?: string; original_name?: string } | Array<{ uuid?: string; original_name?: string }>;
};

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
