/**
 * 订单评审新建/编辑弹窗
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  App,
  Button,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Row,
  Space,
  Typography,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import {
  DOCUMENT_DETAIL_COL_WIDTH,
  DOCUMENT_DETAIL_CONTROL_SIZE,
  DOCUMENT_DETAIL_TABLE_PROPS,
  DOCUMENT_DETAIL_TEXT_COL,
  DocumentDetailTableStyles,
} from '../../../components/document-detail-table/documentDetailTable';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { toApiDateString } from '../../../../../utils/formDate';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { useOptionalLinkedDocumentDetail } from '../../../../../components/linked-document-detail';
import { SALES_FORM_ROW_GUTTER } from '../shared/salesFormLayout';
import {
  salesReviewApi,
  type SalesReview,
  type SalesReviewCreatePayload,
  type SalesReviewItemInput,
} from '../../../services/sales-review';

const getCustomerId = (c: any): number | null => {
  const id = Number(c?.id ?? c?.customer_id);
  return Number.isFinite(id) && id > 0 ? id : null;
};

const getCustomerName = (c: any): string => {
  const code = String(c?.code ?? c?.customer_code ?? '').trim();
  const name = String(c?.name ?? c?.customer_name ?? '').trim();
  return `${code} ${name}`.trim() || String(c?.id ?? '');
};

const getCustomerCode = (c: any): string =>
  String(c?.code ?? c?.customer_code ?? '').trim();

export type SalesReviewFormModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (row: SalesReview) => void;
  editing?: SalesReview | null;
  zIndex?: number;
};

type LineFormRow = {
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  quantity?: number;
  unit_price?: number;
  amount?: number;
  notes?: string;
};

function LineAmountCell({ index }: { index: number }) {
  const row = Form.useWatch(['items', index]) as LineFormRow | undefined;
  const qty = Number(row?.quantity ?? 0);
  const price = Number(row?.unit_price ?? 0);
  const amount = Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0;
  return <span>{amount.toFixed(2)}</span>;
}

export const SalesReviewFormModal: React.FC<SalesReviewFormModalProps> = ({
  open,
  onClose,
  onSuccess,
  editing = null,
  zIndex,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const linkedDetail = useOptionalLinkedDocumentDetail();
  const [form] = Form.useForm();
  const [customers, setCustomers] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const customerDropdownRef = useRef<any>(null);

  const customerOptions = useMemo(
    () =>
      customers
        .map((c) => {
          const id = getCustomerId(c);
          if (id == null) return null;
          return { label: getCustomerName(c), value: id, code: getCustomerCode(c), name: String(c?.name ?? c?.customer_name ?? '').trim() };
        })
        .filter(Boolean) as Array<{ label: string; value: number; code: string; name: string }>,
    [customers],
  );

  useEffect(() => {
    let cancelled = false;
    customerApi
      .list({ limit: 1000, isActive: true } as any)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res)
          ? res
          : (res as any)?.items || (res as any)?.data || [];
        setCustomers(list);
      })
      .catch(() => {
        if (!cancelled) setCustomers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue({
        customer_id: editing.customer_id,
        customer_name: editing.customer_name,
        customer_code: editing.customer_code,
        customer_contact: editing.customer_contact,
        customer_phone: editing.customer_phone,
        project_name: editing.project_name,
        review_date: editing.review_date ? dayjs(editing.review_date) : undefined,
        delivery_date: editing.delivery_date ? dayjs(editing.delivery_date) : undefined,
        urgency: editing.urgency || 'normal',
        risk_level: editing.risk_level || 'medium',
        settlement_method: editing.settlement_method,
        payment_cycle: editing.payment_cycle,
        remarks: editing.remarks,
        items: (editing.items || []).map((it) => ({
          material_id: it.material_id ?? undefined,
          material_code: it.material_code,
          material_name: it.material_name,
          material_spec: it.material_spec ?? undefined,
          material_unit: it.material_unit ?? undefined,
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          notes: it.notes ?? undefined,
        })),
      });
      return;
    }
    form.setFieldsValue({
      urgency: 'normal',
      risk_level: 'medium',
      review_date: dayjs(),
      items: [
        {
          material_id: undefined,
          material_code: '',
          material_name: '',
          quantity: 1,
          unit_price: 0,
        },
      ],
    });
  }, [open, editing, form]);

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const buildItems = (rawItems: LineFormRow[]): SalesReviewItemInput[] =>
    (rawItems || [])
      .map((it) => {
        const material_code = String(it.material_code ?? '').trim();
        const material_name = String(it.material_name ?? '').trim();
        if (!material_code || !material_name) return null;
        const quantity = Number(it.quantity);
        const unit_price = Number(it.unit_price ?? 0);
        if (!Number.isFinite(quantity) || quantity <= 0) return null;
        return {
          material_id: it.material_id != null ? Number(it.material_id) : null,
          material_code,
          material_name,
          material_spec: it.material_spec || null,
          material_unit: it.material_unit || null,
          quantity,
          unit_price: Number.isFinite(unit_price) && unit_price >= 0 ? unit_price : 0,
          notes: it.notes || null,
        } as SalesReviewItemInput;
      })
      .filter(Boolean) as SalesReviewItemInput[];

  const submit = async () => {
    const values = await form.validateFields();
    const items = buildItems(values.items || []);
    if (!items.length) {
      message.error(t('app.kuaizhizao.salesReview.itemsRequired'));
      return;
    }
    const customerOpt = customerOptions.find((o) => o.value === Number(values.customer_id));
    const payload: SalesReviewCreatePayload = {
      customer_id: Number(values.customer_id),
      customer_code: values.customer_code || customerOpt?.code || null,
      customer_name: values.customer_name || customerOpt?.name || customerOpt?.label || '',
      customer_contact: values.customer_contact || null,
      customer_phone: values.customer_phone || null,
      project_name: String(values.project_name || '').trim(),
      review_date: toApiDateString(values.review_date) || null,
      delivery_date: toApiDateString(values.delivery_date) || null,
      urgency: values.urgency || 'normal',
      risk_level: values.risk_level || 'medium',
      settlement_method: values.settlement_method || null,
      payment_cycle: values.payment_cycle || null,
      remarks: values.remarks || null,
      items,
    };
    if (!payload.customer_name) {
      message.error(t('app.kuaizhizao.salesReview.customerRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const row = editing
        ? await salesReviewApi.update(editing.id, payload)
        : await salesReviewApi.create(payload);
      message.success(t('common.saveSuccess'));
      onSuccess?.(row);
      handleClose();
    } catch (err) {
      message.error(getApiErrorMessage(err, t('common.saveFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModalTemplate
      title={
        editing
          ? t('app.kuaizhizao.salesReview.editTitle')
          : t('app.kuaizhizao.salesReview.createTitle')
      }
      open={open}
      onClose={handleClose}
      onFinish={submit}
      form={form}
      width={MODAL_CONFIG.LARGE_WIDTH}
      zIndex={zIndex}
      loading={submitting}
    >
      <Row gutter={SALES_FORM_ROW_GUTTER}>
        <Col xs={24} md={8}>
          <Form.Item name="customer_code" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="customer_name" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="customer_id"
            label={t('app.kuaizhizao.salesReview.fieldCustomer')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <UniDropdown
              ref={customerDropdownRef}
              showSearch
              optionFilterProp="label"
              options={customerOptions}
              onChange={(val) => {
                const opt = customerOptions.find((o) => o.value === Number(val));
                form.setFieldsValue({
                  customer_code: opt?.code,
                  customer_name: opt?.name || opt?.label,
                });
              }}
            />
          </Form.Item>
        </Col>
        {editing?.quotation_code ? (
          <Col xs={24} md={8}>
            <Form.Item label={t('app.kuaizhizao.customerFollowUp.fieldLinkedQuotation')}>
              {editing.quotation_id ? (
                <Typography.Link
                  onClick={() => linkedDetail?.openLinkedDocumentDetail('quotation', editing.quotation_id!)}
                >
                  {editing.quotation_code}
                </Typography.Link>
              ) : (
                <Typography.Text>{editing.quotation_code}</Typography.Text>
              )}
            </Form.Item>
          </Col>
        ) : null}
        <Col xs={24} md={8}>
          <Form.Item
            name="project_name"
            label={t('app.kuaizhizao.salesReview.fieldProjectName')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <Input maxLength={200} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="customer_contact" label={t('app.kuaizhizao.salesReview.fieldContact')}>
            <Input maxLength={100} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="customer_phone" label={t('app.kuaizhizao.salesReview.fieldPhone')}>
            <Input maxLength={50} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="review_date" label={t('app.kuaizhizao.salesReview.fieldReviewDate')}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="delivery_date" label={t('app.kuaizhizao.salesReview.fieldDeliveryDate')}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="urgency"
            label={t('app.kuaizhizao.salesReview.fieldUrgency')}
            initialValue="normal"
          >
            <ThemedSegmented
              options={[
                { label: t('app.kuaizhizao.salesReview.urgency.low'), value: 'low' },
                { label: t('app.kuaizhizao.salesReview.urgency.normal'), value: 'normal' },
                { label: t('app.kuaizhizao.salesReview.urgency.high'), value: 'high' },
                { label: t('app.kuaizhizao.salesReview.urgency.urgent'), value: 'urgent' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="risk_level"
            label={t('app.kuaizhizao.salesReview.fieldRiskLevel')}
            initialValue="medium"
          >
            <ThemedSegmented
              options={[
                { label: t('app.kuaizhizao.salesReview.risk.low'), value: 'low' },
                { label: t('app.kuaizhizao.salesReview.risk.medium'), value: 'medium' },
                { label: t('app.kuaizhizao.salesReview.risk.high'), value: 'high' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="settlement_method"
            label={t('app.kuaizhizao.salesReview.fieldSettlement')}
          >
            <Input maxLength={100} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="payment_cycle" label={t('app.kuaizhizao.salesReview.fieldPaymentCycle')}>
            <Input maxLength={100} />
          </Form.Item>
        </Col>
      </Row>

      <DocumentDetailTableStyles />
      <UniTableDetail
        name="items"
        title={t('app.kuaizhizao.salesReview.itemsTitle')}
        required
        requiredMessage={t('app.kuaizhizao.salesReview.itemsRequired')}
        headerExtra={
          <Space size={8}>
            <Button
              type="default"
              icon={<PlusOutlined />}
              onClick={() => {
                const items = [...(form.getFieldValue('items') ?? [])];
                items.push({
                  material_id: undefined,
                  material_code: '',
                  material_name: '',
                  quantity: 1,
                  unit_price: 0,
                });
                form.setFieldsValue({ items });
              }}
            >
              {t('common.addDetail')}
            </Button>
          </Space>
        }
        disabledAdd
        minRows={1}
        initialValue={{
          material_id: undefined,
          material_code: '',
          material_name: '',
          quantity: 1,
          unit_price: 0,
        }}
        tableProps={DOCUMENT_DETAIL_TABLE_PROPS}
        columns={[
          {
            title: t('app.kuaizhizao.salesReview.colMaterial'),
            dataIndex: 'material_id',
            width: DOCUMENT_DETAIL_COL_WIDTH.material,
            ...DOCUMENT_DETAIL_TEXT_COL,
            render: (_: unknown, __: unknown, index: number) => (
              <>
                <UniMaterialSelect
                  name={[index, 'material_id']}
                  label=""
                  placeholder={t('app.kuaizhizao.salesReview.selectMaterial')}
                  required
                  size={DOCUMENT_DETAIL_CONTROL_SIZE}
                  listFieldKey={index}
                  listFieldName="items"
                  fillMapping={{
                    material_code: 'mainCode',
                    material_name: 'name',
                    material_spec: 'specification',
                    material_unit: 'baseUnit',
                  }}
                  formItemProps={{ style: { margin: 0 } }}
                  showAdvancedSearch
                />
                <Form.Item name={[index, 'material_code']} hidden>
                  <Input />
                </Form.Item>
                <Form.Item name={[index, 'material_name']} hidden>
                  <Input />
                </Form.Item>
                <Form.Item name={[index, 'material_spec']} hidden>
                  <Input />
                </Form.Item>
                <Form.Item name={[index, 'material_unit']} hidden>
                  <Input />
                </Form.Item>
              </>
            ),
          },
          {
            title: t('common.quantity'),
            dataIndex: 'quantity',
            width: 110,
            render: (_: unknown, __: unknown, index: number) => (
              <Form.Item
                name={[index, 'quantity']}
                rules={[{ required: true, message: t('common.required') }]}
                style={{ margin: 0 }}
              >
                <InputNumber min={0.0001} style={{ width: '100%' }} size={DOCUMENT_DETAIL_CONTROL_SIZE} />
              </Form.Item>
            ),
          },
          {
            title: t('app.kuaizhizao.salesReview.colUnitPrice'),
            dataIndex: 'unit_price',
            width: 120,
            render: (_: unknown, __: unknown, index: number) => (
              <Form.Item name={[index, 'unit_price']} style={{ margin: 0 }}>
                <InputNumber min={0} style={{ width: '100%' }} size={DOCUMENT_DETAIL_CONTROL_SIZE} />
              </Form.Item>
            ),
          },
          {
            title: t('app.kuaizhizao.salesReview.colAmount'),
            dataIndex: 'amount',
            width: 110,
            render: (_: unknown, __: unknown, index: number) => <LineAmountCell index={index} />,
          },
        ]}
      />

      <Form.Item name="remarks" label={t('common.remark')}>
        <Input.TextArea rows={2} maxLength={1000} showCount />
      </Form.Item>
    </FormModalTemplate>
  );
};

export default SalesReviewFormModal;
