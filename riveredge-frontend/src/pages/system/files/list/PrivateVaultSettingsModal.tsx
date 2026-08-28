/**
 * 保密文件二次密码设置 / 修改
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Input } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { FormModalTemplate } from '../../../../components/layout-templates';
import {
  changePrivateVaultPassword,
  getPrivateVaultStatus,
  setPrivateVaultPassword,
} from '../../../../services/privateFileVault';

export interface PrivateVaultSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onConfigured?: () => void;
}

export default function PrivateVaultSettingsModal({
  open,
  onClose,
  onConfigured,
}: PrivateVaultSettingsModalProps) {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [configured, setConfigured] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoadingStatus(true);
    void getPrivateVaultStatus()
      .then((status) => setConfigured(status.configured))
      .catch(() => setConfigured(false))
      .finally(() => setLoadingStatus(false));
  }, [open]);

  const resetFields = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleClose = () => {
    resetFields();
    onClose();
  };

  const handleFinish = async () => {
    const next = newPassword.trim();
    const confirm = confirmPassword.trim();
    if (next.length < 4) {
      messageApi.warning(t('pages.system.files.privateVault.passwordMinLength'));
      return;
    }
    if (next !== confirm) {
      messageApi.warning(t('pages.system.files.privateVault.passwordMismatch'));
      return;
    }
    try {
      setSubmitting(true);
      if (configured) {
        await changePrivateVaultPassword(oldPassword.trim(), next);
        messageApi.success(t('pages.system.files.privateVault.changeSuccess'));
      } else {
        await setPrivateVaultPassword(next);
        messageApi.success(t('pages.system.files.privateVault.setSuccess'));
        setConfigured(true);
        onConfigured?.();
      }
      resetFields();
      onClose();
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.files.privateVault.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModalTemplate
      title={t('pages.system.files.privateVault.settingsTitle')}
      open={open}
      onOpenChange={(visible) => { if (!visible) handleClose(); }}
      onFinish={handleFinish}
      loading={submitting || loadingStatus}
      submitText={t('common.save')}
      width={520}
    >
      <p style={{ marginBottom: 16, color: 'var(--ant-color-text-secondary)' }}>
        {t('pages.system.files.privateVault.settingsHint')}
      </p>
      {configured ? (
        <Input.Password
          style={{ marginBottom: 12 }}
          prefix={<LockOutlined />}
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          placeholder={t('pages.system.files.privateVault.oldPasswordPlaceholder')}
        />
      ) : null}
      <Input.Password
        style={{ marginBottom: 12 }}
        prefix={<LockOutlined />}
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder={
          configured
            ? t('pages.system.files.privateVault.newPasswordPlaceholder')
            : t('pages.system.files.privateVault.passwordPlaceholder')
        }
      />
      <Input.Password
        prefix={<LockOutlined />}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder={t('pages.system.files.privateVault.confirmPasswordPlaceholder')}
        onPressEnter={() => void handleFinish()}
      />
    </FormModalTemplate>
  );
}
