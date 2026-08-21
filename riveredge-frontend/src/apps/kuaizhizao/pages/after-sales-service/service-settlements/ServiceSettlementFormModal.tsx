import React, { useEffect, useMemo, useRef, useState } from 'react';
import { App, Col, Form, Input, InputNumber, Row, Select } from 'antd';
import type { ProFormInstance } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { CustomerSelectDropdown } from '../../../../master-data/components/CustomerSelectDropdown';
import type { Customer } from '../../../../master-data/types/supply-chain';
import { formatApiErrorDetail } from '../../../../../services/api';
import {
  serviceSettlementApi,
  type ServiceSettlement,
  type ServiceSettlementPayload,
} from '../../../services/after-sales-service';
import {
  loadAfterSalesSourceOptions,
  type AfterSalesSourceKind,
  type AfterSalesSourceOption,
} from '../shared/AfterSalesSourceDocumentSelect';

export type ServiceSettlementFormModalProps = {
  open: boolean;
  editing: ServiceSettlement | null;
  onClose: () => void;
  onSuccess: () => void;
};

type LineForm = {
  source_type?: AfterSalesSourceKind;
  source_id?: number;
  source_code?: string;
  warranty_status?: string;
  amount?: number;
  notes?: string;
};

function customerDisplayName(c: Customer | null | undefined): string {
  if (!c) return '';
  const row = c as Record<string, unknown>;
  return String(row.name ?? row.customer_name ?? '').trim();
}

const SettlementLineSourceSelect: React.FC<{
  fieldName: number;
  customerId?: number | null;
}> = ({ fieldName, customerId }) => {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const sourceType = Form.useWatch(['items', fieldName, 'source_type'], form) as AfterSalesSourceKind | undefined;
  const [options, setOptions] = useState<AfterSalesSourceOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sourceType) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void loadAfterSalesSourceOptions(sourceType, customerId)
      .then((rows) => {
        if (!cancelled) setOptions(rows);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, sourceType]);

  return (
    <>
      <Form.Item name={[fieldName, 'source_code']} hidden>
        <Input />
      </Form.Item>
      <Form.Item
        name={[fieldName, 'source_id']}
        rules={[{ required: true, message: t('common.required') }]}
        style={{ margin: 0 }}
      >
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          loading={loading}
          disabled={!sourceType}
          options={options.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(value: number | undefined) => {
            const picked = options.find((o) => o.value === value);
            form.setFieldValue(['items', fieldName, 'source_code'], picked?.code);
          }}
        />
      </Form.Item>
    </>
  );
};

const ServiceSettlementFormModal: React.FC<ServiceSettlementFormModalProps> = ({
  open,
  editing,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [submitting, setSubmitting] = useState(false);
  const [customerId, setCustomerId] = useState<number | undefined>();

  useEffect(() => {
    if (!open) return;
    setCustomerId(editing?.customer_id);
  }, [editing?.customer_id, open]);

  const initialValues = useMemo(() => {
    if (editing) {
      return {
        customer_id: editing.customer_id,
        customer_name: editing.customer_name,
        notes: editing.notes ?? undefined,
        items:
          (editing.items ?? []).map((item) => ({
            source_type: item.source_type as AfterSalesSourceKind,
            source_id: item.source_id,
            source_code: item.source_code ?? undefined,
            warranty_status: item.warranty_status ?? '保外',
            amount: item.amount != null ? Number(item.amount) : undefined,
            notes: item.notes ?? undefined,
          })) || [{ source_type: 'repair_order', warranty_status: '保外', amount: 0 }],
      };
    }
    return {
      items: [{ source_type: 'repair_order' as AfterSalesSourceKind, warranty_status: '保外', amount: 0 }],
    };
  }, [editing]);

  const handleFinish = async (values: Record<string, unknown>) => {
    const items = ((values.items as LineForm[]) || []).filter(
      (row) => row.source_type && row.source_id != null,
    );
    if (!items.length) {
      messageApi.error(t('app.kuaizhizao.afterSalesService.serviceSettlement.linesRequired'));
      return;
    }
    const payload: ServiceSettlementPayload = {
      customer_id: Number(values.customer_id),
      customer_name: String(values.customer_name || ''),
      notes: (values.notes as string) || undefined,
      items: items.map((row) => ({
        source_type: String(row.source_type),
        source_id: Number(row.source_id),
        source_code: row.source_code,
        warranty_status: row.warranty_status,
        amount: Number(row.amount) || 0,
        notes: row.notes,
      })),
    };
    setSubmitting(true);
    try {
      if (editing) {
        await serviceSettlementApi.update(editing.id, {
          notes: payload.notes,
          items: payload.items,
        });
        messageApi.success(t('common.saveSuccess'));
      } else {
        await serviceSettlementApi.create(payload);
        messageApi.success(t('common.createSuccess'));
      }
      onSuccess();
      onClose();
    } catch (error) {
      messageApi.error(formatApiErrorDetail(error) || t('common.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModalTemplate
      key={editing?.id ?? 'create'}
      formRef={formRef}
      open={open}
      onClose={onClose}
      title={
        editing
          ? t('app.kuaizhizao.afterSalesService.serviceSettlement.editTitle')
          : t('app.kuaizhizao.afterSalesService.serviceSettlement.createTitle')
      }
      width={MODAL_CONFIG.LARGE_WIDTH}
      grid={false}
      isEdit={Boolean(editing)}
      loading={submitting}
      initialValues={initialValues}
      onFinish={handleFinish}
    >
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="customer_name" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="customer_id"
            label={t('app.kuaizhizao.afterSalesService.serviceSettlement.field.customerName')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <CustomerSelectDropdown
              hostResource="kuaizhizao:service-settlement"
              disabled={Boolean(editing)}
              style={{ width: '100%' }}
              onCustomerPick={(c) => {
                setCustomerId(c?.id != null ? Number(c.id) : undefined);
                formRef.current?.setFieldsValue({
                  customer_name: customerDisplayName(c),
                  items: [{ source_type: 'repair_order', warranty_status: '保外', amount: 0 }],
                });
              }}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="notes"
            label={t('common.remark')}
          >
            <Input.TextArea rows={1} />
          </Form.Item>
        </Col>
      </Row>

      <UniTableDetail
        name="items"
        title={t('app.kuaizhizao.afterSalesService.common.itemsTitle')}
        required
        requiredMessage={t('app.kuaizhizao.afterSalesService.serviceSettlement.linesRequired')}
        addText={t('app.kuaizhizao.afterSalesService.serviceSettlement.addLine')}
        initialValue={{ source_type: 'repair_order', warranty_status: '保外', amount: 0 }}
        columns={[
          {
            title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.sourceType'),
            dataIndex: 'source_type',
            width: 140,
            render: (_: unknown, __: unknown, index: number) => (
              <Form.Item
                name={[index, 'source_type']}
                rules={[{ required: true, message: t('common.required') }]}
                style={{ margin: 0 }}
              >
                <Select
                  options={[
                    {
                      value: 'repair_order',
                      label: t('app.kuaizhizao.afterSalesService.dispatchOrder.sourceType.repairOrder'),
                    },
                    {
                      value: 'install_execution',
                      label: t(
                        'app.kuaizhizao.afterSalesService.dispatchOrder.sourceType.installExecution',
                      ),
                    },
                  ]}
                  onChange={() => {
                    formRef.current?.setFieldValue(['items', index, 'source_id'], undefined);
                    formRef.current?.setFieldValue(['items', index, 'source_code'], undefined);
                  }}
                />
              </Form.Item>
            ),
          },
          {
            title: t('app.kuaizhizao.afterSalesService.common.sourceDocument'),
            dataIndex: 'source_id',
            width: 240,
            render: (_: unknown, __: unknown, index: number) => (
              <SettlementLineSourceSelect fieldName={index} customerId={customerId} />
            ),
          },
          {
            title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.warrantyStatus'),
            dataIndex: 'warranty_status',
            width: 110,
            render: (_: unknown, __: unknown, index: number) => (
              <Form.Item name={[index, 'warranty_status']} style={{ margin: 0 }}>
                <Select
                  options={[
                    {
                      value: '保内',
                      label: t('app.kuaizhizao.afterSalesService.serviceSettlement.warranty.inside'),
                    },
                    {
                      value: '保外',
                      label: t('app.kuaizhizao.afterSalesService.serviceSettlement.warranty.outside'),
                    },
                  ]}
                />
              </Form.Item>
            ),
          },
          {
            title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.amount'),
            dataIndex: 'amount',
            width: 120,
            render: (_: unknown, __: unknown, index: number) => (
              <Form.Item
                name={[index, 'amount']}
                rules={[{ required: true, message: t('common.required') }]}
                style={{ margin: 0 }}
              >
                <InputNumber min={0} style={{ width: '100%' }} size="small" />
              </Form.Item>
            ),
          },
        ]}
      />
    </FormModalTemplate>
  );
};

export default ServiceSettlementFormModal;
