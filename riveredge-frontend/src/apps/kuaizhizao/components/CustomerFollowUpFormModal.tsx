/**
 * 客户跟进新建/编辑弹窗（供客户跟进列表、报价单、销售订单等复用）
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { App, Button, Col, DatePicker, Form, Input, Row, Space, List, Typography, Tag, Empty, Spin, Modal, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { FormModalTemplate, MODAL_CONFIG } from '../../../components/layout-templates';
import { MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../components/layout-templates/constants';
import { buildFutureDateShortcutPickerProps } from '../../../utils/futureDatePickerShortcuts';
import { DictionarySelect } from '../../../components/dictionary-select';
import { UniDropdown } from '../../../components/uni-dropdown';
import { ThemedSegmented } from '../../../components/themed-segmented';
import { useSubmitShortcut } from '../../../hooks/useSubmitShortcut';
import { customerFollowUpApi, type CustomerFollowUp } from '../services/customer-follow-up';
import { salesOpportunityApi, type SalesOpportunity } from '../services/sales-opportunity';
import { listQuotations, type Quotation } from '../services/quotation';
import { listSalesOrders, type SalesOrder } from '../services/sales-order';
import { customerApi, getDictionaryOptions, getDictionaryOptionsSync } from '../../master-data/services/supply-chain';
import { CustomerFormModal } from '../../master-data/components/CustomerFormModal';
import type { Customer } from '../../master-data/types/supply-chain';
import { formatDateTime } from '../../../utils/format';

const DICT_CODE = 'SALES_FOLLOW_UP_TYPE';
const STAGE_DICT_CODE = 'SALES_OPPORTUNITY_STAGE';
const TERMINAL_STAGES = new Set(['WON', 'LOST']);

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
  opportunity_id?: number;
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
  /** 与详情抽屉、追溯浮层同屏时抬高 */
  zIndex?: number;
}

export const CustomerFollowUpFormModal: React.FC<CustomerFollowUpFormModalProps> = ({
  open,
  onClose,
  onSuccess,
  editing = null,
  preset = null,
  zIndex,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const modalCustomerId = Form.useWatch('customer_id', form);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activityOptions, setActivityOptions] = useState<{ label: string; value: string }[]>([]);
  const [quotationList, setQuotationList] = useState<Quotation[]>([]);
  const [salesOrderList, setSalesOrderList] = useState<SalesOrder[]>([]);
  const [docListsLoading, setDocListsLoading] = useState(false);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [relatedFollowUps, setRelatedFollowUps] = useState<CustomerFollowUp[]>([]);
  const [relatedFollowUpsLoading, setRelatedFollowUpsLoading] = useState(false);
  const customerDropdownRef = useRef<any>(null);
  const contentInputRef = useRef<any>(null);
  const modalQuotationId = Form.useWatch('quotation_id', form);
  const modalSalesOrderId = Form.useWatch('sales_order_id', form);
  const [opportunities, setOpportunities] = useState<SalesOpportunity[]>([]);
  const [stageOptions, setStageOptions] = useState<{ label: string; value: string }[]>([]);
  const [targetStageCode, setTargetStageCode] = useState<string | null>(null);
  const [resolvingOpportunity, setResolvingOpportunity] = useState(false);

  const selectedOpportunity = useMemo(
    () => opportunities[0] ?? null,
    [opportunities],
  );

  const currentStageCode = selectedOpportunity?.stage_code ?? 'INITIAL';
  const effectiveTargetStage = targetStageCode ?? currentStageCode;

  const resolveOpportunityForQuotation = useCallback(async () => {
    const customerId = Number(form.getFieldValue('customer_id'));
    const quotationId = form.getFieldValue('quotation_id');
    if (!Number.isFinite(customerId) || quotationId == null) return null;
    setResolvingOpportunity(true);
    try {
      const opp = await salesOpportunityApi.ensure({
        customer_id: customerId,
        quotation_id: quotationId,
        sales_order_id: null,
      });
      form.setFieldValue('opportunity_id', opp.id);
      setOpportunities([opp]);
      return opp;
    } catch {
      return null;
    } finally {
      setResolvingOpportunity(false);
    }
  }, [form]);

  const loadStageOptions = useCallback(async () => {
    const cached = getDictionaryOptionsSync(STAGE_DICT_CODE);
    if (cached?.length) setStageOptions(cached);
    try {
      const opts = await getDictionaryOptions(STAGE_DICT_CODE);
      setStageOptions(opts || []);
    } catch {
      if (!cached?.length) setStageOptions([]);
    }
  }, []);

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
    if (open) loadStageOptions();
  }, [open, loadStageOptions]);

  const hasLinkedQuotation =
    modalQuotationId != null && modalQuotationId !== '' && Number.isFinite(Number(modalQuotationId));

  useEffect(() => {
    if (!open) return;
    if (!hasLinkedQuotation) {
      setOpportunities([]);
      form.setFieldValue('opportunity_id', undefined);
      setTargetStageCode(null);
      return;
    }
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await resolveOpportunityForQuotation();
    })();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    hasLinkedQuotation,
    modalQuotationId,
    modalCustomerId,
    editing?.id,
    editing?.quotation_id,
    editing?.opportunity_id,
    resolveOpportunityForQuotation,
    form,
  ]);

  useEffect(() => {
    if (!open) return;
    setTargetStageCode(null);
  }, [open, modalQuotationId]);

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
        opportunity_id: editing.quotation_id ? editing.opportunity_id ?? undefined : undefined,
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
        opportunity_id: preset.opportunity_id,
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

  useEffect(() => {
    if (!open || modalCustomerId == null) {
      setRelatedFollowUps([]);
      return;
    }
    const qid = Number(modalQuotationId);
    const soid = Number(modalSalesOrderId);
    if (!Number.isFinite(qid) && !Number.isFinite(soid)) {
      setRelatedFollowUps([]);
      return;
    }

    let cancelled = false;
    setRelatedFollowUpsLoading(true);
    (async () => {
      try {
        const res = await customerFollowUpApi.list({
          customer_id: Number(modalCustomerId),
          limit: 200,
          skip: 0,
        });
        if (cancelled) return;
        const filtered = (res.items || [])
          .filter((item) => {
            const matchQ = Number.isFinite(qid) && item.quotation_id === qid;
            const matchSO = Number.isFinite(soid) && item.sales_order_id === soid;
            return Boolean(matchQ || matchSO);
          })
          .filter((item) => !editing || item.id !== editing.id)
          .sort((a, b) => dayjs(b.occurred_at).valueOf() - dayjs(a.occurred_at).valueOf());
        setRelatedFollowUps(filtered);
      } catch {
        if (!cancelled) setRelatedFollowUps([]);
      } finally {
        if (!cancelled) setRelatedFollowUpsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, modalCustomerId, modalQuotationId, modalSalesOrderId, editing?.id]);

  const handleStagePick = (next: string | number) => {
    const code = String(next);
    if (code === currentStageCode) {
      setTargetStageCode(null);
      return;
    }
    if (TERMINAL_STAGES.has(code)) {
      Modal.confirm({
        title: t('app.kuaizhizao.quotationStage.closeStageConfirmTitle'),
        content: t('app.kuaizhizao.quotationStage.closeStageConfirmContent', {
          stage: stageOptions.find((s) => s.value === code)?.label || code,
        }),
        onOk: () => setTargetStageCode(code),
      });
      return;
    }
    setTargetStageCode(code);
  };

  const submit = async () => {
    try {
      const v = await form.validateFields();
      const customerId = Number(v.customer_id);
      const customer = customers.find((c: any) => getCustomerId(c) === customerId);
      if (!customer) {
        message.error(t('app.kuaizhizao.customerFollowUp.customerRequired'));
        return;
      }
      const hasQuotation = v.quotation_id != null;
      if (hasQuotation && v.opportunity_id == null) {
        const ensured = await resolveOpportunityForQuotation();
        if (!ensured) {
          message.error(t('common.operationFailed'));
          return;
        }
        v.opportunity_id = ensured.id;
      }
      const occurred = (v.occurred_at as dayjs.Dayjs).toISOString();
      const next =
        v.next_follow_up_at != null && v.next_follow_up_at !== ''
          ? (v.next_follow_up_at as dayjs.Dayjs).toISOString()
          : null;
      const stageAfter =
        hasQuotation && effectiveTargetStage && effectiveTargetStage !== currentStageCode
          ? effectiveTargetStage
          : undefined;
      const opportunityId =
        hasQuotation && v.opportunity_id != null ? Number(v.opportunity_id) : undefined;
      if (editing) {
        await customerFollowUpApi.update(editing.id, {
          customer_name: (customer as any).name ?? (customer as any).customer_name ?? '',
          activity_type_code: v.activity_type_code,
          content: v.content,
          occurred_at: occurred,
          next_follow_up_at: next,
          quotation_id: v.quotation_id ?? null,
          sales_order_id: v.sales_order_id ?? null,
          opportunity_id: opportunityId ?? null,
          stage_code_after: stageAfter,
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
          ...(hasQuotation
            ? { opportunity_id: opportunityId, stage_code_after: stageAfter }
            : {}),
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
        width={MODAL_CONFIG.LARGE_WIDTH}
        zIndex={zIndex}
      >
        <Row gutter={[24, 0]}>
          <Col xs={24} lg={16}>
            <Row gutter={[24, 0]}>
              <Form.Item name="opportunity_id" hidden>
                <Input />
              </Form.Item>
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
                      label: t('app.kuaizhizao.customerFollowUp.quickAddCustomer'),
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
                      form.setFieldsValue({
                        quotation_id: undefined,
                        sales_order_id: undefined,
                        opportunity_id: undefined,
                      });
                      setTargetStageCode(null);
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
                  valueEqualsLabel={false}
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
                    {...buildFutureDateShortcutPickerProps({
                      getForm: () => form,
                      baseFieldName: 'occurred_at',
                      t,
                      onApply: (date) => form.setFieldValue('next_follow_up_at', date),
                      fieldProps: { showTime: true, format: 'YYYY-MM-DD HH:mm', style: { width: '100%' } },
                    })}
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
                    onChange={(val) => {
                      if (val == null) {
                        form.setFieldsValue({ opportunity_id: undefined });
                        setTargetStageCode(null);
                        setOpportunities([]);
                      }
                    }}
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
            >
              <Input.TextArea
                ref={contentInputRef}
                rows={8}
                showCount
                maxLength={2000}
                placeholder={t('app.kuaizhizao.customerFollowUp.contentPlaceholder')}
                style={{ resize: 'vertical' }}
              />
            </Form.Item>
            {hasLinkedQuotation ? (
              <Form.Item label={t('app.kuaizhizao.quotationStage.fieldLabel')} style={{ marginBottom: 0 }}>
                {resolvingOpportunity ? (
                  <Spin size="small" />
                ) : stageOptions.length > 0 ? (
                  <>
                    <ThemedSegmented
                      block
                      className="quotation-stage-segmented"
                      options={stageOptions.map((s) => ({ label: s.label, value: s.value }))}
                      value={effectiveTargetStage}
                      onChange={handleStagePick}
                      disabled={selectedOpportunity != null && selectedOpportunity.status !== 'open'}
                    />
                    {targetStageCode && targetStageCode !== currentStageCode ? (
                      <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
                        {t('app.kuaizhizao.quotationStage.stageWillChange', {
                          from: stageOptions.find((s) => s.value === currentStageCode)?.label || currentStageCode,
                          to: stageOptions.find((s) => s.value === targetStageCode)?.label || targetStageCode,
                        })}
                      </Typography.Text>
                    ) : null}
                  </>
                ) : (
                  <Typography.Text type="secondary">{t('app.kuaizhizao.customerStage.dictMissing')}</Typography.Text>
                )}
              </Form.Item>
            ) : null}
          </Col>
          <Col xs={24} lg={8}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>
              {t('app.kuaizhizao.customerFollowUp.linkedDocTimelineTitle')}
            </div>
            <div
              style={{
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: token.borderRadius,
                padding: 12,
                minHeight: 392,
                maxHeight: 460,
                overflowY: 'auto',
                background: token.colorFillAlter,
              }}
            >
              {relatedFollowUpsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Spin size="small" />
                </div>
              ) : relatedFollowUps.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t('app.kuaizhizao.customerFollowUp.linkedDocTimelineEmpty')}
                />
              ) : (
                <List
                  size="small"
                  dataSource={relatedFollowUps}
                  renderItem={(item) => {
                    const activityText =
                      activityOptions.find((opt) => opt.value === item.activity_type_code)?.label ||
                      item.activity_type_code;
                    return (
                      <List.Item style={{ alignItems: 'flex-start', paddingInline: 0 }}>
                        <div style={{ width: '100%' }}>
                          <Space size={6} wrap>
                            <Tag color="blue">{activityText}</Tag>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {formatDateTime(item.occurred_at, 'YYYY-MM-DD HH:mm')}
                            </Typography.Text>
                          </Space>
                          <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {item.content || '-'}
                          </div>
                          <Space size={8} style={{ marginTop: 6 }} wrap>
                            {item.quotation_code ? (
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                {t('app.kuaizhizao.customerFollowUp.linkedQuotationLabel')}{item.quotation_code}
                              </Typography.Text>
                            ) : null}
                            {item.sales_order_code ? (
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                {t('app.kuaizhizao.customerFollowUp.linkedSalesOrderLabel')}{item.sales_order_code}
                              </Typography.Text>
                            ) : null}
                          </Space>
                        </div>
                      </List.Item>
                    );
                  }}
                />
              )}
            </div>
          </Col>
        </Row>
      </FormModalTemplate>

      <CustomerFormModal
        open={customerModalVisible}
        editUuid={null}
        onClose={() => setCustomerModalVisible(false)}
        zIndex={zIndex != null ? zIndex + MODAL_NESTED_ABOVE_PARENT_OFFSET : undefined}
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
