/**
 * 总入口登录：同名同密跨租户且手机号不一致时，核验手机号后四位。
 */
import { Modal, Input, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface PhoneVerificationModalProps {
  open: boolean;
  loading?: boolean;
  onSubmit: (phoneLast4: string) => void | Promise<void>;
  onCancel: () => void;
}

export default function PhoneVerificationModal({
  open,
  loading = false,
  onSubmit,
  onCancel,
}: PhoneVerificationModalProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!open) {
      setValue('');
    }
  }, [open]);

  const handleOk = async () => {
    const digits = value.replace(/\D/g, '').slice(-4);
    if (digits.length !== 4) {
      return;
    }
    await onSubmit(digits);
  };

  return (
    <Modal
      open={open}
      title={t('components.phoneVerification.title')}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      okButtonProps={{ disabled: value.replace(/\D/g, '').length !== 4 }}
      destroyOnHidden
      mask={{ closable: false }}
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        {t('components.phoneVerification.hint')}
      </Typography.Paragraph>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
        placeholder={t('components.phoneVerification.placeholder')}
        maxLength={4}
        inputMode="numeric"
        autoComplete="one-time-code"
        onPressEnter={handleOk}
      />
    </Modal>
  );
}
