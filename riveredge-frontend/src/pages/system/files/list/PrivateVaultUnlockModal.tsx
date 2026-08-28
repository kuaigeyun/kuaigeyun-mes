/**
 * 保密文件解锁弹窗
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Input } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { FormModalTemplate } from '../../../../components/layout-templates';
import { unlockPrivateVault } from '../../../../services/privateFileVault';

export interface PrivateVaultUnlockModalProps {
  open: boolean;
  configured: boolean;
  onClose: () => void;
  onUnlocked: () => void;
  onOpenSettings: () => void;
}

export default function PrivateVaultUnlockModal({
  open,
  configured,
  onClose,
  onUnlocked,
  onOpenSettings,
}: PrivateVaultUnlockModalProps) {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setPassword('');
    onClose();
  };

  const handleFinish = async () => {
    if (!configured) {
      onOpenSettings();
      return;
    }
    const pwd = password.trim();
    if (!pwd) {
      messageApi.warning(t('pages.system.files.privateVault.enterPassword'));
      return;
    }
    try {
      setSubmitting(true);
      await unlockPrivateVault(pwd);
      messageApi.success(t('pages.system.files.privateVault.unlockSuccess'));
      setPassword('');
      onUnlocked();
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.files.privateVault.unlockFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModalTemplate
      title={t('pages.system.files.privateVault.unlockTitle')}
      open={open}
      onOpenChange={(visible) => { if (!visible) handleClose(); }}
      onFinish={handleFinish}
      loading={submitting}
      submitText={configured ? t('pages.system.files.privateVault.unlockButton') : t('pages.system.files.privateVault.setupButton')}
      width={480}
    >
      {!configured ? (
        <p style={{ marginBottom: 16 }}>{t('pages.system.files.privateVault.notConfiguredHint')}</p>
      ) : (
        <>
          <p style={{ marginBottom: 12, color: 'var(--ant-color-text-secondary)' }}>
            {t('pages.system.files.privateVault.unlockHint')}
          </p>
          <Input.Password
            prefix={<LockOutlined />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('pages.system.files.privateVault.passwordPlaceholder')}
            autoFocus
            onPressEnter={() => void handleFinish()}
          />
        </>
      )}
    </FormModalTemplate>
  );
}
