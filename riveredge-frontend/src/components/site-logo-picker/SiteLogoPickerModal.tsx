/**
 * 从「站点 Logo」文件分类中选取已有图片，避免重复上传。
 */

import React, { useCallback, useEffect, useState } from 'react';
import { App, Empty, Modal, Spin, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { getFileList, type File as CoreFile } from '../../services/file';
import { toRelativeIfLocalhost } from '../../utils/avatar';

const SITE_LOGO_CATEGORY = 'site-logo';

export type SiteLogoPickerModalProps = {
  open: boolean;
  onCancel: () => void;
  onSelect: (file: CoreFile) => void | Promise<void>;
  /** 当前已选用的 logo uuid，用于高亮 */
  currentUuid?: string;
};

function isImageFile(file: CoreFile): boolean {
  const type = (file.file_type || '').toLowerCase();
  if (type.startsWith('image/')) return true;
  const ext = (file.file_extension || file.original_name?.split('.').pop() || '').toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext);
}

function isFolderPlaceholder(file: CoreFile): boolean {
  const name = (file.original_name || file.name || '').toLowerCase();
  return name.startsWith('folder_') && name.endsWith('.txt');
}

export const SiteLogoPickerModal: React.FC<SiteLogoPickerModalProps> = ({
  open,
  onCancel,
  onSelect,
  currentUuid,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [items, setItems] = useState<CoreFile[]>([]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFileList({
        page: 1,
        page_size: 200,
        category: SITE_LOGO_CATEGORY,
        include_preview_url: true,
      });
      setItems((res.items || []).filter((f) => isImageFile(f) && !isFolderPlaceholder(f)));
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.siteSettings.selectLogoLoadFailed'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [messageApi, t]);

  useEffect(() => {
    if (open) {
      void loadItems();
    }
  }, [open, loadItems]);

  const handlePick = async (file: CoreFile) => {
    if (selecting) return;
    setSelecting(true);
    try {
      await onSelect(file);
    } finally {
      setSelecting(false);
    }
  };

  return (
    <Modal
      title={t('pages.system.siteSettings.selectLogoTitle')}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={720}
      destroyOnHidden
      mask={{ closable: !selecting }}
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        {t('pages.system.siteSettings.selectLogoHint')}
      </Typography.Paragraph>
      <Spin spinning={loading || selecting} description={selecting ? t('pages.system.siteSettings.selectLogoApplying') : undefined}>
        {!loading && items.length === 0 ? (
          <Empty description={t('pages.system.siteSettings.selectLogoEmpty')} />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 12,
              maxHeight: 420,
              overflowY: 'auto',
              padding: '4px 2px 8px',
            }}
          >
            {items.map((file) => {
              const preview = file.preview_url ? toRelativeIfLocalhost(file.preview_url) : undefined;
              const selected = Boolean(currentUuid && currentUuid === file.uuid);
              return (
                <button
                  key={file.uuid}
                  type="button"
                  onClick={() => void handlePick(file)}
                  disabled={selecting}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: 8,
                    padding: 10,
                    borderRadius: 8,
                    border: selected
                      ? '2px solid var(--ant-color-primary, #1677ff)'
                      : '1px solid var(--river-border-color, #d9d9d9)',
                    background: 'var(--ant-color-bg-container, #fff)',
                    cursor: selecting ? 'wait' : 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      height: 88,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--ant-color-fill-quaternary, #f5f5f5)',
                      borderRadius: 6,
                      overflow: 'hidden',
                    }}
                  >
                    {preview ? (
                      <img
                        src={preview}
                        alt={file.original_name || file.name}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <Typography.Text type="secondary">
                        {(file.file_extension || 'IMG').toUpperCase()}
                      </Typography.Text>
                    )}
                  </div>
                  <Typography.Text ellipsis title={file.original_name || file.name} style={{ fontSize: 12 }}>
                    {file.original_name || file.name}
                  </Typography.Text>
                </button>
              );
            })}
          </div>
        )}
      </Spin>
    </Modal>
  );
};
