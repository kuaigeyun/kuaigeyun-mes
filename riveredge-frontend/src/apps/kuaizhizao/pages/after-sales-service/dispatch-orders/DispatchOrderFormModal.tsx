import React, { useEffect, useState } from 'react';
import { App, DatePicker, Form, Input, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { CustomerSelectDropdown } from '../../../../master-data/components/CustomerSelectDropdown';
import type { Customer } from '../../../../master-data/types/supply-chain';
import { UniUserSelect } from '../../../../../components/uni-user-select';
import { resolveUserUuidById } from '../../../components/EquipmentPersonSelect';
import {
  serviceDispatchApi,
  type ServiceDispatchOrder,
  type ServiceDispatchPayload,
} from '../../../services/after-sales-service';
import { formDateFormItemProps } from '../../../../../utils/formDate';
import { formatApiErrorDetail } from '../../../../../services/api';
import { AfterSalesSourceDocumentSelect } from '../shared/AfterSalesSourceDocumentSelect';

function customerDisplayName(c: Customer | null | undefined): string {
  if (!c) return '';
  const row = c as Record<string, unknown>;
  return String(row.name ?? row.customer_name ?? '').trim();
}

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
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm<
    ServiceDispatchPayload & {
      planned_start_at_picker?: dayjs.Dayjs;
      planned_end_at_picker?: dayjs.Dayjs;
      engineer_uuid?: string;
    }
  >();
  const [submitting, setSubmitting] = useState(false);
  const customerId = Form.useWatch('customer_id', form);
  const sourceType = Form.useWatch('source_type', form) as string | undefined;
  const [blockedSources, setBlockedSources] = useState<Record<number, { disabled: boolean; reason: string }>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const apply = async () => {
      if (editing) {
        const engineerUuid = await resolveUserUuidById(editing.engineer_id);
        if (cancelled) return;
        form.setFieldsValue({
          ...editing,
          engineer_uuid: engineerUuid,
          planned_start_at_picker: editing.planned_start_at ? dayjs(editing.planned_start_at) : undefined,
          planned_end_at_picker: editing.planned_end_at ? dayjs(editing.planned_end_at) : undefined,
        });
      } else {
        form.resetFields();
      }
    };
    void apply();
    return () => {
      cancelled = true;
    };
  }, [editing, form, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void serviceDispatchApi
      .list({ skip: 0, limit: 200 })
      .then((res) => {
        if (cancelled) return;
        const blocked: Record<number, { disabled: boolean; reason: string }> = {};
        for (const row of res.items ?? []) {
          if (String(row.status ?? '').trim() === '已取消') continue;
          if (sourceType && row.source_type !== sourceType) continue;
          if (editing?.id && row.id === editing.id) continue;
          blocked[row.source_id] = {
            disabled: true,
            reason: t('app.kuaizhizao.afterSalesService.dispatchOrder.sourceAlreadyDispatched', {
              code: row.dispatch_code,
            }),
          };
        }
        setBlockedSources(blocked);
      })
      .catch(() => {
        if (!cancelled) setBlockedSources({});
      });
    return () => {
      cancelled = true;
    };
  }, [editing?.id, open, sourceType, t]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const { planned_start_at_picker, planned_end_at_picker, engineer_uuid: _uuid, ...rest } = values;
      setSubmitting(true);
      await onSubmit({
        ...rest,
        planned_start_at: planned_start_at_picker?.format('YYYY-MM-DD HH:mm:ss'),
        planned_end_at: planned_end_at_picker?.format('YYYY-MM-DD HH:mm:ss'),
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
          ? t('app.kuaizhizao.afterSalesService.dispatchOrder.editTitle')
          : t('app.kuaizhizao.afterSalesService.dispatchOrder.createTitle')
      }
      onCancel={onClose}
      onOk={() => void handleOk()}
      confirmLoading={submitting}
      destroyOnHidden
      width={760}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="customer_name" hidden>
          <Input />
        </Form.Item>
        <Form.Item
          name="customer_id"
          label={t('app.kuaizhizao.afterSalesService.dispatchOrder.field.customerName')}
          rules={[{ required: true, message: t('app.kuaizhizao.afterSalesTicket.selectCustomerFirst') }]}
        >
          <CustomerSelectDropdown
            hostResource="kuaizhizao:service-dispatch"
            placeholder={t('app.kuaizhizao.afterSalesTicket.selectCustomerFirst')}
            style={{ width: '100%' }}
            onCustomerPick={(c) => {
              form.setFieldsValue({
                customer_id: c?.id,
                customer_name: customerDisplayName(c),
                source_id: undefined,
                source_code: undefined,
              });
            }}
          />
        </Form.Item>
        <AfterSalesSourceDocumentSelect
          customerId={customerId}
          allowedTypes={['install_execution', 'repair_order']}
          typeLabelKeyPrefix="app.kuaizhizao.afterSalesService.dispatchOrder.field"
          optionStateById={blockedSources}
        />
        <Form.Item name="engineer_id" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="engineer_name" hidden>
          <Input />
        </Form.Item>
        <UniUserSelect
          name="engineer_uuid"
          label={t('app.kuaizhizao.afterSalesService.dispatchOrder.field.engineerName')}
          onChange={(_value, user) => {
            const picked = Array.isArray(user) ? user[0] : user;
            form.setFieldsValue({
              engineer_id: picked?.id,
              engineer_name: picked?.full_name || picked?.username,
            });
          }}
        />
        <Form.Item name="site_address" label={t('app.kuaizhizao.afterSalesService.dispatchOrder.field.siteAddress')}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item
          name="planned_start_at_picker"
          label={t('app.kuaizhizao.afterSalesService.dispatchOrder.field.plannedStartAt')}
          {...formDateFormItemProps}
        >
          <DatePicker showTime style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="planned_end_at_picker"
          label={t('app.kuaizhizao.afterSalesService.dispatchOrder.field.plannedEndAt')}
          {...formDateFormItemProps}
        >
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
