import React, { useEffect } from 'react';
import { Form, Input, InputNumber, Modal, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ServiceAsset, ServiceAssetPayload } from '../../../services/after-sales-service';

const STATUS_OPTIONS = ['在用', '停用', '报废'];

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
  const [form] = Form.useForm<ServiceAssetPayload>();

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
    const values = await form.validateFields();
    await onSubmit(values);
    onClose();
  };

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
      destroyOnClose
      width={720}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="customer_id"
          label={t('app.kuaizhizao.afterSalesService.serviceAsset.field.customerId')}
          rules={[{ required: true }]}
          hidden
        >
          <InputNumber />
        </Form.Item>
        <Form.Item
          name="customer_name"
          label={t('app.kuaizhizao.afterSalesService.serviceAsset.field.customerName')}
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="material_code" label={t('app.kuaizhizao.afterSalesService.serviceAsset.field.materialCode')}>
          <Input />
        </Form.Item>
        <Form.Item name="material_name" label={t('app.kuaizhizao.afterSalesService.serviceAsset.field.materialName')}>
          <Input />
        </Form.Item>
        <Form.Item name="material_spec" label={t('app.kuaizhizao.afterSalesService.serviceAsset.field.materialSpec')}>
          <Input />
        </Form.Item>
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
        <Form.Item name="status" label={t('app.kuaizhizao.afterSalesService.serviceAsset.field.status')}>
          <Select options={STATUS_OPTIONS.map((value) => ({ value, label: value }))} />
        </Form.Item>
        <Form.Item name="notes" label={t('app.kuaizhizao.afterSalesService.serviceAsset.field.notes')}>
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ServiceAssetFormModal;
