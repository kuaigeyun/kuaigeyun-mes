/**
 * 登录页注册抽屉 - 按需懒加载
 *
 * 包含个人注册、组织注册表单，仅在用户点击「立即注册」时加载
 */

import { ProForm, ProFormText, ProFormGroup, ProFormItem } from '@ant-design/pro-components';
import { Typography, Button, Space, Card, Row, Col, Drawer, Alert, AutoComplete, Input, App } from 'antd';
import { UserOutlined, LockOutlined, UserAddOutlined, ApartmentOutlined, ArrowLeftOutlined, MailOutlined, MobileOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { TenantCheckResponse, TenantSearchOption } from '../../services/register';

const { Title, Text } = Typography;

export interface PersonalRegisterFormData {
  username: string;
  phone: string;
  phone_verification_code: string;
  email?: string;
  password: string;
  confirm_password: string;
  full_name?: string;
  tenant_domain?: string;
  invite_code?: string;
}

export interface OrganizationRegisterFormData {
  tenant_name: string;
  phone: string;
  password: string;
  confirm_password: string;
  tenant_domain?: string;
  email?: string;
}

export interface RegisterDrawerProps {
  open: boolean;
  onClose: () => void;
  registerType: 'select' | 'personal' | 'organization';
  setRegisterType: (t: 'select' | 'personal' | 'organization') => void;
  themeColor: string;
  token: { colorBorder: string; borderRadiusLG: number };
  handlePersonalRegister: (values: PersonalRegisterFormData) => Promise<void>;
  handleOrganizationRegister: (values: OrganizationRegisterFormData) => Promise<void>;
  tenantCheckResult: TenantCheckResponse | null;
  tenantSearchOptions: TenantSearchOption[];
  selectedTenant: TenantSearchOption | null;
  searchingTenant: boolean;
  handleSearchTenant: (keyword: string) => Promise<void>;
  handleSelectTenant: (value: string, option: any) => void;
  setTenantSearchOptions: (options: TenantSearchOption[]) => void;
  setSelectedTenant: (t: TenantSearchOption | null) => void;
  setTenantCheckResult: (r: TenantCheckResponse | null) => void;
  onSendVerificationCode: (phone: string) => Promise<void>;
}

export default function RegisterDrawer({
  open,
  onClose,
  registerType,
  setRegisterType,
  themeColor,
  token,
  handlePersonalRegister,
  handleOrganizationRegister,
  tenantCheckResult,
  tenantSearchOptions,
  selectedTenant,
  searchingTenant,
  handleSearchTenant,
  handleSelectTenant,
  setTenantSearchOptions,
  setSelectedTenant,
  setTenantCheckResult,
  onSendVerificationCode,
}: RegisterDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();

  return (
    <Drawer
      title={
        registerType === 'select' ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
              {t('pages.login.registerTypeTitle')}
            </Title>
            <Text type="secondary" style={{ fontSize: 14 }}>
              {t('pages.login.registerTypeSubtitle')}
            </Text>
          </div>
        ) : registerType === 'personal' ? (
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => setRegisterType('select')}
              style={{ padding: 0, marginRight: 8 }}
            >
              {t('pages.login.back')}
            </Button>
            <Title level={4} style={{ margin: 0 }}>
              {t('pages.login.personalRegister')}
            </Title>
          </Space>
        ) : (
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => setRegisterType('select')}
              style={{ padding: 0, marginRight: 8 }}
            >
              {t('pages.login.back')}
            </Button>
            <Title level={4} style={{ margin: 0 }}>
              {t('pages.login.orgRegister')}
            </Title>
          </Space>
        )
      }
      open={open}
      onClose={onClose}
      size="large"
      placement="right"
      maskClosable={true}
      closable={true}
      destroyOnHidden={false}
      styles={{
        body: {
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          position: 'relative',
          overflow: 'auto',
        },
        header: {
          padding: '16px 24px',
          borderBottom: `1px solid ${token.colorBorder}`,
        },
      }}
    >
      {registerType === 'select' && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '32px',
            maxWidth: '800px',
            width: '100%',
            padding: '0 32px',
          }}
        >
          <Row gutter={[24, 24]} style={{ margin: 0, width: '100%' }}>
            <Col xs={24} sm={12} style={{ display: 'flex' }}>
              <div style={{ width: '100%', display: 'flex' }}>
                <Card
                  hoverable
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    border: `2px solid ${themeColor}`,
                    borderRadius: token.borderRadiusLG,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  }}
                  styles={{
                    body: {
                      padding: '32px 24px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '220px',
                    },
                  }}
                  onClick={() => setRegisterType('personal')}
                >
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      backgroundColor: `${themeColor}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 20,
                      position: 'relative',
                      zIndex: 1,
                      border: `2px solid ${themeColor}30`,
                    }}
                  >
                    <UserAddOutlined style={{ fontSize: 36, color: themeColor }} />
                  </div>
                  <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
                    <Title level={4} style={{ margin: '0 0 12px 0', color: themeColor, fontWeight: 600 }}>
                      {t('pages.login.personalRegister')}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 14, lineHeight: '24px', display: 'block' }}>
                      {t('pages.login.personalRegisterDesc')}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 14, lineHeight: '24px', display: 'block', marginTop: 4 }}>
                      {t('pages.login.personalRegisterDesc2')}
                    </Text>
                  </div>
                </Card>
              </div>
            </Col>
            <Col xs={24} sm={12} style={{ display: 'flex' }}>
              <div style={{ width: '100%', display: 'flex' }}>
                <Card
                  hoverable
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    border: '2px solid #52c41a',
                    borderRadius: token.borderRadiusLG,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  }}
                  styles={{
                    body: {
                      padding: '32px 24px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '220px',
                    },
                  }}
                  onClick={() => setRegisterType('organization')}
                >
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      backgroundColor: '#52c41a15',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 20,
                      position: 'relative',
                      zIndex: 1,
                      border: '2px solid #52c41a30',
                    }}
                  >
                    <ApartmentOutlined style={{ fontSize: 36, color: '#52c41a' }} />
                  </div>
                  <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
                    <Title level={4} style={{ margin: '0 0 12px 0', color: '#52c41a', fontWeight: 600 }}>
                      {t('pages.login.orgRegister')}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 14, lineHeight: '24px', display: 'block' }}>
                      {t('pages.login.orgRegisterDesc')}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 14, lineHeight: '24px', display: 'block', marginTop: 4 }}>
                      {t('pages.login.orgRegisterDesc2')}
                    </Text>
                  </div>
                </Card>
              </div>
            </Col>
          </Row>
          <div style={{ textAlign: 'center', paddingTop: '24px', flexShrink: 0, width: '100%' }}>
            <Text type="secondary" style={{ fontSize: 14 }}>
              {t('pages.login.hasAccount')}
              <Button type="link" style={{ padding: 0, fontSize: 14, height: 'auto', marginLeft: 4 }} onClick={onClose}>
                {t('pages.login.loginNow')}
              </Button>
            </Text>
          </div>
        </div>
      )}

      {registerType === 'personal' && (
        <div style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
          <style>{`
            .register-form .ant-input::placeholder,
            .register-form .ant-input-affix-wrapper .ant-input::placeholder {
              font-size: 14px !important;
            }
          `}</style>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: '#52c41a',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 'bold',
                  marginRight: 8,
                }}
              >
                1
              </div>
              <div style={{ flex: 1, height: 2, backgroundColor: '#52c41a', marginRight: 8 }}></div>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: '#d9d9d9',
                  color: '#666',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 'bold',
                  marginRight: 8,
                }}
              >
                2
              </div>
              <div style={{ flex: 1, height: 2, backgroundColor: '#d9d9d9' }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 12, color: '#52c41a', fontWeight: 500 }}>{t('pages.login.stepFillInfo')}</Text>
              <Text style={{ fontSize: 12, color: '#666' }}>{t('pages.login.stepVerifyEmail')}</Text>
            </div>
            <Text type="secondary" style={{ fontSize: 14 }}>
              {t('pages.login.fillInfoHint')}
            </Text>
          </div>
          <Alert
            title={t('pages.login.registerNoticeTitle')}
            description={
              <div>
                <div style={{ marginBottom: 6 }}>• {t('pages.login.registerNoticeBullet1')}</div>
                <div style={{ marginBottom: 6 }}>• {t('pages.login.registerNoticeBullet2')}</div>
                <div>• {t('pages.login.registerNoticeBullet3')}</div>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
            closable
          />
          <ProForm<PersonalRegisterFormData>
            onFinish={handlePersonalRegister}
            submitter={{
              searchConfig: { submitText: t('pages.login.registerSubmit') },
              submitButtonProps: { size: 'large', type: 'primary', style: { width: '100%', height: '40px' }, loading: false },
            }}
            size="large"
            grid={true}
            rowProps={{ gutter: 16 }}
            className="register-form"
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                const form = e.currentTarget as any;
                if (form?.submit) form.submit();
              }
            }}
          >
            <ProFormGroup title={t('pages.login.userInfoGroup')}>
              <ProFormText
                name="username"
                label={t('pages.login.username')}
                colProps={{ span: 12 }}
                rules={[
                  { required: true, message: t('pages.login.usernameRequired') },
                  { min: 3, max: 50, message: t('pages.login.usernameLen') },
                  { pattern: /^[a-zA-Z0-9_-]+$/, message: t('pages.login.usernamePattern') },
                ]}
                fieldProps={{ size: 'large', prefix: <UserOutlined />, placeholder: t('pages.login.usernamePlaceholderLong'), autoComplete: 'username' }}
                extra={
                  <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '12px' }}>
                    <div>{t('pages.login.usernameExtra')}</div>
                  </div>
                }
              />
              <ProFormText
                name="phone"
                label={t('pages.login.phone')}
                colProps={{ span: 12 }}
                rules={[
                  { required: true, message: t('pages.login.phoneRequired') },
                  { pattern: /^1[3-9]\d{9}$/, message: t('pages.login.phoneInvalid') },
                ]}
                fieldProps={{ size: 'large', prefix: <MobileOutlined />, placeholder: t('pages.login.phonePlaceholder'), autoComplete: 'tel', maxLength: 11 }}
                extra={
                  <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '12px' }}>
                    <div>{t('pages.login.phoneExtra')}</div>
                    <div style={{ marginTop: 4, color: '#52c41a' }}>{t('pages.login.phoneSupport')}</div>
                  </div>
                }
              />
              <ProFormText
                name="phone_verification_code"
                label={t('pages.login.smsCode')}
                colProps={{ span: 12 }}
                rules={[{ required: false }, { pattern: /^\d{6}$/, message: t('pages.login.verificationCodeInvalid') }]}
                fieldProps={{
                  size: 'large',
                  placeholder: t('pages.login.smsCodePlaceholder'),
                  maxLength: 6,
                  addonAfter: (
                    <Button
                      type="link"
                      style={{ padding: '0 8px', height: '100%' }}
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const form = document.querySelector('.register-form') as any;
                        if (form?.getFieldsValue) {
                          const values = form.getFieldsValue();
                          const phone = values.phone;
                          if (!phone) {
                            message.warning(t('pages.login.pleaseEnterPhone'));
                            return;
                          }
                          if (!/^1[3-9]\d{9}$/.test(phone)) {
                            message.warning(t('pages.login.pleaseEnterValidPhone'));
                            return;
                          }
                          await onSendVerificationCode(phone);
                        }
                      }}
                    >
                      {t('pages.login.getCode')}
                    </Button>
                  ),
                }}
                extra={
                  <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '12px' }}>
                    <div style={{ color: '#faad14' }}>{t('pages.login.codeNotConnected')}</div>
                    <div>{t('pages.login.codeExtra')}</div>
                  </div>
                }
              />
              <ProFormText
                name="email"
                label={t('pages.login.emailOptional')}
                colProps={{ span: 12 }}
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value || value.trim() === '') return Promise.resolve();
                      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return Promise.resolve();
                      return Promise.reject(new Error(t('pages.login.emailInvalid')));
                    },
                  },
                ]}
                fieldProps={{ size: 'large', prefix: <MailOutlined />, placeholder: t('pages.login.emailPlaceholder'), autoComplete: 'email' }}
                extra={
                  <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '12px' }}>
                    <div>{t('pages.login.emailExtra')}</div>
                    <div style={{ marginTop: 4, color: '#1890ff' }}>{t('pages.login.emailSupport')}</div>
                  </div>
                }
              />
              <ProFormText.Password
                name="password"
                label={t('pages.login.password')}
                colProps={{ span: 12 }}
                rules={[
                  { required: true, message: t('pages.login.passwordRequired') },
                  { min: 8, message: t('pages.login.passwordLen') },
                  { max: 128, message: t('pages.login.passwordLenMax') },
                ]}
                fieldProps={{ size: 'large', prefix: <LockOutlined />, placeholder: t('pages.login.passwordPlaceholderLong'), autoComplete: 'new-password' }}
                extra={
                  <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '12px' }}>{t('pages.login.passwordExtra')}</div>
                }
              />
              <ProFormText.Password
                name="confirm_password"
                label={t('pages.login.confirmPassword')}
                colProps={{ span: 12 }}
                rules={[
                  { required: true, message: t('pages.login.confirmPasswordRequired') },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) return Promise.resolve();
                      return Promise.reject(new Error(t('pages.login.confirmPasswordMismatch')));
                    },
                  }),
                ]}
                fieldProps={{ size: 'large', prefix: <LockOutlined />, placeholder: t('pages.login.confirmPasswordPlaceholder'), autoComplete: 'new-password' }}
              />
            </ProFormGroup>
            <ProFormGroup title={t('pages.login.orgInfoGroup')}>
              <Row gutter={16}>
                <Col span={12}>
                  <ProFormItem
                    name="tenant_domain"
                    label={t('pages.login.joinOrgOptional')}
                    extra={
                      <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '12px' }}>
                        <div style={{ marginBottom: 4, fontSize: '12px' }}>{t('pages.login.joinOrgExtra')}</div>
                        {tenantCheckResult?.exists && selectedTenant && (
                          <div style={{ marginTop: 4 }}>
                            <Text type="success" style={{ fontSize: 11 }}>
                              {t('pages.login.selectedTenant', { name: selectedTenant.tenant_name, domain: selectedTenant.tenant_domain })}
                            </Text>
                          </div>
                        )}
                        {tenantSearchOptions.length > 0 && !selectedTenant && (
                          <div style={{ marginTop: 4 }}>
                            <Text type="warning" style={{ fontSize: 11 }}>
                              {t('pages.login.foundTenants', { count: tenantSearchOptions.length })}
                            </Text>
                          </div>
                        )}
                        {tenantSearchOptions.length === 0 && !searchingTenant && selectedTenant === null && tenantCheckResult && !tenantCheckResult.exists && (
                          <div style={{ marginTop: 4 }}>
                            <Space>
                              <Text type="danger" style={{ fontSize: 11 }}>
                                {t('pages.login.noTenantFound')}
                              </Text>
                              <Button type="link" size="small" style={{ padding: 0, fontSize: 11, height: 'auto' }} onClick={() => setRegisterType('organization')}>
                                {t('pages.login.createNewOrg')}
                              </Button>
                            </Space>
                          </div>
                        )}
                      </div>
                    }
                  >
                    <AutoComplete
                      options={(tenantSearchOptions || []).map((tenant) => ({
                        value: tenant.tenant_domain,
                        label: (
                          <div>
                            <div style={{ fontWeight: 500 }}>{tenant.tenant_name}</div>
                            <div style={{ fontSize: 12, color: '#999' }}>{tenant.tenant_domain}</div>
                          </div>
                        ),
                        tenant,
                      }))}
                      onSearch={handleSearchTenant}
                      onSelect={(value, option) => handleSelectTenant(value, option)}
                      filterOption={false}
                      notFoundContent={searchingTenant ? t('pages.login.searching') : t('pages.login.noOrgMatch')}
                      style={{ width: '100%' }}
                    >
                      <Input
                        size="large"
                        prefix={<ApartmentOutlined />}
                        allowClear
                        placeholder={t('pages.login.tenantSearchPlaceholder')}
                        style={{ height: '40px' }}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (!value || value.trim().length === 0) {
                            setTenantSearchOptions([]);
                            setSelectedTenant(null);
                            setTenantCheckResult(null);
                          }
                        }}
                      />
                    </AutoComplete>
                  </ProFormItem>
                </Col>
                <Col span={12}>
                  <ProFormText
                    name="invite_code"
                    label={t('pages.login.inviteCodeOptional')}
                    placeholder={t('pages.login.inviteCodePlaceholder')}
                    rules={[
                      { max: 100, message: t('pages.login.inviteCodeMaxLen') },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (value && !getFieldValue('tenant_domain')) {
                            return Promise.reject(new Error(t('pages.login.inviteCodeWithTenantRequired')));
                          }
                          return Promise.resolve();
                        },
                      }),
                    ]}
                    fieldProps={{ size: 'large' }}
                    extra={
                      <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '12px' }}>{t('pages.login.inviteCodeExtra')}</div>
                    }
                  />
                </Col>
              </Row>
            </ProFormGroup>
          </ProForm>
        </div>
      )}

      {registerType === 'organization' && (
        <div style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ marginBottom: 24 }}>
            <Text type="secondary" style={{ fontSize: 14 }}>
              {t('pages.login.orgRegisterSubtitle')}
            </Text>
          </div>
          <Alert
            title={t('pages.login.registerNoticeTitle')}
            description={
              <div>
                <div style={{ marginBottom: 8 }}>• {t('pages.login.orgRegisterNotice1')}</div>
                <div style={{ marginBottom: 8 }}>• {t('pages.login.orgRegisterNotice2')}</div>
                <div>• {t('pages.login.orgRegisterNotice3')}</div>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
            closable
          />
          <ProForm<OrganizationRegisterFormData>
            onFinish={handleOrganizationRegister}
            submitter={{
              searchConfig: { submitText: t('pages.login.registerSubmit') },
              submitButtonProps: { size: 'large', type: 'primary', style: { width: '100%', height: '40px' } },
            }}
            size="large"
            grid={true}
            rowProps={{ gutter: 16 }}
            className="register-form"
          >
            <ProFormText
              name="tenant_name"
              label={t('pages.login.tenantName')}
              rules={[
                { required: true, message: t('pages.login.tenantNameRequired') },
                { min: 1, max: 100, message: t('pages.login.tenantNameLen') },
              ]}
              fieldProps={{ size: 'large', prefix: <ApartmentOutlined />, placeholder: t('pages.login.tenantNamePlaceholder') }}
              extra={
                <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '12px', color: '#999' }}>{t('pages.login.tenantNameExtra')}</div>
              }
            />
            <ProFormText
              name="phone"
              label={t('pages.login.phone')}
              rules={[
                { required: true, message: t('pages.login.phoneRequired') },
                { pattern: /^1[3-9]\d{9}$/, message: t('pages.login.phoneInvalid') },
              ]}
              fieldProps={{ size: 'large', prefix: <MobileOutlined />, placeholder: t('pages.login.phonePlaceholder'), autoComplete: 'tel' }}
              extra={
                <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '12px', color: '#999' }}>{t('pages.login.orgPhoneExtra')}</div>
              }
            />
            <ProFormText.Password
              name="password"
              label={t('pages.login.password')}
              rules={[
                { required: true, message: t('pages.login.passwordRequired') },
                { min: 8, message: t('pages.login.passwordLen') },
                { max: 128, message: t('pages.login.passwordLenMax') },
              ]}
              fieldProps={{ size: 'large', prefix: <LockOutlined />, placeholder: t('pages.login.passwordPlaceholderLong'), autoComplete: 'new-password' }}
              extra={
                <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '12px', color: '#999' }}>{t('pages.login.orgPasswordExtra')}</div>
              }
            />
            <ProFormText.Password
              name="confirm_password"
              label={t('pages.login.confirmPassword')}
              rules={[
                { required: true, message: t('pages.login.confirmPasswordRequired') },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) return Promise.resolve();
                    return Promise.reject(new Error(t('pages.login.confirmPasswordMismatch')));
                  },
                }),
              ]}
              fieldProps={{ size: 'large', prefix: <LockOutlined />, placeholder: t('pages.login.confirmPasswordPlaceholder'), autoComplete: 'new-password' }}
            />
          </ProForm>
        </div>
      )}
    </Drawer>
  );
}
