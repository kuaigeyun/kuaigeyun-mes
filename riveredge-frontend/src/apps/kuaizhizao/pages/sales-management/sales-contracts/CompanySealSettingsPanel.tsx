/**
 * 公司印章管理（站点 company_seal）：上传 / 模糊预览 / 清除。
 * 入口在条款管理弹窗；打印模板页不再托管。
 * 印章文件存于保密 category，但单据内使用不需文件管理二次密码。
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, App, Button, Space, Typography, Upload } from 'antd';
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import ImageCropper from '../../../../../components/image-cropper';
import { getSiteSetting, updateSiteSetting } from '../../../../../services/siteSetting';
import {
  uploadFile,
  getCompanySealPreview,
  invalidateCompanySealPreviewCache,
  type FileUploadResponse,
} from '../../../../../services/file';
import { toRelativeIfLocalhost } from '../../../../../utils/avatar';

function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export function useCompanySealSettings(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sealUuid, setSealUuid] = useState('');
  const [sealUrl, setSealUrl] = useState<string | undefined>();
  const [sealFileList, setSealFileList] = useState<UploadFile[]>([]);
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  const loadCompanySealPreview = useCallback(async (sealValue: string | undefined) => {
    if (!sealValue?.trim()) {
      setSealUrl(undefined);
      setSealFileList([]);
      return;
    }

    if (isUUID(sealValue.trim())) {
      const previewInfo = await getCompanySealPreview(sealValue.trim());
      if (!previewInfo?.preview_url) {
        setSealUrl(undefined);
        setSealFileList([]);
        return;
      }
      const previewUrl = toRelativeIfLocalhost(previewInfo.preview_url);
      setSealUrl(previewUrl);
      setSealFileList([{
        uid: sealValue.trim(),
        name: t('app.kuaizhizao.salesContract.terms.companySeal'),
        status: 'done',
        url: previewUrl,
      }]);
      return;
    }

    setSealUrl(sealValue.trim());
    setSealFileList([{
      uid: sealValue.trim(),
      name: t('app.kuaizhizao.salesContract.terms.companySeal'),
      status: 'done',
      url: sealValue.trim(),
    }]);
  }, [t]);

  const loadSealSetting = useCallback(async () => {
    setLoading(true);
    try {
      const setting = await getSiteSetting();
      const value = String(setting.settings?.company_seal ?? '').trim();
      setSealUuid(value);
      await loadCompanySealPreview(value || undefined);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.salesContract.terms.companySealLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [loadCompanySealPreview, messageApi, t]);

  useEffect(() => {
    if (!enabled) return;
    void loadSealSetting();
  }, [enabled, loadSealSetting]);

  const handleSealFileSelect: UploadProps['beforeUpload'] = (file) => {
    if (!file.type.startsWith('image/')) {
      messageApi.error(t('app.kuaizhizao.salesContract.terms.companySealSelectImage'));
      return false;
    }
    setSelectedImageFile(file);
    setCropModalVisible(true);
    return false;
  };

  const handleCropConfirm = async (croppedImageBlob: Blob) => {
    try {
      setSaving(true);
      const croppedFile = new File(
        [croppedImageBlob],
        selectedImageFile?.name || 'company-seal.png',
        { type: 'image/png', lastModified: Date.now() },
      );
      const localPreviewUrl = URL.createObjectURL(croppedFile);
      setCropModalVisible(false);
      setSelectedImageFile(null);
      setSealUrl(localPreviewUrl);

      const response: FileUploadResponse = await uploadFile(croppedFile, {
        category: 'company-seal',
        description: t('app.kuaizhizao.salesContract.terms.companySeal'),
      });

      if (!response.uuid) {
        URL.revokeObjectURL(localPreviewUrl);
        setSealUrl(undefined);
        throw new Error(t('app.kuaizhizao.salesContract.terms.companySealUploadFailed'));
      }

      invalidateCompanySealPreviewCache(response.uuid);
      setSealUuid(response.uuid);
      await updateSiteSetting({ settings: { company_seal: response.uuid } });

      let previewUrl: string | undefined;
      try {
        const previewInfo = await getCompanySealPreview(response.uuid);
        if (previewInfo?.preview_url) {
          previewUrl = toRelativeIfLocalhost(previewInfo.preview_url);
          URL.revokeObjectURL(localPreviewUrl);
          setSealUrl(previewUrl);
        }
      } catch {
        /* keep local blur preview */
      }

      setSealFileList([{
        uid: response.uuid,
        name: response.original_name,
        status: 'done',
        url: previewUrl || localPreviewUrl,
      }]);
      messageApi.success(t('app.kuaizhizao.salesContract.terms.companySealUploadSuccess'));
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.salesContract.terms.companySealUploadFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleClearSeal = async () => {
    try {
      setSaving(true);
      const previousSeal = sealUuid;
      setSealUuid('');
      setSealUrl(undefined);
      setSealFileList([]);
      await updateSiteSetting({ settings: { company_seal: '' } });
      if (previousSeal.trim()) {
        invalidateCompanySealPreviewCache(previousSeal.trim());
      }
      messageApi.success(t('app.kuaizhizao.salesContract.terms.companySealClearSuccess'));
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.salesContract.terms.companySealClearFailed'));
    } finally {
      setSaving(false);
    }
  };

  const cropModal = (
    <ImageCropper
      open={cropModalVisible}
      title={t('app.kuaizhizao.salesContract.terms.companySealCropTitle')}
      image={selectedImageFile}
      defaultShape="round"
      onCancel={() => {
        setCropModalVisible(false);
        setSelectedImageFile(null);
      }}
      onConfirm={handleCropConfirm}
    />
  );

  const panel = (
    <Space orientation="vertical" size="middle" style={{ width: '100%', paddingTop: 8 }}>
      <Alert
        type="info"
        showIcon
        title={t('app.kuaizhizao.salesContract.terms.companySealTooltip')}
      />
      <Space wrap>
        <Upload
          beforeUpload={handleSealFileSelect}
          fileList={sealFileList}
          maxCount={1}
          accept="image/*"
          showUploadList={false}
        >
          <Button icon={<UploadOutlined />} loading={saving || loading}>
            {t('app.kuaizhizao.salesContract.terms.uploadCompanySeal')}
          </Button>
        </Upload>
        {sealUrl ? (
          <Button icon={<DeleteOutlined />} danger loading={saving} onClick={() => void handleClearSeal()}>
            {t('app.kuaizhizao.salesContract.terms.clearCompanySeal')}
          </Button>
        ) : null}
      </Space>
      {sealUrl ? (
        <div>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            {t('app.kuaizhizao.salesContract.terms.companySealBlurHint')}
          </Typography.Text>
          <img
            src={sealUrl}
            alt={t('app.kuaizhizao.salesContract.terms.companySeal')}
            style={{
              maxWidth: 220,
              maxHeight: 220,
              objectFit: 'contain',
              filter: 'blur(6px)',
              borderRadius: 8,
              background: '#fafafa',
              border: '1px solid #f0f0f0',
              padding: 8,
            }}
          />
        </div>
      ) : (
        <Typography.Text type="secondary">
          {t('app.kuaizhizao.salesContract.terms.companySealEmpty')}
        </Typography.Text>
      )}
    </Space>
  );

  return {
    cropModal,
    panel,
  };
}
