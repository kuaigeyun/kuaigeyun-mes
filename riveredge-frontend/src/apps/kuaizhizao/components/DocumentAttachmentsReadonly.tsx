/**
 * 业务单据详情「附件」只读区：按 uid 鉴权预览，禁止裸 download URL。
 * 表单上传走 DocumentAttachmentsField；详情只读统一用本组件。
 */
import React, { useMemo } from 'react';
import { Button, Typography } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { SecureImage } from '../../../components/secure-image';
import { getFileDownloadUrlWithToken } from '../../../services/file';
import {
  mapAttachmentsToUploadList,
  type DocumentAttachmentFile,
} from '../utils/documentAttachments';

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

function looksLikeImage(name?: string): boolean {
  const n = String(name || '').trim();
  if (!n) return true;
  if (!n.includes('.')) return true;
  return IMAGE_EXT_RE.test(n);
}

export function documentAttachmentsFromRecord(
  record: { attachments?: unknown } | null | undefined,
): DocumentAttachmentFile[] {
  return Array.isArray(record?.attachments)
    ? (record!.attachments as DocumentAttachmentFile[])
    : [];
}

export function hasDocumentAttachments(
  attachments?: DocumentAttachmentFile[] | null,
): boolean {
  return mapAttachmentsToUploadList(attachments).length > 0;
}

export type DocumentAttachmentsReadonlyProps = {
  attachments?: DocumentAttachmentFile[] | null;
  /** 无附件时是否仍占位；默认 false */
  showEmpty?: boolean;
};

export const DocumentAttachmentsReadonly: React.FC<DocumentAttachmentsReadonlyProps> = ({
  attachments,
  showEmpty = false,
}) => {
  const { t } = useTranslation();
  const files = useMemo(() => mapAttachmentsToUploadList(attachments), [attachments]);

  if (!files.length) {
    if (!showEmpty) return null;
    return <Typography.Text type="secondary">—</Typography.Text>;
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {files.map((f) => {
        const uid = String(f.uid || '').trim();
        if (!uid) return null;
        const name = f.name || t('components.documentAttachments.label');
        if (looksLikeImage(name)) {
          return (
            <SecureImage
              key={uid}
              fileUuid={uid}
              alt={name}
              width={64}
              height={64}
              thumbSize={128}
              previewSize={512}
              enableOriginalAction
              style={{ objectFit: 'cover', borderRadius: 4 }}
            />
          );
        }
        return (
          <Button
            key={uid}
            type="link"
            icon={<PaperClipOutlined />}
            style={{ paddingInline: 4 }}
            onClick={() => {
              void getFileDownloadUrlWithToken(uid).then((url) => {
                window.open(url, '_blank', 'noopener,noreferrer');
              });
            }}
          >
            {name}
          </Button>
        );
      })}
    </div>
  );
};

/**
 * 拼进已有 supplementary：已有块保留原标题；附件另起小标题。
 * 仅有附件时由调用方把 supplementaryTitle 设为「附件」。
 */
export function appendDocumentAttachmentsToSupplementary(
  existing: React.ReactNode | undefined | null,
  attachments: DocumentAttachmentFile[] | null | undefined,
  attachmentsLabel: string,
): React.ReactNode | undefined {
  const hasAtt = hasDocumentAttachments(attachments);
  const hasExisting = existing != null && existing !== false;
  if (!hasAtt && !hasExisting) return undefined;
  if (!hasAtt) return existing as React.ReactNode;
  const attBlock = (
    <div style={{ marginTop: hasExisting ? 16 : 0 }}>
      {hasExisting ? (
        <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
          {attachmentsLabel}
        </Typography.Text>
      ) : null}
      <DocumentAttachmentsReadonly attachments={attachments} />
    </div>
  );
  if (!hasExisting) return attBlock;
  return (
    <>
      {existing}
      {attBlock}
    </>
  );
}

export default DocumentAttachmentsReadonly;
