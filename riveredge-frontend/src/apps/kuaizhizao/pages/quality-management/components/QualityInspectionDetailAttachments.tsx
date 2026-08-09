/**
 * 质检详情「附件」只读区：按 uid 鉴权预览，禁止裸 download URL（img/a 带不上租户上下文）。
 */
import React, { useMemo } from 'react';
import { Button, Typography } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { SecureImage } from '../../../../../components/secure-image';
import { getFileDownloadUrlWithToken } from '../../../../../services/file';
import {
  mapAttachmentsToUploadList,
  type DocumentAttachmentFile,
} from '../../../utils/documentAttachments';

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

function looksLikeImage(name?: string): boolean {
  const n = String(name || '').trim();
  if (!n) return true;
  if (!n.includes('.')) return true;
  return IMAGE_EXT_RE.test(n);
}

export type QualityInspectionDetailAttachmentsProps = {
  attachments?: DocumentAttachmentFile[] | null;
  /** 无附件时是否仍占位；默认 false（整块由外层决定是否渲染） */
  showEmpty?: boolean;
};

export const QualityInspectionDetailAttachments: React.FC<QualityInspectionDetailAttachmentsProps> = ({
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

export default QualityInspectionDetailAttachments;
