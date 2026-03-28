/**
 * 客户跟进新建/编辑弹窗（供客户跟进列表、报价单、销售订单等复用）
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { App, Button, Col, DatePicker, Form, Input, Row, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { FormModalTemplate } from '../../../components/layout-templates';
import { DictionarySelect } from '../../../components/dictionary-select';
import { UniDropdown } from '../../../components/uni-dropdown';
import { useSubmitShortcut } from '../../../hooks/useSubmitShortcut';
import { customerFollowUpApi, type CustomerFollowUp } from '../services/customer-follow-up';
import { listQuotations, type Quotation } from '../services/quotation';
import { listSalesOrders, type SalesOrder } from '../services/sales-order';
import { customerApi, getDictionaryOptions } from '../../master-data/services/supply-chain';
import { CustomerFormModal } from '../../master-data/components/CustomerFormModal';
import type { Customer } from '../../master-data/types/supply-chain';

const DICT_CODE = 'SALES_FOLLOW_UP_TYPE';

const getCustomerId = (c: any): number | null => {
  const id = Number(c?.id ?? c?.customer_id);
  return Number.isFinite(id) ? id : null;
};

const getCustomerName = (c: any): string => {
  const code = String(c?.code ?? c?.customer_code ?? '').trim();
  const name = String(c?.name ?? c?.customer_name ?? '').trim();
  return `${code} ${name}`.trim();
};

/** 从报价单/销售订单打开新建跟进时预填 */
export type CustomerFollowUpPreset = {
  customer_id: number;
  quotation_id?: number;
  quotation_code?: string;
  sales_order_id?: number;
  sales_order_code?: string;
};

export interface CustomerFollowUpFormModalProps {
  open: boolean;
  onClose: () => void;
  /** 创建或更新成功后 */
  onSuccess?: () => void;
  /** 编辑；与 preset 互斥 */
  editing?: CustomerFollowUp | null;
  /** 新建并预填关联报价单/销售订单 */
  preset?: CustomerFollowUpPreset | null;
}

export const CustomerFollowUpFormModal: React.FC<CustomerFollowUpFormModalProps> = ({
  open,
  onClose,
  onSuccess,
  editing = null,
  preset = null,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const modalCustomerId = Form.useWatch('customer_id', form);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activityOptions, setActivityOptions] = useState<{ label: string; value: string }[]>([]);
  const [quotationList, setQuotationList] = useState<Quotation[]>([]);
  const [salesOrderList, setSalesOrderList] = useState<SalesOrder[]>([]);
  const [docListsLoading, setDocListsLoading] = useState(false);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const customerDropdownRef = useRef<any>(null);
  const contentInputRef = useRef<any>(null);

  const loadDictAndCustomers = async () => {
    const [custRes, dictRes] = await Promise.allSettled([
      customerApi.list({ limit: 1000, isActive: true } as any),
      getDictionaryOptions(DICT_CODE),
    ]);

    let custData: any[] = [];
    if (custRes.status === 'fulfilled') {
      const val = custRes.value;
      if (Array.isArray(val)) {
        custData = val;
      } else if (val && typeof val === 'object') {
        custData = (val as any).items || (val as any).data || [];
      }
    }

    const uniq = new Map<number, any>();
    for (const c of custData) {
      const id = getCustomerId(c);
      if (id == null) continue;
      if (!uniq.has(id)) uniq.set(id, c);
    }
    setCustomers(Array.from(uniq.values()) as Customer[]);

    if (dictRes.status === 'fulfilled') {
      setActivityOptions(dictRes.value || []);
    } else {
      setActivityOptions([]);
    }
  };

  useEffect(() => {
    loadDictAndCustomers();
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDocListsLoading(true);
    (async () => {
      try {
        const [qRes, oRes] = await Promise.all([
          listQuotations({ limit: 500 }),
          listSalesOrders({ limit: 500 }),
        ]);
        if (cancelled) return;
        setQuotationList(Array.isArray(qRes.data) ? qRes.data : []);
        setSalesOrderList(Array.isArray(oRes.data) ? oRes.data : []);
      } catch {
        if (!cancelled) {
          setQuotationList([]);
          setSalesOrderList([]);
        }
      } finally {
        if (!cancelled) setDocListsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue({
        customer_id: editing.customer_id,
        activity_type_code: editing.activity_type_code,
        content: editing.content,
        occurred_at: editing.occurred_at ? dayjs(editing.occurred_at) : dayjs(),
        next_follow_up_at: editing.next_follow_up_at ? dayjs(editing.next_follow_up_at) : undefined,
        quotation_id: editing.quotation_id ?? undefined,
        sales_order_id: editing.sales_order_id ?? undefined,
      });
      setTimeout(() => contentInputRef.current?.focus(), 100);
      return;
    }
    form.resetFields();
    if (preset) {
      form.setFieldsValue({
        customer_id: preset.customer_id,
        quotation_id: preset.quotation_id,
        sales_order_id: preset.sales_order_id,
        occurred_at: dayjs(),
      });
    } else {
      form.setFieldsValue({
        occurred_at: dayjs(),
      });
    }
  }, [open, form, editing?.id, preset?.customer_id, preset?.quotation_id, preset?.sales_order_id]);

  const quotationOptions = useMemo(() => {
    if (modalCustomerId == null) return [];
    return quotationList
      .filter((q) => q.id != null && q.customer_id === modalCustomerId)
      .map((q) => ({
        value: q.id as number,
        label: [q.quotation_code, q.customer_name].filter(Boolean).join(' · ') || `#${q.id}`,
      }));
  }, [quotationList, modalCustomerId]);

  const salesOrderOptions = useMemo(() => {
    if (modalCustomerId == null) return [];
    return salesOrderList
      .filter((o) => o.id != null && o.customer_id === modalCustomerId)
      .map((o) => ({
        value: o.id as number,
        label: [o.order_code, o.customer_name].filter(Boolean).join(' · ') || `#${o.id}`,
      }));
  }, [salesOrderList, modalCustomerId]);

  const quotationSelectOptions = useMemo(() => {
    const extraId = editing?.quotation_id ?? preset?.quotation_id;
    const extraLabel = editing?.quotation_code ?? preset?.quotation_code;
    if (extraId != null && !quotationOptions.some((o) => o.value === extraId)) {
      return [
        ...quotationOptions,
        { value: extraId, label: extraLabel || `#${extraId}` },
      ];
    }
    return quotationOptions;
  }, [quotationOptions, editing?.quotation_id, editing?.quotation_code, preset?.quotation_id, preset?.quotation_code]);

  const salesOrderSelectOptions = useMemo(() => {
    const extraId = editing?.sales_order_id ?? preset?.sales_order_id;
    const extraLabel = editing?.sales_order_code ?? preset?.sales_order_code;
    if (extraId != null && !salesOrderOptions.some((o) => o.value === extraId)) {
      return [
        ...salesOrderOptions,
        { value: extraId, label: extraLabel || `#${extraId}` },
      ];
    }
    return salesOrderOptions;
  }, [salesOrderOptions, editing?.sales_order_id, editing?.sales_order_code, preset?.sales_order_id, preset?.sales_order_code]);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      const customerId = Number(v.customer_id);
      const customer = customers.find((c: any) => getCustomerId(c) === customerId);
      if (!customer) {
        message.error(t('app.kuaizhizao.customerFollowUp.customerRequired'));
        return;
      }
      const occurred = (v.occurred_at as dayjs.Dayjs).toISOString();
      const next =
        v.next_follow_up_at != null && v.next_follow_up_at !== ''
          ? (v.next_follow_up_at as dayjs.Dayjs).toISOString()
          : null;
      if (editing) {
        await customerFollowUpApi.update(editing.id, {
          customer_name: (customer as any).name ?? (customer as any).customer_name ?? '',
          activity_type_code: v.activity_type_code,
          content: v.content,
          occurred_at: occurred,
          next_follow_up_at: next,
          quotation_id: v.quotation_id ?? null,
          sales_order_id: v.sales_order_id ?? null,
        });
        message.success(t('pages.system.siteSettings.saveSuccess'));
      } else {
        await customerFollowUpApi.create({
          customer_id: customerId,
          activity_type_code: v.activity_type_code,
          content: v.content,
          occurred_at: occurred,
          next_follow_up_at: next,
          quotation_id: v.quotation_id ?? null,
          sales_order_id: v.sales_order_id ?? null,
        });
        message.success(t('common.createSuccess'));
      }
      onClose();
      onSuccess?.();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || t('common.operationFailed'));
    }
  };

  useSubmitShortcut(submit, open);

  const handleClose = () => {
    onClose();
  };

  return (
    <>
      <FormModalTemplate
        className="customer-follow-up-modal"
        title={editing ? t('app.kuaizhizao.customerFollowUp.editTitle') : t('app.kuaizhizao.customerFollowUp.createTitle')}
        open={open}
        onClose={handleClose}
        onFinish={submit}
        form={form}
        width={960}
      >
        <Row gutter={[24, 0]}>
          <Col xs={24} md={12}>
            <Form.Item
              name="customer_id"
              label={t('app.kuaizhizao.customerFollowUp.fieldCustomer')}
              rules={[{ required: true, message: t('common.required') }]}
            >
              <UniDropdown
                ref={customerDropdownRef}
                showSearch
                optionFilterProp="label"
                disabled={!!editing}
                autoFocus={!editing}
                quickCreate={{
                  label: t('app.kuaizhizao.customerFollowUp.quickAddCustomer') || '快速新增客户',
                  onClick: () => setCustomerModalVisible(true),
                }}
                options={
                  customers
                    .map((c: any) => {
                      const id = getCustomerId(c);
                      if (id == null) return null;
                      return { label: getCustomerName(c) || String(id), value: id };
                    })
                    .filter(Boolean) as Array<{ label: string; value: number }>
                }
                onChange={() => {
                  form.setFieldsValue({ quotation_id: undefined, sales_order_id: undefined });
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <DictionarySelect
              dictionaryCode={DICT_CODE}
              name="activity_type_code"
              label={t('app.kuaizhizao.customerFollowUp.fieldActivityType')}
              placeholder={t('app.kuaizhizao.customerFollowUp.activityTypePlaceholder')}
              formRef={form as any}
              required
            />
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="occurred_at"
              label={t('app.kuaizhizao.customerFollowUp.fieldOccurredAt')}
              rules={[{ required: true, message: t('common.required') }]}
            >
              <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="next_follow_up_at" label={t('app.kuaizhizao.customerFollowUp.fieldNextFollowUp')}>
              <DatePicker
                showTime
                style={{ width: '100%' }}
                format="YYYY-MM-DD HH:mm"
                renderExtraFooter={() => (
                  <Space style={{ padding: '8px 12px' }}>
                    <Button size="small" type="link" onClick={() => form.setFieldValue('next_follow_up_at', dayjs().add(1, 'day'))}>
                      明天
                    </Button>
                    <Button size="small" type="link" onClick={() => form.setFieldValue('next_follow_up_at', dayjs().add(3, 'day'))}>
                      3天后
                    </Button>
                    <Button size="small" type="link" onClick={() => form.setFieldValue('next_follow_up_at', dayjs().add(7, 'day'))}>
                      1周后
                    </Button>
                  </Space>
                )}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="quotation_id" label={t('app.kuaizhizao.customerFollowUp.fieldLinkedQuotation')}>
              <UniDropdown
                allowClear
                showSearch
                optionFilterProp="label"
                loading={docListsLoading}
                disabled={modalCustomerId == null}
                placeholder={
                  modalCustomerId == null
                    ? t('app.kuaizhizao.customerFollowUp.selectCustomerFirst')
                    : t('app.kuaizhizao.customerFollowUp.optionalSelectDocument')
                }
                options={quotationSelectOptions}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="sales_order_id" label={t('app.kuaizhizao.customerFollowUp.fieldLinkedSalesOrder')}>
              <UniDropdown
                allowClear
                showSearch
                optionFilterProp="label"
                loading={docListsLoading}
                disabled={modalCustomerId == null}
                placeholder={
                  modalCustomerId == null
                    ? t('app.kuaizhizao.customerFollowUp.selectCustomerFirst')
                    : t('app.kuaizhizao.customerFollowUp.optionalSelectDocument')
                }
                options={salesOrderSelectOptions}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="content"
          label={t('app.kuaizhizao.customerFollowUp.fieldContent')}
          rules={[{ required: true, message: t('common.required') }]}
          style={{ marginBottom: 0 }}
        >
          <Input.TextArea
            ref={contentInputRef}
            rows={8}
            showCount
            maxLength={2000}
            placeholder="请输入跟进记录内容..."
            style={{ resize: 'vertical' }}
          />
        </Form.Item>
      </FormModalTemplate>

      <CustomerFormModal
        open={customerModalVisible}
        editUuid={null}
        onClose={() => setCustomerModalVisible(false)}
        onSuccess={(newCust) => {
          setCustomers((prev) => [...prev, newCust]);
          form.setFieldValue('customer_id', newCust.id);
          setCustomerModalVisible(false);
          loadDictAndCustomers();
        }}
      />
    </>
  );
};

export default CustomerFollowUpFormModal;
