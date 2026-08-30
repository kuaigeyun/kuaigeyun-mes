/**
 * 详情抽屉「附件中心」Tab 面板：聚合本单 + 全链路关联单据附件，预览走 FilePreviewModal。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Collapse, Empty, Result, Spin, Typography } from 'antd';
import { EyeOutlined, PaperClipOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { SecureImage } from '../../../components/secure-image';
import FilePreviewModal from '../../../components/file-preview';
import { getFileExt } from '../../../utils/filePreviewKind';
import {
  getDocumentAttachmentCenter,
  type DocumentAttachmentCenterData,
  type DocumentAttachmentCenterGroup,
} from '../services/document-relation';

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

function looksLikeImage(name?: string): boolean {
  const n = String(name || '').trim();
  if (!n) return true;
  if (!n.includes('.')) return true;
  return IMAGE_EXT_RE.test(n);
}

export type DocumentAttachmentCenterPaneProps = {
  documentType: string;
  documentId: number;
  /** 抽屉打开且 Tab 激活 */
  active?: boolean;
};

export const DocumentAttachmentCenterPane: React.FC<DocumentAttachmentCenterPaneProps> = ({
  documentType,
  documentId,
  active = true,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DocumentAttachmentCenterData | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ uuid: string; name: string } | null>(null);

  const load = useCallback(async () => {
    if (!documentType || !documentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getDocumentAttachmentCenter(documentType, documentId);
      setData(res);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message || '')
          : '';
      setError(msg || t('app.uniDetail.attachmentCenter.loadFailed'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [documentId, documentType, t]);

  useEffect(() => {
    if (!active) return;
    void load();
  }, [active, load]);

  const openPreview = useCallback((uuid: string, name: string) => {
    const id = String(uuid || '').trim();
    if (!id) {
      void messageApi.error(t('app.uniDetail.attachmentCenter.previewMissingUuid'));
      return;
    }
    setPreviewFile({ uuid: id, name: name || t('components.documentAttachments.label') });
    setPreviewOpen(true);
  }, [messageApi, t]);

  const resolveDocTypeLabel = useCallback(
    (type: string) =>
      t(`components.documentTrackingPanel.docType.${type}`, {
        defaultValue: type,
      }),
    [t],
  );

  const collapseItems = useMemo(() => {
    const groups = data?.groups ?? [];
    return groups.map((group: DocumentAttachmentCenterGroup) => {
      const typeLabel = resolveDocTypeLabel(group.document_type);
      const code = String(group.document_code || '').trim();
      const header = (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Typography.Text strong>
            {typeLabel}
            {code ? ` ${code}` : ''}
          </Typography.Text>
          {group.is_self ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('app.uniDetail.attachmentCenter.selfBadge')}
            </Typography.Text>
          ) : null}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('app.uniDetail.attachmentCenter.fileCount', { count: group.attachments.length })}
          </Typography.Text>
        </span>
      );

      const body =
        group.attachments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {group.attachments.map((file) => {
              const uid = String(file.uid || '').trim();
              if (!uid) return null;
              const name = file.name || t('components.documentAttachments.label');
              if (looksLikeImage(name)) {
                return (
                  <div
                    key={`${group.document_type}-${group.document_id}-${uid}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                  >
                    <button
                      type="button"
                      onClick={() => openPreview(uid, name)}
                      style={{
                        padding: 0,
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <SecureImage
                        fileUuid={uid}
                        alt={name}
                        width={64}
                        height={64}
                        thumbSize={128}
                        previewSize={512}
                        style={{ objectFit: 'cover', borderRadius: 4 }}
                      />
                    </button>
                    <Typography.Text ellipsis style={{ flex: 1, minWidth: 0 }}>
                      {name}
                    </Typography.Text>
                    <Button
                      type="link"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => openPreview(uid, name)}
                    >
                      {t('app.uniDetail.attachmentCenter.preview')}
                    </Button>
                  </div>
                );
              }
              return (
                <div
                  key={`${group.document_type}-${group.document_id}-${uid}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <PaperClipOutlined />
                  <Typography.Text ellipsis style={{ flex: 1, minWidth: 0 }}>
                    {name}
                  </Typography.Text>
                  <Button
                    type="link"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => openPreview(uid, name)}
                  >
                    {t('app.uniDetail.attachmentCenter.preview')}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <Typography.Text type="secondary">{t('app.uniDetail.attachmentCenter.groupEmpty')}</Typography.Text>
        );

      return {
        key: `${group.document_type}-${group.document_id}`,
        label: header,
        children: body,
      };
    });
  }, [data?.groups, openPreview, resolveDocTypeLabel, t]);

  const defaultActiveKeys = useMemo(() => {
    const groups = data?.groups ?? [];
    const withFiles = groups.filter((g) => g.attachments.length > 0);
    if (withFiles.length > 0) {
      return withFiles.map((g) => `${g.document_type}-${g.document_id}`);
    }
    const self = groups.find((g) => g.is_self);
    if (self) return [`${self.document_type}-${self.document_id}`];
    return groups.slice(0, 1).map((g) => `${g.document_type}-${g.document_id}`);
  }, [data?.groups]);

  const totalFiles = useMemo(
    () => (data?.groups ?? []).reduce((sum, g) => sum + g.attachments.length, 0),
    [data?.groups],
  );

  if (!active) return null;

  if (loading && !data) {
    return (
      <div style={{ minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin />
      </div>
    );
  }

  if (error && !data) {
    return (
      <Result
        status="error"
        title={error}
        extra={
          <Button type="primary" onClick={() => void load()}>
            {t('common.retry', { defaultValue: '重试' })}
          </Button>
        }
      />
    );
  }

  if (!data || totalFiles === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t('app.uniDetail.attachmentCenter.empty')}
      />
    );
  }

  return (
    <>
      <Collapse
        size="small"
        defaultActiveKey={defaultActiveKeys}
        items={collapseItems}
      />
      <FilePreviewModal
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewFile(null);
        }}
        fileUuid={previewFile?.uuid}
        fileName={previewFile?.name}
        fileExtension={previewFile?.name ? getFileExt(previewFile.name) : undefined}
        title={previewFile?.name}
      />
    </>
  );
};

export default DocumentAttachmentCenterPane;
