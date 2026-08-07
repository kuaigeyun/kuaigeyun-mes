import React, { useEffect } from 'react';
import { DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import type { ServiceDispatchOrder, ServiceDispatchPayload } from '../../../services/after-sales-service';
import { formDateFormItemProps } from '../../../../../utils/formDate';

const SOURCE_TYPES = [
  { value: 'install_execution', labelKey: 'installExecution' },
  { value: 'repair_order', labelKey: 'repairOrder' },
];

export type DispatchOrderFormModalProps = {
  open: boolean;
  editing: ServiceDispatchOrder | null;
  onClose: () => void;
  onSubmit: (payload: ServiceDispatchPayload) => Promise<void>;
};

const DispatchOrderFormModal: React.FC<DispatchOrderFormModalProps> = ({
  open,
  editing,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<
    ServiceDispatchPayload & { planned_start_at_picker?: dayjs.Dayjs; planned_end_at_picker?: dayjs.Dayjs }
  >();

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue({
        ...editing,
        planned_start_at_picker: editing.planned_start_at ? dayjs(editing.planned_start_at) : undefined,
        planned_end_at_picker: editing.planned_end_at ? dayjs(editing.planned_end_at) : undefined,
      });
    } else {
      form.resetFields();
    }
  }, [editing, form, open]);

  const handleOk = async () => {
    const values = await form.validateFields();
    const { planned_start_at_picker, planned_end_at_picker, ...rest } = values;
    await onSubmit({
      ...rest,
      planned_start_at: planned_start_at_picker?.format('YYYY-MM-DD HH:mm:ss'),
      planned_end_at: planned_end_at_picker?.format('YYYY-MM-DD HH:mm:ss'),
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      title={
        editing
          ? t('app.kuaizhizao.afterSalesService.dispatchOrder.editTitle')
          : t('app.kuaizhizao.afterSalesService.dispatchOrder.createTitle')
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
          label={t('app.kuaizhizao.afterSalesService.dispatchOrder.field.customerName')}
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="source_type"
          label={t('app.kuaizhizao.afterSalesService.dispatchOrder.field.sourceType')}
          rules={[{ required: true }]}
        >
          <Select
            options={SOURCE_TYPES.map((item) => ({
              value: item.value,
              label: t(`app.kuaizhizao.afterSalesService.dispatchOrder.sourceType.${item.labelKey}`),
            }))}
          />
        </Form.Item>
        <Form.Item
          name="source_id"
          label={t('app.kuaizhizao.afterSalesService.dispatchOrder.field.sourceId')}
          rules={[{ required: true }]}
        >
          <InputNumber style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="source_code"
          label={t('app.kuaizhizao.afterSalesService.dispatchOrder.field.sourceCode')}
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="engineer_name" label={t('app.kuaizhizao.afterSalesService.dispatchOrder.field.engineerName')}>
          <Input />
        </Form.Item>
        <Form.Item name="site_address" label={t('app.kuaizhizao.afterSalesService.dispatchOrder.field.siteAddress')}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="planned_start_at_picker" label={t('app.kuaizhizao.afterSalesService.dispatchOrder.field.plannedStartAt')} {...formDateFormItemProps}>
          <DatePicker showTime style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="planned_end_at_picker" label={t('app.kuaizhizao.afterSalesService.dispatchOrder.field.plannedEndAt')} {...formDateFormItemProps}>
          <DatePicker showTime style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="notes" label={t('app.kuaizhizao.afterSalesService.dispatchOrder.field.notes')}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default DispatchOrderFormModal;
