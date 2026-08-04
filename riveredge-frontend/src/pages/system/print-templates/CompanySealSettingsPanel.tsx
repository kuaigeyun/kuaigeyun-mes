import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Button, Upload } from 'antd';
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import ImageCropper from '../../../components/image-cropper';
import { getSiteSetting, updateSiteSetting } from '../../../services/siteSetting';
import {
  uploadFile,
  getCompanySealPreview,
  invalidateCompanySealPreviewCache,
  type FileUploadResponse,
} from '../../../services/file';
import { toRelativeIfLocalhost } from '../../../utils/avatar';

function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export function useCompanySealSettings() {
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
        name: t('pages.system.printTemplates.companySeal'),
        status: 'done',
        url: previewUrl,
      }]);
      return;
    }

    setSealUrl(sealValue.trim());
    setSealFileList([{
      uid: sealValue.trim(),
      name: t('pages.system.printTemplates.companySeal'),
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
      messageApi.error(error?.message || t('pages.system.printTemplates.companySealLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [loadCompanySealPreview, messageApi, t]);

  useEffect(() => {
    void loadSealSetting();
  }, [loadSealSetting]);

  const handleSealFileSelect: UploadProps['beforeUpload'] = (file) => {
    if (!file.type.startsWith('image/')) {
      messageApi.error(t('pages.system.printTemplates.companySealSelectImage'));
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
        description: t('pages.system.printTemplates.companySeal'),
      });

      if (!response.uuid) {
        URL.revokeObjectURL(localPreviewUrl);
        setSealUrl(undefined);
        throw new Error(t('pages.system.printTemplates.companySealUploadFailed'));
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
      messageApi.success(t('pages.system.printTemplates.companySealUploadSuccess'));
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.printTemplates.companySealUploadFailed'));
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
      messageApi.success(t('pages.system.printTemplates.companySealClearSuccess'));
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.printTemplates.companySealClearFailed'));
    } finally {
      setSaving(false);
    }
  };

  const cropModal = (
    <ImageCropper
      open={cropModalVisible}
      title={t('pages.system.printTemplates.companySealCropTitle')}
      image={selectedImageFile}
      defaultShape="round"
      onCancel={() => {
        setCropModalVisible(false);
        setSelectedImageFile(null);
      }}
      onConfirm={handleCropConfirm}
    />
  );

  const toolbarActions = (
    <>
      <Upload
        beforeUpload={handleSealFileSelect}
        fileList={sealFileList}
        maxCount={1}
        accept="image/*"
        showUploadList={false}
      >
        <Button icon={<UploadOutlined />} loading={saving || loading}>
          {t('pages.system.printTemplates.uploadCompanySeal')}
        </Button>
      </Upload>
      {sealUrl && (
        <Button icon={<DeleteOutlined />} danger loading={saving} onClick={() => void handleClearSeal()}>
          {t('pages.system.printTemplates.clearCompanySeal')}
        </Button>
      )}
    </>
  );

  return {
    cropModal,
    toolbarActions,
  };
}
