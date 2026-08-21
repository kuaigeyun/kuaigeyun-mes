import React, { useEffect, useRef, useState } from 'react';
import { App } from 'antd';
import { ProFormSelect, ProFormSwitch, ProFormText, type ProFormInstance } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { createDriver, updateDriver, type Driver } from '../../../services/logistics';

export type DriverFormModalProps = {
  open: boolean;
  editing?: Driver | null;
  onClose: () => void;
  onSuccess: (record: Driver) => void;
  zIndex?: number;
};

export const DriverFormModal: React.FC<DriverFormModalProps> = ({
  open,
  editing,
  onClose,
  onSuccess,
  zIndex,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(editing?.id);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      formRef.current?.setFieldsValue(editing);
      return;
    }
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ ownership: 'internal', is_enabled: true });
  }, [open, editing]);

  const handleFinish = async (values: Partial<Driver>) => {
    setSubmitting(true);
    try {
      const record = editing
        ? await updateDriver(editing.id, values)
        : await createDriver(values);
      messageApi.success(editing ? t('common.updateSuccess') : t('common.createSuccess'));
      onSuccess(record);
      onClose();
    } catch (error) {
      messageApi.error(
        getApiErrorMessage(error, editing ? t('common.updateFailed') : t('common.createFailed')),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModalTemplate
      title={
        isEdit
          ? t('app.kuaizhizao.logistics.action.editDriver')
          : t('app.kuaizhizao.logistics.action.createDriver')
      }
      open={open}
      onClose={onClose}
      onFinish={handleFinish}
      isEdit={isEdit}
      loading={submitting}
      width={MODAL_CONFIG.SMALL_WIDTH}
      layout="vertical"
      formRef={formRef as React.RefObject<ProFormInstance>}
      initialValues={editing ?? { ownership: 'internal', is_enabled: true }}
      zIndex={zIndex}
    >
      {!isEdit ? (
        <ProFormText
          name="code"
          label={t('common.code')}
          placeholder={t('app.kuaizhizao.logistics.placeholder.autoCode')}
        />
      ) : null}
      <ProFormText
        name="name"
        label={t('app.kuaizhizao.logistics.field.driverName')}
        rules={[{ required: true }]}
      />
      <ProFormText name="phone" label={t('app.kuaizhizao.logistics.field.phone')} />
      <ProFormText name="license_number" label={t('app.kuaizhizao.logistics.field.licenseNumber')} />
      <ProFormSelect
        name="ownership"
        label={t('app.kuaizhizao.logistics.field.ownership')}
        options={[
          { label: t('app.kuaizhizao.logistics.option.ownership.internal'), value: 'internal' },
          { label: t('app.kuaizhizao.logistics.option.ownership.external'), value: 'external' },
        ]}
      />
      <ProFormSwitch name="is_enabled" label={t('common.enabled')} />
    </FormModalTemplate>
  );
};
