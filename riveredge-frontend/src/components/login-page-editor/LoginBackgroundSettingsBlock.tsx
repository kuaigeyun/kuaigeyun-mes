import React from 'react';
import { Button, Form, Input, Space, Switch, Upload } from 'antd';
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { UploadFile, UploadProps } from 'antd';
import { isLoginVisualLayerEnabled } from '../../utils/loginVisualLayers';

export type LoginBackgroundSettingsBlockProps = {
  variant?: 'site' | 'platform';
  onAtLeastOneRequired?: () => void;
  backgroundUrl?: string;
  backgroundFileList: UploadFile[];
  onBackgroundUpload: UploadProps['beforeUpload'];
  onClearBackground: () => void;
  hasBackgroundValue: boolean;
};

const LoginBackgroundSettingsBlock: React.FC<LoginBackgroundSettingsBlockProps> = ({
  variant = 'site',
  onAtLeastOneRequired,
  backgroundUrl,
  backgroundFileList,
  onBackgroundUpload,
  onClearBackground,
  hasBackgroundValue,
}) => {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const enabled = isLoginVisualLayerEnabled(Form.useWatch('login_background_enabled', form));
  const isSite = variant === 'site';
  const label = isSite
    ? t('pages.system.siteSettings.loginBackgroundImage')
    : t('pages.infra.platform.loginBackgroundImage');
  const placeholder = isSite
    ? t('pages.system.siteSettings.loginBackgroundImagePlaceholder')
    : t('pages.infra.platform.loginBackgroundImagePlaceholder');
  const sizeHint = isSite
    ? t('pages.system.siteSettings.loginBackgroundRecommendedSize')
    : t('pages.infra.platform.loginBackgroundRecommendedSize');
  const uploadText = isSite
    ? t('pages.system.siteSettings.uploadBackgroundImage')
    : t('pages.infra.platform.uploadBackgroundImage');
  const clearText = isSite
    ? t('pages.system.siteSettings.clearBackgroundImage')
    : t('pages.infra.platform.clearBackgroundImage');

  return (
    <div className="login-page-editor-settings-block">
      <div className="login-page-editor-block-header">
        <span className="login-page-editor-block-header-title">{label}</span>
        <Form.Item
          name="login_background_enabled"
          valuePropName="checked"
          getValueFromEvent={(checked: boolean) => {
            const peerOn = isLoginVisualLayerEnabled(form.getFieldValue('login_decoration_enabled'));
            if (!checked && !peerOn) {
              onAtLeastOneRequired?.();
              return form.getFieldValue('login_background_enabled') ?? true;
            }
            return checked;
          }}
          noStyle
        >
          <Switch
            checkedChildren={t('common.enabled')}
            unCheckedChildren={t('common.disabled')}
          />
        </Form.Item>
      </div>
      <Form.Item name="login_background_image" extra={sizeHint}>
        <Input placeholder={placeholder} maxLength={isSite ? undefined : 500} disabled={!enabled} />
      </Form.Item>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {backgroundUrl && (
          <img
            src={backgroundUrl}
            alt={label}
            style={{
              width: '100%',
              maxWidth: 280,
              maxHeight: 140,
              objectFit: 'cover',
              border: '1px solid var(--river-border-color)',
              borderRadius: 8,
              background: '#fff',
            }}
          />
        )}
        <Space wrap>
          <Upload
            beforeUpload={onBackgroundUpload}
            fileList={backgroundFileList}
            maxCount={1}
            accept="image/*"
            showUploadList={false}
            disabled={!enabled}
          >
            <Button icon={<UploadOutlined />} disabled={!enabled}>
              {uploadText}
            </Button>
          </Upload>
          {hasBackgroundValue && (
            <Button icon={<DeleteOutlined />} onClick={onClearBackground} danger disabled={!enabled}>
              {clearText}
            </Button>
          )}
        </Space>
      </Space>
    </div>
  );
};

export default LoginBackgroundSettingsBlock;
