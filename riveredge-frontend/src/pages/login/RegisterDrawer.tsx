/**
 * 登录页注册弹窗 - 按需懒加载
 *
 * 顶部分段；个人/组织单屏切换 + 轻量淡入；布局为左插画+说明 / 右表单或镜像（row-reverse）
 */

import { ProForm, ProFormText, ProFormGroup, ProFormItem } from '@ant-design/pro-components';
import { Typography, Button, Space, Col, Modal, AutoComplete, Input, Segmented } from 'antd';
import { UserOutlined, LockOutlined, ApartmentOutlined, MobileOutlined, CheckCircleFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import type { TenantCheckResponse, TenantSearchOption } from '../../services/register';
import { isReservedUsername } from '../../utils/reservedUsername';

const { Text, Title, Paragraph } = Typography;

export interface PersonalRegisterFormData {
  username: string;
  phone: string;
  password: string;
  confirm_password: string;
  full_name?: string;
  tenant_domain?: string;
}

export interface OrganizationRegisterFormData {
  tenant_name: string;
  full_name: string;
  phone: string;
  password: string;
  confirm_password: string;
  tenant_domain?: string;
}

export interface RegisterDrawerProps {
  open: boolean;
  onClose: () => void;
  registerType: 'personal' | 'organization';
  setRegisterType: (t: 'personal' | 'organization') => void;
  themeColor: string;
  token: { colorBorder: string; borderRadiusLG: number };
  handlePersonalRegister: (values: PersonalRegisterFormData) => Promise<void>;
  handleOrganizationRegister: (values: OrganizationRegisterFormData) => Promise<void>;
  tenantCheckResult: TenantCheckResponse | null;
  tenantSearchOptions: TenantSearchOption[];
  selectedTenant: TenantSearchOption | null;
  searchingTenant: boolean;
  handleSearchTenant: (keyword: string) => Promise<void>;
  handleSelectTenant: (value: string, option: TenantSearchOption) => void;
  setTenantSearchOptions: (options: TenantSearchOption[]) => void;
  setSelectedTenant: (t: TenantSearchOption | null) => void;
  setTenantCheckResult: (r: TenantCheckResponse | null) => void;
}

type RegisterModalAsideProps = {
  variant: 'personal' | 'organization';
  t: (k: string) => string;
};

/** 侧栏：插画 + 注册说明 */
function RegisterModalAside({ variant, t }: RegisterModalAsideProps) {
  const illustrationSrc = variant === 'personal' ? '/img/person.png' : '/img/org.png';
  const illustrationAlt = variant === 'personal' ? t('pages.login.personalRegister') : t('pages.login.orgRegister');

  const bullets = variant === 'personal' 
    ? [t('pages.login.registerNoticeBullet1'), t('pages.login.registerNoticeBullet2'), t('pages.login.registerNoticeBullet3')]
    : [t('pages.login.orgRegisterNotice1'), t('pages.login.orgRegisterNotice2'), t('pages.login.orgRegisterNotice3')];

  return (
    <div className="register-modal-aside">
      <div className="register-modal-illustration-slot">
        <motion.img
          key={variant}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          src={illustrationSrc}
          alt={illustrationAlt}
          className="register-modal-illustration-img"
        />
      </div>
      <div className="register-modal-aside-text">
        <Title level={4} style={{ marginBottom: 12 }}>
          {variant === 'personal' ? t('pages.login.personalRegister') : t('pages.login.orgRegister')}
        </Title>
        <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
          {variant === 'personal' ? t('pages.login.fillInfoHint') : t('pages.login.orgRegisterSubtitle')}
        </Paragraph>
        <div className="register-modal-bullets">
          {bullets.map((bullet, index) => (
            <motion.div
              key={`${variant}-bullet-${index}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="register-bullet-item"
            >
              <CheckCircleFilled className="bullet-icon" />
              <Text type="secondary" style={{ fontSize: 12 }}>{bullet}</Text>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RegisterDrawer({
  open,
  onClose,
  registerType,
  setRegisterType,
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
}: RegisterDrawerProps) {
  const { t } = useTranslation();

  return (
    <Modal
      className="register-modal"
      title={null}
      open={open}
      onCancel={onClose}
      width="min(1080px, calc(100vw - 32px))"
      centered
      maskClosable
      closable={false}
      destroyOnHidden={false}
      footer={null}
      styles={{
        body: { padding: 32 },
      }}
    >
      <div className="register-modal-inner">
        <Segmented
          block
          size="large"
          value={registerType}
          onChange={(v) => setRegisterType(v as 'personal' | 'organization')}
          options={[
            { label: t('pages.login.personalRegister'), value: 'personal' },
            { label: t('pages.login.orgRegister'), value: 'organization' },
          ]}
          style={{ marginBottom: 24, borderRadius: 8, padding: 4 }}
        />

        <div className="register-modal-form-shell">
          <AnimatePresence mode="wait">
            <motion.div
              key={registerType}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={`register-modal-row register-modal-row--${registerType}`}
            >
              <RegisterModalAside variant={registerType} t={t} />
              
              <div className="register-modal-main">
                {registerType === 'personal' ? (
                  <ProForm<PersonalRegisterFormData>
                    onFinish={handlePersonalRegister}
                    submitter={{
                      searchConfig: { submitText: t('pages.login.registerSubmit') },
                      resetButtonProps: { size: 'large', style: { borderRadius: 8 } },
                      submitButtonProps: {
                        size: 'large',
                        type: 'primary',
                        className: 'register-form-submit-btn',
                        style: { flex: 1, minWidth: 0, height: 44, borderRadius: 8 },
                      },
                      render: (_props, dom) => <div className="register-form-submitter-row">{dom}</div>,
                    }}
                    size="large"
                    grid={true}
                    rowProps={{ gutter: 20 }}
                    className="register-form register-form--personal"
                  >
                    <ProFormGroup title={t('pages.login.joinOrgOptional')}>
                      <Col span={24}>
                        <ProFormItem
                          name="tenant_domain"
                          extra={
                            <div className="form-item-extra">
                              {t('pages.login.joinOrgExtra')}
                              {tenantCheckResult?.exists && selectedTenant && (
                                <div className="tenant-status success">
                                  <Text type="success">{t('pages.login.selectedTenant', { name: selectedTenant.tenant_name })}</Text>
                                </div>
                              )}
                              {tenantSearchOptions.length > 0 && !selectedTenant && (
                                <div className="tenant-status warning">
                                  <Text type="warning">{t('pages.login.foundTenants', { count: tenantSearchOptions.length })}</Text>
                                </div>
                              )}
                              {tenantSearchOptions.length === 0 && !searchingTenant && selectedTenant === null && tenantCheckResult && !tenantCheckResult.exists && (
                                <div className="tenant-status error">
                                  <Space>
                                    <Text type="danger">{t('pages.login.noTenantFound')}</Text>
                                    <Button type="link" size="small" onClick={() => setRegisterType('organization')}>
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
                              label: <div style={{ fontWeight: 500 }}>{tenant.tenant_name}</div>,
                              tenant,
                            }))}
                            onSearch={handleSearchTenant}
                            onSelect={(value, option) =>
                              handleSelectTenant(value, (option as { tenant: TenantSearchOption }).tenant)
                            }
                            filterOption={false}
                            notFoundContent={searchingTenant ? t('pages.login.searching') : t('pages.login.noOrgMatch')}
                          >
                            <Input
                              size="large"
                              prefix={<ApartmentOutlined />}
                              allowClear
                              placeholder={t('pages.login.tenantSearchPlaceholder')}
                              style={{ height: 44, borderRadius: 8 }}
                              onChange={(e) => {
                                if (!e.target.value?.trim()) {
                                  setTenantSearchOptions([]);
                                  setSelectedTenant(null);
                                  setTenantCheckResult(null);
                                }
                              }}
                            />
                          </AutoComplete>
                        </ProFormItem>
                      </Col>
                    </ProFormGroup>
                    <ProFormGroup title={t('pages.login.registerAccountGroup')}>
                      <ProFormText
                        name="username"
                        label={t('pages.login.username')}
                        colProps={{ span: 12 }}
                        rules={[
                          { required: true, message: t('pages.login.usernameRequired') },
                          { min: 3, max: 50, message: t('pages.login.usernameLen') },
                          { pattern: /^[a-zA-Z0-9_-]+$/, message: t('pages.login.usernamePattern') },
                          {
                            validator: async (_, value) => {
                              if (!value || !isReservedUsername(String(value))) return;
                              throw new Error(t('pages.login.usernameReserved'));
                            },
                          },
                        ]}
                        fieldProps={{ size: 'large', prefix: <UserOutlined />, placeholder: t('pages.login.usernamePlaceholderLong'), autoComplete: 'username', style: { height: 44, borderRadius: 8 } }}
                        extra={<div className="form-item-extra">{t('pages.login.usernameExtra')}</div>}
                      />
                      <ProFormText
                        name="phone"
                        label={t('pages.login.phone')}
                        colProps={{ span: 12 }}
                        rules={[
                          { required: true, message: t('pages.login.phoneRequired') },
                          { pattern: /^1[3-9]\d{9}$/, message: t('pages.login.phoneInvalid') },
                        ]}
                        fieldProps={{ size: 'large', prefix: <MobileOutlined />, placeholder: t('pages.login.phonePlaceholder'), autoComplete: 'tel', maxLength: 11, style: { height: 44, borderRadius: 8 } }}
                        extra={<div className="form-item-extra">{t('pages.login.phoneExtra')}</div>}
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
                        fieldProps={{ size: 'large', prefix: <LockOutlined />, placeholder: t('pages.login.passwordPlaceholderLong'), autoComplete: 'new-password', style: { height: 44, borderRadius: 8 } }}
                        extra={<div className="form-item-extra">{t('pages.login.passwordExtra')}</div>}
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
                        fieldProps={{ size: 'large', prefix: <LockOutlined />, placeholder: t('pages.login.confirmPasswordPlaceholder'), autoComplete: 'new-password', style: { height: 44, borderRadius: 8 } }}
                      />
                    </ProFormGroup>
                  </ProForm>
                ) : (
                  <ProForm<OrganizationRegisterFormData>
                    onFinish={handleOrganizationRegister}
                    submitter={{
                      searchConfig: { submitText: t('pages.login.registerSubmit') },
                      resetButtonProps: { size: 'large', style: { borderRadius: 8 } },
                      submitButtonProps: {
                        size: 'large',
                        type: 'primary',
                        className: 'register-form-submit-btn',
                        style: { flex: 1, minWidth: 0, height: 44, borderRadius: 8 },
                      },
                      render: (_props, dom) => <div className="register-form-submitter-row">{dom}</div>,
                    }}
                    size="large"
                    grid={true}
                    rowProps={{ gutter: 20 }}
                    className="register-form register-form--organization"
                  >
                    <ProFormGroup title={t('pages.login.tenantName')}>
                      <ProFormText
                        name="tenant_name"
                        colProps={{ span: 24 }}
                        rules={[
                          { required: true, message: t('pages.login.tenantNameRequired') },
                          { min: 1, max: 100, message: t('pages.login.tenantNameLen') },
                        ]}
                        fieldProps={{ size: 'large', prefix: <ApartmentOutlined />, placeholder: t('pages.login.tenantNamePlaceholder'), style: { height: 44, borderRadius: 8 } }}
                        extra={<div className="form-item-extra">{t('pages.login.tenantNameExtra')}</div>}
                      />
                    </ProFormGroup>
                    <ProFormGroup title={t('pages.login.registerAccountGroup')}>
                      <ProFormText
                        name="full_name"
                        label={t('pages.login.orgAdminName')}
                        colProps={{ span: 12 }}
                        rules={[
                          { required: true, message: t('pages.login.orgAdminNameRequired') },
                          { min: 1, max: 100, message: t('pages.login.orgAdminNameLen') },
                        ]}
                        fieldProps={{ size: 'large', prefix: <UserOutlined />, placeholder: t('pages.login.orgAdminNamePlaceholder'), style: { height: 44, borderRadius: 8 } }}
                        extra={<div className="form-item-extra">{t('pages.login.orgAdminNameExtra')}</div>}
                      />
                      <ProFormText
                        name="phone"
                        label={t('pages.login.phone')}
                        colProps={{ span: 12 }}
                        rules={[
                          { required: true, message: t('pages.login.phoneRequired') },
                          { pattern: /^1[3-9]\d{9}$/, message: t('pages.login.phoneInvalid') },
                        ]}
                        fieldProps={{ size: 'large', prefix: <MobileOutlined />, placeholder: t('pages.login.phonePlaceholder'), autoComplete: 'tel', style: { height: 44, borderRadius: 8 } }}
                        extra={<div className="form-item-extra">{t('pages.login.phoneExtra')}</div>}
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
                        fieldProps={{ size: 'large', prefix: <LockOutlined />, placeholder: t('pages.login.passwordPlaceholderLong'), autoComplete: 'new-password', style: { height: 44, borderRadius: 8 } }}
                        extra={<div className="form-item-extra">{t('pages.login.passwordExtra')}</div>}
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
                        fieldProps={{ size: 'large', prefix: <LockOutlined />, placeholder: t('pages.login.confirmPasswordPlaceholder'), autoComplete: 'new-password', style: { height: 44, borderRadius: 8 } }}
                      />
                    </ProFormGroup>
                  </ProForm>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div
          style={{
            textAlign: 'center',
            marginTop: 24,
            paddingTop: 16,
            borderTop: `1px solid ${token.colorBorder}`,
          }}
        >
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('pages.login.hasAccount')}
            <Button type="link" style={{ padding: 0, fontSize: 13, height: 'auto', marginLeft: 6, textDecoration: 'underline', textUnderlineOffset: '3px' }} onClick={onClose}>
              {t('pages.login.loginNow')}
            </Button>
          </Text>
        </div>
      </div>
    </Modal>
  );
}
