import React, { useEffect, useRef, useState } from 'react';
import { App } from 'antd';
import { ProForm, ProFormSelect, ProFormSwitch, ProFormText, ProFormTextArea, type ProFormInstance } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { SupplierSelectDropdown } from '../../../../master-data/components/SupplierSelectDropdown';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { createCarrier, updateCarrier, type LogisticsCarrier } from '../../../services/logistics';

export const LOGISTICS_SETTLEMENT_METHOD_OPTIONS: Array<{ value: string; labelKey: string }> = [
  { value: 'cash', labelKey: 'field.partner.settlementMethod.cash' },
  { value: 'bank_transfer', labelKey: 'field.partner.settlementMethod.bankTransfer' },
  { value: 'bank_acceptance', labelKey: 'field.partner.settlementMethod.bankAcceptance' },
  { value: 'commercial_acceptance', labelKey: 'field.partner.settlementMethod.commercialAcceptance' },
  { value: 'monthly', labelKey: 'field.partner.settlementMethod.monthly' },
  { value: 'prepaid', labelKey: 'field.partner.settlementMethod.prepaid' },
  { value: 'other', labelKey: 'field.partner.settlementMethod.other' },
];

export type CarrierFormModalProps = {
  open: boolean;
  editing?: LogisticsCarrier | null;
  onClose: () => void;
  onSuccess: (record: LogisticsCarrier) => void;
  zIndex?: number;
};

export const CarrierFormModal: React.FC<CarrierFormModalProps> = ({
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
    formRef.current?.setFieldsValue({ carrier_type: 'express', is_enabled: true });
  }, [open, editing]);

  const handleFinish = async (values: Partial<LogisticsCarrier>) => {
    setSubmitting(true);
    try {
      const record = editing
        ? await updateCarrier(editing.id, values)
        : await createCarrier(values);
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
          ? t('app.kuaizhizao.logistics.action.editCarrier')
          : t('app.kuaizhizao.logistics.action.createCarrier')
      }
      open={open}
      onClose={onClose}
      onFinish={handleFinish}
      isEdit={isEdit}
      loading={submitting}
      width={MODAL_CONFIG.SMALL_WIDTH}
      layout="vertical"
      formRef={formRef as React.RefObject<ProFormInstance>}
      initialValues={editing ?? { carrier_type: 'express', is_enabled: true }}
      zIndex={zIndex}
    >
      {!isEdit ? (
        <ProFormText
          name="code"
          label={t('app.kuaizhizao.logistics.field.code')}
          placeholder={t('app.kuaizhizao.logistics.placeholder.autoCode')}
        />
      ) : null}
      <ProFormText
        name="name"
        label={t('app.kuaizhizao.logistics.field.name')}
        rules={[{ required: true }]}
      />
      <ProFormSelect
        name="carrier_type"
        label={t('app.kuaizhizao.logistics.field.carrierType')}
        options={[
          { label: t('app.kuaizhizao.logistics.option.carrierType.express'), value: 'express' },
          { label: t('app.kuaizhizao.logistics.option.carrierType.truck'), value: 'truck' },
          { label: t('app.kuaizhizao.logistics.option.carrierType.ltl'), value: 'ltl' },
        ]}
      />
      <ProFormText name="contact_name" label={t('app.kuaizhizao.logistics.field.contactName')} />
      <ProFormText name="contact_phone" label={t('app.kuaizhizao.logistics.field.contactPhone')} />
      <ProFormText name="service_hotline" label={t('app.kuaizhizao.logistics.field.serviceHotline')} />
      <ProForm.Item name="supplier_id" label={t('app.kuaizhizao.logistics.field.supplier')}>
        <SupplierSelectDropdown
          hostResource="kuaizhizao:logistics-carrier"
          allowClear
          placeholder={t('app.kuaizhizao.logistics.placeholder.selectSupplier')}
          modalZIndex={zIndex}
          style={{ width: '100%' }}
        />
      </ProForm.Item>
      <ProFormSelect
        name="settlement_method"
        label={t('app.kuaizhizao.logistics.field.settlementMethod')}
        allowClear
        options={LOGISTICS_SETTLEMENT_METHOD_OPTIONS.map((item) => ({
          value: item.value,
          label: t(item.labelKey),
        }))}
      />
      <ProFormTextArea name="remark" label={t('common.remark')} fieldProps={{ rows: 2 }} />
      <ProFormSwitch name="is_enabled" label={t('app.kuaizhizao.logistics.field.enabled')} />
    </FormModalTemplate>
  );
};
