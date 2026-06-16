import React from 'react';
import { Button, Form, Input, Space, Switch, Upload } from 'antd';
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { UploadFile, UploadProps } from 'antd';
import { isLoginVisualLayerEnabled } from '../../utils/loginVisualLayers';

export type LoginDecorationSettingsBlockProps = {
  variant?: 'site' | 'platform';
  onAtLeastOneRequired?: () => void;
  decorationUrl?: string;
  decorationFileList: UploadFile[];
  onDecorationUpload: UploadProps['beforeUpload'];
  onClearDecoration: () => void;
  hasDecorationValue: boolean;
};

const LoginDecorationSettingsBlock: React.FC<LoginDecorationSettingsBlockProps> = ({
  variant = 'site',
  onAtLeastOneRequired,
  decorationUrl,
  decorationFileList,
  onDecorationUpload,
  onClearDecoration,
  hasDecorationValue,
}) => {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const enabled = isLoginVisualLayerEnabled(Form.useWatch('login_decoration_enabled', form));
  const isSite = variant === 'site';
  const label = isSite
    ? t('pages.system.siteSettings.loginDecorationImage')
    : t('pages.infra.platform.loginDecorationImage');
  const placeholder = isSite
    ? t('pages.system.siteSettings.loginDecorationImagePlaceholder')
    : t('pages.infra.platform.loginDecorationImagePlaceholder');
  const sizeHint = isSite
    ? t('pages.system.siteSettings.loginDecorationRecommendedSize')
    : t('pages.infra.platform.loginDecorationRecommendedSize');
  const uploadText = isSite
    ? t('pages.system.siteSettings.uploadDecorationImage')
    : t('pages.infra.platform.uploadDecorationImage');
  const clearText = isSite
    ? t('pages.system.siteSettings.clearDecorationImage')
    : t('pages.infra.platform.clearDecorationImage');

  return (
    <div className="login-page-editor-settings-block">
      <div className="login-page-editor-block-header">
        <span className="login-page-editor-block-header-title">{label}</span>
        <Form.Item
          name="login_decoration_enabled"
          valuePropName="checked"
          getValueFromEvent={(checked: boolean) => {
            const peerOn = isLoginVisualLayerEnabled(form.getFieldValue('login_background_enabled'));
            if (!checked && !peerOn) {
              onAtLeastOneRequired?.();
              return form.getFieldValue('login_decoration_enabled') ?? true;
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
      <Form.Item name="login_decoration_image" extra={sizeHint}>
        <Input placeholder={placeholder} maxLength={isSite ? undefined : 500} disabled={!enabled} />
      </Form.Item>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {decorationUrl && (
          <img
            src={decorationUrl}
            alt={label}
            style={{
              width: '100%',
              maxWidth: 280,
              maxHeight: 180,
              objectFit: 'contain',
              border: '1px solid var(--river-border-color)',
              borderRadius: 8,
              background: '#fff',
              padding: 8,
              opacity: enabled ? 1 : 0.45,
            }}
          />
        )}
        <Space wrap>
          <Upload
            beforeUpload={onDecorationUpload}
            fileList={decorationFileList}
            maxCount={1}
            accept="image/*"
            showUploadList={false}
            disabled={!enabled}
          >
            <Button icon={<UploadOutlined />} disabled={!enabled}>
              {uploadText}
            </Button>
          </Upload>
          {hasDecorationValue && (
            <Button icon={<DeleteOutlined />} onClick={onClearDecoration} danger disabled={!enabled}>
              {clearText}
            </Button>
          )}
        </Space>
      </Space>
    </div>
  );
};

export default LoginDecorationSettingsBlock;
