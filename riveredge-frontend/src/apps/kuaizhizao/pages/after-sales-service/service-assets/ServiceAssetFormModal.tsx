import React, { useEffect, useState } from 'react';
import { App, Form, Input, InputNumber, Modal, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { CustomerSelectDropdown } from '../../../../master-data/components/CustomerSelectDropdown';
import type { Customer } from '../../../../master-data/types/supply-chain';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import type { ServiceAsset, ServiceAssetPayload } from '../../../services/after-sales-service';
import { formatApiErrorDetail } from '../../../../../services/api';

const STATUS_OPTIONS = ['在用', '停用', '报废'];

function customerDisplayName(c: Customer | null | undefined): string {
  if (!c) return '';
  const row = c as Record<string, unknown>;
  return String(row.name ?? row.customer_name ?? '').trim();
}

export type ServiceAssetFormModalProps = {
  open: boolean;
  editing: ServiceAsset | null;
  onClose: () => void;
  onSubmit: (payload: ServiceAssetPayload) => Promise<void>;
};

const ServiceAssetFormModal: React.FC<ServiceAssetFormModalProps> = ({
  open,
  editing,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm<ServiceAssetPayload>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue(editing);
    } else {
      form.resetFields();
      form.setFieldsValue({ status: '在用' });
    }
  }, [editing, form, open]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await onSubmit(values);
      onClose();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      messageApi.error(formatApiErrorDetail(error) || t('common.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const materialFallback =
    editing?.material_id != null
      ? {
          value: editing.material_id,
          label: [editing.material_code, editing.material_name, editing.material_spec]
            .filter(Boolean)
            .join(' '),
        }
      : undefined;

  return (
    <Modal
      open={open}
      title={
        editing
          ? t('app.kuaizhizao.afterSalesService.serviceAsset.editTitle')
          : t('app.kuaizhizao.afterSalesService.serviceAsset.createTitle')
      }
      onCancel={onClose}
      onOk={() => void handleOk()}
      confirmLoading={submitting}
      destroyOnClose
      width={720}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="customer_name" hidden>
          <Input />
        </Form.Item>
        <Form.Item
          name="customer_id"
          label={t('app.kuaizhizao.afterSalesService.serviceAsset.field.customerName')}
          rules={[{ required: true, message: t('app.kuaizhizao.afterSalesTicket.selectCustomerFirst') }]}
        >
          <CustomerSelectDropdown
            hostResource="kuaizhizao:service-asset"
            placeholder={t('app.kuaizhizao.afterSalesTicket.selectCustomerFirst')}
            style={{ width: '100%' }}
            onCustomerPick={(c) => {
              form.setFieldsValue({
                customer_id: c?.id,
                customer_name: customerDisplayName(c),
              });
            }}
          />
        </Form.Item>
        <Form.Item name="material_code" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="material_name" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="material_spec" hidden>
          <Input />
        </Form.Item>
        <UniMaterialSelect
          name="material_id"
          label={t('app.kuaizhizao.afterSalesService.serviceAsset.field.materialName')}
          placeholder={t('app.kuaizhizao.afterSalesService.common.selectMaterial')}
          showAdvancedSearch
          fallbackOption={materialFallback}
          fillMapping={{
            material_code: 'mainCode',
            material_name: 'name',
            material_spec: 'specification',
          }}
        />
        <Form.Item name="serial_number" label={t('app.kuaizhizao.afterSalesService.serviceAsset.field.serialNumber')}>
          <Input />
        </Form.Item>
        <Form.Item name="install_address" label={t('app.kuaizhizao.afterSalesService.serviceAsset.field.installAddress')}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="warranty_months" label={t('app.kuaizhizao.afterSalesService.serviceAsset.field.warrantyMonths')}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="warranty_policy" label={t('app.kuaizhizao.afterSalesService.serviceAsset.field.warrantyPolicy')}>
          <Input />
        </Form.Item>
        <Form.Item name="status" label={t('common.status')}>
          <Select options={STATUS_OPTIONS.map((value) => ({ value, label: value }))} />
        </Form.Item>
        <Form.Item name="notes" label={t('common.remark')}>
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ServiceAssetFormModal;
