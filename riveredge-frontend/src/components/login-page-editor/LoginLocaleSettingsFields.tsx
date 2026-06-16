import React, { useState } from 'react';
import { Form, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { ThemedSegmented } from '../themed-segmented';
import LoginRichTextEditor, { type LoginRichTextEditorMode } from './LoginRichTextEditor';

export type LoginLocaleSettingsFieldsProps = {
  locale: 'zh-CN' | 'en-US';
  /** site 含平台名称；platform 仅登录文案 */
  variant?: 'site' | 'platform';
  minEditorHeight?: number;
};

const LoginLocaleSettingsFields: React.FC<LoginLocaleSettingsFieldsProps> = ({
  locale,
  variant = 'site',
  minEditorHeight = 180,
}) => {
  const { t } = useTranslation();
  const isEn = locale === 'en-US';
  const [editorMode, setEditorMode] = useState<LoginRichTextEditorMode>('visual');

  const contentLabel = isEn
    ? t('pages.infra.platform.loginContentEn')
    : t('pages.infra.platform.loginContent');

  return (
    <>
      {variant === 'site' && (
        <Form.Item
          name={isEn ? 'platform_name_en' : 'platform_name'}
          label={isEn ? t('pages.infra.platform.platformNameEn') : t('pages.infra.platform.platformName')}
        >
          <Input
            placeholder={
              isEn
                ? t('pages.infra.platform.platformNameEnPlaceholder')
                : t('pages.infra.platform.platformNamePlaceholder')
            }
          />
        </Form.Item>
      )}
      <Form.Item
        name={isEn ? 'login_title_en' : 'login_title'}
        label={isEn ? t('pages.infra.platform.loginTitleEn') : t('pages.infra.platform.loginTitle')}
      >
        <Input
          maxLength={200}
          placeholder={
            isEn
              ? t('pages.infra.platform.loginTitleEnPlaceholder')
              : t('pages.infra.platform.loginTitlePlaceholder')
          }
        />
      </Form.Item>
      <Form.Item
        name={isEn ? 'login_content_en' : 'login_content'}
        colon={false}
        label={
          <div className="login-rich-text-editor-label-row">
            <span className="login-rich-text-editor-label-text">{contentLabel}</span>
            <ThemedSegmented
              size="small"
              value={editorMode}
              onChange={(next) => setEditorMode(next as LoginRichTextEditorMode)}
              options={[
                { label: t('pages.system.siteSettings.loginEditorVisual'), value: 'visual' },
                { label: t('pages.system.siteSettings.loginEditorCode'), value: 'code' },
              ]}
            />
          </div>
        }
      >
        <LoginRichTextEditor
          mode={editorMode}
          placeholder={
            isEn
              ? t('pages.infra.platform.loginContentEnPlaceholder')
              : t('pages.infra.platform.loginContentPlaceholder')
          }
          minHeight={minEditorHeight}
        />
      </Form.Item>
      <Form.Item
        name={isEn ? 'icp_license_en' : 'icp_license'}
        label={isEn ? t('pages.infra.platform.icpLicenseEn') : t('pages.infra.platform.icpLicense')}
        style={{ marginBottom: 0 }}
      >
        <Input
          maxLength={100}
          placeholder={
            isEn
              ? t('pages.infra.platform.icpLicenseEnPlaceholder')
              : t('pages.infra.platform.icpLicensePlaceholder')
          }
        />
      </Form.Item>
    </>
  );
};

export default LoginLocaleSettingsFields;
