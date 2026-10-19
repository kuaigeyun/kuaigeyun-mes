/**
 * 业务单据详情「附件」只读区：点击走 FilePreviewModal 在线预览（PDF/图片等），禁止裸 download URL。
 * 表单上传走 DocumentAttachmentsField；详情只读 / 列表「N 个附件」统一用本组件。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Button, Popover, Space, Typography } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import FilePreviewModal from '../../../components/file-preview';
import { getFileExt } from '../../../utils/filePreviewKind';
import {
  mapAttachmentsToUploadList,
  resolveDocumentAttachmentFileUuid,
  type DocumentAttachmentFile,
} from '../utils/documentAttachments';

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
  /**
   * list：逐文件名链接触发预览（详情区默认）
   * count：展示「N 个附件」，单击后预览（单文件直接开；多文件 Popover 选文件）
   */
  variant?: 'list' | 'count';
};

type PreviewTarget = { uuid: string; name: string };

export const DocumentAttachmentsReadonly: React.FC<DocumentAttachmentsReadonlyProps> = ({
  attachments,
  showEmpty = false,
  variant = 'list',
}) => {
  const { t } = useTranslation();
  const files = useMemo(() => mapAttachmentsToUploadList(attachments), [attachments]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | undefined>();
  const [countPopoverOpen, setCountPopoverOpen] = useState(false);

  const openPreview = useCallback((file: DocumentAttachmentFile) => {
    const uuid = resolveDocumentAttachmentFileUuid(file) || String(file.uid || '').trim();
    if (!uuid) return;
    const name = String(file.name || t('components.documentAttachments.label')).trim();
    setPreviewTarget({ uuid, name });
    setPreviewOpen(true);
    setCountPopoverOpen(false);
  }, [t]);

  const previewModal = (
    <FilePreviewModal
      open={previewOpen}
      onClose={() => {
        setPreviewOpen(false);
        setPreviewTarget(undefined);
      }}
      fileUuid={previewTarget?.uuid}
      fileName={previewTarget?.name}
      fileExtension={previewTarget?.name ? getFileExt(previewTarget.name) : undefined}
      title={previewTarget?.name}
    />
  );

  if (!files.length) {
    if (!showEmpty) return null;
    return <Typography.Text type="secondary">—</Typography.Text>;
  }

  const fileButtons = files.map((f) => {
    const uid = resolveDocumentAttachmentFileUuid(f) || String(f.uid || '').trim();
    if (!uid) return null;
    const name = f.name || t('components.documentAttachments.label');
    return (
      <Button
        key={uid}
        type="link"
        icon={<PaperClipOutlined />}
        size="small"
        style={{ paddingInline: 4, height: 'auto', textAlign: 'left' }}
        onClick={() => openPreview(f)}
      >
        {name}
      </Button>
    );
  });

  if (variant === 'count') {
    const countLabel = t('components.documentAttachments.count', { count: files.length });
    if (files.length === 1) {
      return (
        <>
          <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => openPreview(files[0])}>
            {countLabel}
          </Button>
          {previewModal}
        </>
      );
    }
    return (
      <>
        <Popover
          trigger="click"
          open={countPopoverOpen}
          onOpenChange={setCountPopoverOpen}
          content={
            <Space orientation="vertical" size={4} style={{ maxWidth: 280 }}>
              {fileButtons}
            </Space>
          }
        >
          <Button type="link" size="small" style={{ padding: 0, height: 'auto' }}>
            {countLabel}
          </Button>
        </Popover>
        {previewModal}
      </>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {fileButtons}
      </div>
      {previewModal}
    </>
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
