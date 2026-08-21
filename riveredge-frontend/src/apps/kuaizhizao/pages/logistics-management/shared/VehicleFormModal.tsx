import React, { useEffect, useRef, useState } from 'react';
import { App } from 'antd';
import { ProFormDigit, ProFormSelect, ProFormSwitch, ProFormText, type ProFormInstance } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { createVehicle, updateVehicle, type Vehicle } from '../../../services/logistics';

export type VehicleFormModalProps = {
  open: boolean;
  editing?: Vehicle | null;
  onClose: () => void;
  onSuccess: (record: Vehicle) => void;
  zIndex?: number;
};

export const VehicleFormModal: React.FC<VehicleFormModalProps> = ({
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
    formRef.current?.setFieldsValue({ ownership: 'internal', status: 'idle', is_enabled: true });
  }, [open, editing]);

  const handleFinish = async (values: Partial<Vehicle>) => {
    setSubmitting(true);
    try {
      const record = editing
        ? await updateVehicle(editing.id, values)
        : await createVehicle(values);
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
          ? t('app.kuaizhizao.logistics.action.editVehicle')
          : t('app.kuaizhizao.logistics.action.createVehicle')
      }
      open={open}
      onClose={onClose}
      onFinish={handleFinish}
      isEdit={isEdit}
      loading={submitting}
      width={MODAL_CONFIG.SMALL_WIDTH}
      layout="vertical"
      formRef={formRef as React.RefObject<ProFormInstance>}
      initialValues={editing ?? { ownership: 'internal', status: 'idle', is_enabled: true }}
      zIndex={zIndex}
    >
      <ProFormText
        name="plate_number"
        label={t('app.kuaizhizao.logistics.field.plateNumber')}
        rules={[{ required: true }]}
      />
      <ProFormSelect
        name="vehicle_type"
        label={t('app.kuaizhizao.logistics.field.vehicleType')}
        allowClear
        options={[
          { value: 'van', label: t('app.kuaizhizao.logistics.option.vehicleType.van') },
          { value: 'flatbed', label: t('app.kuaizhizao.logistics.option.vehicleType.flatbed') },
          { value: 'refrigerated', label: t('app.kuaizhizao.logistics.option.vehicleType.refrigerated') },
          { value: 'trailer', label: t('app.kuaizhizao.logistics.option.vehicleType.trailer') },
          { value: 'other', label: t('app.kuaizhizao.logistics.option.vehicleType.other') },
        ]}
      />
      <ProFormSelect
        name="ownership"
        label={t('app.kuaizhizao.logistics.field.ownership')}
        options={[
          { label: t('app.kuaizhizao.logistics.option.ownership.internal'), value: 'internal' },
          { label: t('app.kuaizhizao.logistics.option.ownership.external'), value: 'external' },
        ]}
      />
      <ProFormDigit
        name="load_capacity"
        label={t('app.kuaizhizao.logistics.field.loadCapacity')}
        fieldProps={{ style: { width: '100%' } }}
      />
      <ProFormSelect
        name="status"
        label={t('common.status')}
        options={[
          { label: t('app.kuaizhizao.logistics.option.vehicleStatus.idle'), value: 'idle' },
          { label: t('app.kuaizhizao.logistics.option.vehicleStatus.inTransit'), value: 'in_transit' },
          { label: t('app.kuaizhizao.logistics.option.vehicleStatus.maintenance'), value: 'maintenance' },
          { label: t('app.kuaizhizao.logistics.option.vehicleStatus.disabled'), value: 'disabled' },
        ]}
      />
      <ProFormSwitch name="is_enabled" label={t('common.enabled')} />
    </FormModalTemplate>
  );
};
