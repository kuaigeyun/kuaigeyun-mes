import React from 'react';
import { Form, Input, Space, Typography, theme } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { checkTenantDomainAvailability } from '../../services/siteSetting';

const RESERVED_DOMAIN_KEYWORDS = [
  'admin',
  'login',
  'infra',
  'system',
  'apps',
  'api',
  'docs',
  'debug',
  'qrcode',
  'init',
  'personal',
  'lock',
];
const TENANT_DOMAIN_PATTERN = /^[a-z][a-z0-9_-]{2,11}$/;

export type LoginDomainSettingsBlockProps = {
  tenantPathAccessUrl: string;
};

const LoginDomainSettingsBlock: React.FC<LoginDomainSettingsBlockProps> = ({ tenantPathAccessUrl }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();

  return (
    <div className="login-page-editor-settings-block">
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 12,
          width: '100%',
          padding: '12px 16px',
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          background: token.colorFillAlter,
        }}
      >
        <div style={{ flex: '0 0 280px', minWidth: 200 }}>
          <Form.Item
            name="tenant_domain"
            label={t('pages.system.siteSettings.currentTenantDomain')}
            rules={[
              { required: true, message: t('pages.system.siteSettings.tenantDomainRequired') },
              { min: 3, message: t('pages.system.siteSettings.tenantDomainMinLength') },
              { max: 12, message: t('pages.system.siteSettings.tenantDomainMaxLength') },
              { pattern: TENANT_DOMAIN_PATTERN, message: t('pages.system.siteSettings.tenantDomainPattern') },
              {
                validator: async (_, value) => {
                  const domain = String(value || '').trim().toLowerCase();
                  if (!domain) return;
                  if (domain.length < 3 || domain.length > 12) return;
                  if (!TENANT_DOMAIN_PATTERN.test(domain)) return;
                  const hit = RESERVED_DOMAIN_KEYWORDS.find((kw) => domain.includes(kw));
                  if (hit) {
                    throw new Error(t('pages.system.siteSettings.tenantDomainReserved', { keyword: hit }));
                  }
                  const result = await checkTenantDomainAvailability(domain);
                  if (!result.available) {
                    throw new Error(result.message || t('pages.system.siteSettings.tenantDomainDuplicate'));
                  }
                },
              },
            ]}
            normalize={(v) => String(v || '').trim().toLowerCase()}
            style={{ marginBottom: 0 }}
          >
            <Input placeholder={t('pages.system.siteSettings.tenantDomainPlaceholder')} />
          </Form.Item>
        </div>
        <div
          style={{
            width: 1,
            background: token.colorBorderSecondary,
            alignSelf: 'stretch',
            margin: '0 4px',
            flexShrink: 0,
          }}
        />
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <Space size={6} style={{ marginBottom: 4 }}>
            <LinkOutlined style={{ color: token.colorPrimary }} />
            <Typography.Text type="secondary">
              {t('pages.system.siteSettings.tenantPathAccessUrl')}
            </Typography.Text>
          </Space>
          <Typography.Paragraph
            style={{
              marginBottom: 0,
              fontSize: 16,
              lineHeight: 1.45,
              fontWeight: 600,
              wordBreak: 'break-all',
            }}
            copyable={tenantPathAccessUrl ? { text: tenantPathAccessUrl } : false}
          >
            {tenantPathAccessUrl || '-'}
          </Typography.Paragraph>
        </div>
      </div>
    </div>
  );
};

export default LoginDomainSettingsBlock;
