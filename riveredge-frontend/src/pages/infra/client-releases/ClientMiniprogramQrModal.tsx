import { InboxOutlined } from '@ant-design/icons';
import { App, Image, Switch, Typography, Upload } from 'antd';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FormModalTemplate, MODAL_CONFIG } from '../../../components/layout-templates';
import {
  getAdminHeaderMiniprogramQr,
  updateAdminHeaderMiniprogramQr,
} from '../../../services/clientRelease';
import { normalizeFilePreviewUrl, uploadFile } from '../../../services/file';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ClientMiniprogramQrModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [fileUuid, setFileUuid] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminHeaderMiniprogramQr();
      setEnabled(Boolean(data.enabled));
      const uuid = data.file_uuid?.trim() || null;
      setFileUuid(uuid);
      const url = data.image_url ? normalizeFilePreviewUrl(data.image_url) : null;
      setImageUrl(url);
      setFileList(
        uuid && url
          ? [{ uid: uuid, name: t('pages.infra.clientReleases.miniprogramQrImageName'), status: 'done', url }]
          : [],
      );
    } catch (e) {
      messageApi.error(
        e instanceof Error ? e.message : t('pages.infra.clientReleases.miniprogramQrFetchFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [messageApi, t]);

  useEffect(() => {
    if (open) {
      void loadConfig();
    } else {
      setEnabled(false);
      setFileUuid(null);
      setImageUrl(null);
      setFileList([]);
    }
  }, [open, loadConfig]);

  const handleBeforeUpload: UploadProps['beforeUpload'] = async (file) => {
    if (!file.type.startsWith('image/')) {
      messageApi.error(t('pages.infra.clientReleases.miniprogramQrSelectImage'));
      return Upload.LIST_IGNORE;
    }
    try {
      const response = await uploadFile(file, {
        category: 'miniprogram-qr',
        description: t('pages.infra.clientReleases.miniprogramQrImageName'),
      });
      if (!response.uuid) {
        messageApi.error(t('pages.infra.clientReleases.miniprogramQrUploadFailed'));
        return Upload.LIST_IGNORE;
      }
      const localUrl = URL.createObjectURL(file);
      setFileUuid(response.uuid);
      setImageUrl(localUrl);
      setFileList([
        {
          uid: response.uuid,
          name: response.original_name || file.name,
          status: 'done',
          url: localUrl,
        },
      ]);
      messageApi.success(t('pages.infra.clientReleases.miniprogramQrUploadSuccess'));
    } catch (e) {
      messageApi.error(
        e instanceof Error ? e.message : t('pages.infra.clientReleases.miniprogramQrUploadFailed'),
      );
    }
    return Upload.LIST_IGNORE;
  };

  const handleRemove = () => {
    setFileUuid(null);
    setImageUrl(null);
    setFileList([]);
    if (enabled) {
      setEnabled(false);
    }
    return true;
  };

  const handleSave = async () => {
    if (enabled && !fileUuid) {
      messageApi.warning(t('pages.infra.clientReleases.miniprogramQrRequireImage'));
      return;
    }
    setSaving(true);
    try {
      const data = await updateAdminHeaderMiniprogramQr({
        enabled,
        file_uuid: fileUuid ?? '',
      });
      setEnabled(Boolean(data.enabled));
      setFileUuid(data.file_uuid?.trim() || null);
      setImageUrl(data.image_url ? normalizeFilePreviewUrl(data.image_url) : null);
      messageApi.success(t('pages.infra.clientReleases.miniprogramQrSaveSuccess'));
      onClose();
    } catch (e) {
      messageApi.error(
        e instanceof Error ? e.message : t('pages.infra.clientReleases.miniprogramQrSaveFailed'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalTemplate
      title={t('pages.infra.clientReleases.miniprogramQrModalTitle')}
      open={open}
      onClose={onClose}
      onFinish={handleSave}
      loading={loading || saving}
      width={MODAL_CONFIG.TINY_WIDTH}
      submitText={t('common.save')}
      isEdit
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Typography.Text strong>
              {t('pages.infra.clientReleases.miniprogramQrEnabled')}
            </Typography.Text>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('pages.infra.clientReleases.miniprogramQrEnabledHint')}
              </Typography.Text>
            </div>
          </div>
          <Switch checked={enabled} onChange={setEnabled} disabled={loading} />
        </div>

        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            {t('pages.infra.clientReleases.miniprogramQrUpload')}
          </Typography.Text>
          <Upload.Dragger
            accept="image/*"
            maxCount={1}
            fileList={fileList}
            beforeUpload={handleBeforeUpload}
            onRemove={handleRemove}
            listType="picture"
            disabled={loading || saving}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">{t('pages.infra.clientReleases.miniprogramQrDragHint')}</p>
            <p className="ant-upload-hint">{t('pages.infra.clientReleases.miniprogramQrDragSubHint')}</p>
          </Upload.Dragger>
        </div>

        {imageUrl ? (
          <div style={{ textAlign: 'center' }}>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              {t('pages.infra.clientReleases.miniprogramQrPreview')}
            </Typography.Text>
            <Image
              src={imageUrl}
              alt={t('pages.infra.clientReleases.miniprogramQrImageName')}
              width={180}
              style={{ borderRadius: 8 }}
            />
          </div>
        ) : null}
      </div>
    </FormModalTemplate>
  );
}
