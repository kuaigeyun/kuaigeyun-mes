import React, { useEffect } from 'react';
import { DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import type { RepairOrder, RepairOrderPayload } from '../../../services/after-sales-service';
import { formDateFormItemProps } from '../../../../../utils/formDate';

const REPAIR_MODES = ['现场', '返厂'];
const WARRANTY_STATUSES = ['保内', '保外', '待判定'];

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
  const [form] = Form.useForm<RepairOrderPayload & { reported_at_picker?: dayjs.Dayjs }>();

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
    const values = await form.validateFields();
    const { reported_at_picker, ...rest } = values;
    await onSubmit({
      ...rest,
      reported_at: reported_at_picker?.format('YYYY-MM-DD HH:mm:ss') ?? '',
    });
    onClose();
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
      destroyOnClose
      width={760}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="customer_id" hidden rules={[{ required: true }]}>
          <InputNumber />
        </Form.Item>
        <Form.Item
          name="customer_name"
          label={t('app.kuaizhizao.afterSalesService.repairOrder.field.customerName')}
          rules={[{ required: true }]}
        >
          <Input />
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
          rules={[{ required: true }]}
        >
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="site_address" label={t('app.kuaizhizao.afterSalesService.repairOrder.field.siteAddress')}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item
          name="reported_at_picker"
          label={t('app.kuaizhizao.afterSalesService.repairOrder.field.reportedAt')}
          rules={[{ required: true }]}
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
