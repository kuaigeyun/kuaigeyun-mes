import React, { useEffect, useState } from 'react';
import { App, DatePicker, Form, Input, Modal, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { CustomerSelectDropdown } from '../../../../master-data/components/CustomerSelectDropdown';
import type { Customer } from '../../../../master-data/types/supply-chain';
import type { RepairOrder, RepairOrderPayload } from '../../../services/after-sales-service';
import { formDateFormItemProps } from '../../../../../utils/formDate';
import { formatApiErrorDetail } from '../../../../../services/api';

const REPAIR_MODES = ['现场', '返厂'];
const WARRANTY_STATUSES = ['保内', '保外', '待判定'];

function customerDisplayName(c: Customer | null | undefined): string {
  if (!c) return '';
  const row = c as Record<string, unknown>;
  return String(row.name ?? row.customer_name ?? '').trim();
}

export type RepairOrderFormModalProps = {
  open: boolean;
  editing: RepairOrder | null;
  onClose: () => void;
  onSubmit: (payload: RepairOrderPayload) => Promise<void>;
};

const RepairOrderFormModal: React.FC<RepairOrderFormModalProps> = ({
  open,
  editing,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm<RepairOrderPayload & { reported_at_picker?: dayjs.Dayjs }>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue({
        ...editing,
        reported_at_picker: editing.reported_at ? dayjs(editing.reported_at) : undefined,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        repair_mode: '现场',
        warranty_status: '待判定',
        reported_at_picker: dayjs(),
      });
    }
  }, [editing, form, open]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const { reported_at_picker, ...rest } = values;
      setSubmitting(true);
      await onSubmit({
        ...rest,
        reported_at: reported_at_picker?.format('YYYY-MM-DD HH:mm:ss') ?? '',
      });
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

  return (
    <Modal
      open={open}
      title={
        editing
          ? t('app.kuaizhizao.afterSalesService.repairOrder.editTitle')
          : t('app.kuaizhizao.afterSalesService.repairOrder.createTitle')
      }
      onCancel={onClose}
      onOk={() => void handleOk()}
      confirmLoading={submitting}
      destroyOnClose
      width={760}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="customer_name" hidden>
          <Input />
        </Form.Item>
        <Form.Item
          name="customer_id"
          label={t('app.kuaizhizao.afterSalesService.repairOrder.field.customerName')}
          rules={[{ required: true, message: t('app.kuaizhizao.afterSalesTicket.selectCustomerFirst') }]}
        >
          <CustomerSelectDropdown
            hostResource="kuaizhizao:repair-order"
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
        <Form.Item name="repair_mode" label={t('app.kuaizhizao.afterSalesService.repairOrder.field.repairMode')}>
          <Select options={REPAIR_MODES.map((value) => ({ value, label: value }))} />
        </Form.Item>
        <Form.Item name="warranty_status" label={t('app.kuaizhizao.afterSalesService.repairOrder.field.warrantyStatus')}>
          <Select options={WARRANTY_STATUSES.map((value) => ({ value, label: value }))} />
        </Form.Item>
        <Form.Item
          name="fault_description"
          label={t('app.kuaizhizao.afterSalesService.repairOrder.field.faultDescription')}
          rules={[{ required: true, message: t('common.required') }]}
        >
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="site_address" label={t('app.kuaizhizao.afterSalesService.repairOrder.field.siteAddress')}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item
          name="reported_at_picker"
          label={t('app.kuaizhizao.afterSalesService.repairOrder.field.reportedAt')}
          rules={[{ required: true, message: t('common.required') }]}
          {...formDateFormItemProps}
        >
          <DatePicker showTime style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="notes" label={t('app.kuaizhizao.afterSalesService.repairOrder.field.notes')}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RepairOrderFormModal;
