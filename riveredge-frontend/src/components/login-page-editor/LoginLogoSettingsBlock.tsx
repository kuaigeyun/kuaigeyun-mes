import React from 'react';
import { Button, Form, Input, Space, Typography, Upload } from 'antd';
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { UploadFile, UploadProps } from 'antd';

export type LoginLogoSettingsBlockProps = {
  useCustomLoginLogo: boolean;
  onEnableCustomLoginLogo: () => void;
  onDisableCustomLoginLogo: () => void;
  loginLogoUrl?: string;
  loginLogoFileList: UploadFile[];
  onLoginLogoUpload: UploadProps['beforeUpload'];
  onClearLoginLogo: () => void;
  hasLoginLogoValue: boolean;
};

const LoginLogoSettingsBlock: React.FC<LoginLogoSettingsBlockProps> = ({
  useCustomLoginLogo,
  onEnableCustomLoginLogo,
  onDisableCustomLoginLogo,
  loginLogoUrl,
  loginLogoFileList,
  onLoginLogoUpload,
  onClearLoginLogo,
  hasLoginLogoValue,
}) => {
  const { t } = useTranslation();

  return (
    <div className="login-page-editor-settings-block">
      {!useCustomLoginLogo ? (
        <Form.Item label={t('pages.system.siteSettings.loginLogo')} style={{ marginBottom: 0 }}>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Typography.Text type="secondary">
              {t('pages.system.siteSettings.loginLogoFollowingSiteLogo')}
            </Typography.Text>
            <Button onClick={onEnableCustomLoginLogo}>
              {t('pages.system.siteSettings.enableCustomLoginLogo')}
            </Button>
          </Space>
        </Form.Item>
      ) : (
        <>
          <Form.Item name="login_logo" label={t('pages.system.siteSettings.loginLogo')}>
            <Input placeholder={t('pages.system.siteSettings.loginLogoPlaceholder')} />
          </Form.Item>
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: -8, marginBottom: 8 }}>
            {t('pages.system.siteSettings.loginLogoFollowSiteLogo')}
          </Typography.Text>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {loginLogoUrl && (
              <img
                src={loginLogoUrl}
                alt={t('pages.system.siteSettings.loginLogo')}
                style={{
                  width: '100%',
                  maxWidth: 200,
                  maxHeight: 100,
                  objectFit: 'contain',
                  border: '1px solid var(--river-border-color)',
                  borderRadius: 8,
                  background: '#fff',
                  padding: 8,
                }}
              />
            )}
            <Space wrap>
              <Upload
                beforeUpload={onLoginLogoUpload}
                fileList={loginLogoFileList}
                maxCount={1}
                accept="image/*"
                showUploadList={false}
              >
                <Button icon={<UploadOutlined />}>{t('pages.system.siteSettings.uploadLoginLogo')}</Button>
              </Upload>
              {hasLoginLogoValue && (
                <Button icon={<DeleteOutlined />} onClick={onClearLoginLogo} danger>
                  {t('pages.system.siteSettings.clearLoginLogo')}
                </Button>
              )}
              <Button onClick={onDisableCustomLoginLogo}>
                {t('pages.system.siteSettings.disableCustomLoginLogo')}
              </Button>
            </Space>
          </Space>
        </>
      )}
    </div>
  );
};

export default LoginLogoSettingsBlock;
