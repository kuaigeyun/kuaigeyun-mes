/**
 * 销售发票详情 / 编辑 / 实务操作（作废、红字发票）
 */
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  ProDescriptions,
  ProForm,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Button, Form, Input, Modal, Space, Spin, Table, Tag, Typography, message, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { apiRequest, formatApiErrorDetail } from '../../../../../services/api';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import {
  DetailDrawerSection,
  DOCUMENT_DETAIL_PAGE_HEADER_STYLE,
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
  uniTabsChildPageVerticalInsetStyle,
} from '../../../../../components/layout-templates';
import { getChineseInvoiceLifecycle } from '../../../utils/financeLifecycle';
import {
  formatChineseInvoiceType,
  getChineseInvoiceTypeOptions,
  buildReviewStatusEnum,
} from '../../../utils/financeSharedOptions';
import { canDeleteSalesInvoice } from '../../../utils/salesInvoiceUi';
import { formatDateTime } from '../../../../../utils/format';

interface SalesInvoiceLine {
  id: number;
  item_name: string;
  spec_model?: string | null;
  unit?: string | null;
  quantity?: string | number | null;
  unit_price?: string | number | null;
  amount: string | number;
  tax_rate: string | number;
  tax_amount: string | number;
}

interface SalesInvoiceDetail {
  id: number;
  invoice_code: string;
  customer_id: number;
  customer_name: string;
  sales_order_code?: string | null;
  invoice_number: string;
  invoice_date: string;
  invoice_type: string;
  tax_rate: number;
  invoice_amount: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  review_status: string;
  notes?: string | null;
  receivable_id?: number | null;
  receivable_code?: string | null;
  original_invoice_id?: number | null;
  red_flush_invoice_id?: number | null;
  void_reason?: string | null;
  voided_at?: string | null;
  items: SalesInvoiceLine[];
}

const TAX_RATE_OPTIONS = [
  { label: '13%', value: 13 },
  { label: '9%', value: 9 },
  { label: '6%', value: 6 },
  { label: '1%', value: 1 },
  { label: '0%', value: 0 },
];

const P = 'app.kuaicaiwu.salesInvoice';

function moneyCell(v: string | number | undefined | null) {
  const n = Number(v ?? 0);
  const abs = Math.abs(n).toLocaleString('zh-CN', { minimumFractionDigits: 2 });
  return n < 0 ? `-${abs}` : abs;
}

const SalesInvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const voidReasonRef = useRef('');
  const redLetterReasonRef = useRef('');
  const reasonFieldKeyRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SalesInvoiceDetail | null>(null);

  const invoiceTypeOptions = useMemo(() => getChineseInvoiceTypeOptions(t), [t]);
  const reviewStatusEnum = useMemo(() => buildReviewStatusEnum(t), [t]);

  const invoiceNumber = data?.invoice_number?.trim() || '';
  const pageTitle = invoiceNumber
    ? t(`${P}.detailTitleWithNumber`, { number: invoiceNumber })
    : t(`${P}.detailTitle`);
  const tabTitle = invoiceNumber || t(`${P}.detailTitle`);

  const formatStatusLabel = useCallback(
    (status: string) => {
      const keyMap: Record<string, string> = {
        未审核: 'app.kuaicaiwu.financeLifecycle.notReviewed',
        已审核: 'app.kuaicaiwu.financeStatus.review.approved',
        已开票: 'app.kuaicaiwu.financeStatus.review.approved',
        已作废: 'app.kuaicaiwu.financeLifecycle.voided',
        已红冲: 'app.kuaicaiwu.financeLifecycle.redFlushed',
        DRAFT: 'app.kuaicaiwu.financeLifecycle.notReviewed',
      };
      const key = keyMap[status];
      return key ? t(key) : status;
    },
    [t],
  );

  useEffect(() => {
    if (!data) return;
    const tabKey = location.pathname + location.search;
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: { key: tabKey, title: tabTitle },
      }),
    );
  }, [tabTitle, data, location.pathname, location.search]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiRequest<SalesInvoiceDetail>(`/apps/kuaicaiwu/sales-invoices/${id}`);
      setData(res);
      const typeOpt = invoiceTypeOptions.find(
        (o) => o.value === res.invoice_type || res.invoice_type === o.label,
      );
      form.setFieldsValue({
        invoice_number: res.invoice_number || '',
        invoice_date: res.invoice_date ? dayjs(res.invoice_date) : undefined,
        invoice_type: typeOpt ? typeOpt.value : res.invoice_type,
        tax_rate: res.tax_rate,
        invoice_amount: res.invoice_amount,
        tax_amount: res.tax_amount,
        total_amount: res.total_amount,
        notes: res.notes || '',
      });
    } catch (e: unknown) {
      message.error(formatApiErrorDetail((e as any)?.response?.data?.detail) || (e as Error)?.message || t('common.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, form, invoiceTypeOptions, t]);

  useEffect(() => {
    load();
  }, [load]);

  const editable = data && ['未审核', 'DRAFT'].includes(String(data.status || ''));

  const save = async () => {
    if (!id || !data) return;
    try {
      const v = await form.validateFields();
      await apiRequest(`/apps/kuaicaiwu/sales-invoices/${id}`, {
        method: 'PUT',
        data: {
          invoice_number: String(v.invoice_number ?? '').trim(),
          invoice_date: v.invoice_date?.format ? v.invoice_date.format('YYYY-MM-DD') : v.invoice_date,
          invoice_type: v.invoice_type,
          tax_rate: Number(v.tax_rate),
          invoice_amount: Number(v.invoice_amount),
          tax_amount: Number(v.tax_amount),
          total_amount: Number(v.total_amount),
          notes: v.notes,
        },
      });
      message.success(t(`${P}.saved`));
      load();
    } catch (e: unknown) {
      if ((e as any)?.errorFields) return;
      message.error(formatApiErrorDetail((e as any)?.response?.data?.detail) || (e as Error)?.message || t('common.saveFailed'));
    }
  };

  const approve = () => {
    if (!id || !data) return;
    Modal.confirm({
      title: t(`${P}.approvePass`),
      content: t(`${P}.approveConfirm`, { number: data.invoice_number?.trim() || t(`${P}.detailTitle`) }),
      onOk: async () => {
        await apiRequest(`/apps/kuaicaiwu/sales-invoices/${id}/approve`, { method: 'POST' });
        message.success(t(`${P}.approved`));
        load();
      },
    });
  };

  const remove = () => {
    if (!id || !data) return;
    Modal.confirm({
      title: t(`${P}.deleteTitle`),
      content: t(`${P}.deleteConfirm`),
      okType: 'danger',
      onOk: async () => {
        await apiRequest(`/apps/kuaicaiwu/sales-invoices/${id}`, { method: 'DELETE' });
        message.success(t('common.deleteSuccess'));
        navigate('/apps/kuaicaiwu/finance-management/sales-invoices');
      },
    });
  };

  const openVoid = () => {
    voidReasonRef.current = '';
    reasonFieldKeyRef.current += 1;
    const rk = reasonFieldKeyRef.current;
    Modal.confirm({
      title: t(`${P}.voidTitle`),
      width: 480,
      content: (
        <div style={{ marginTop: 12 }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
            {t(`${P}.voidHint`)}
          </Typography.Paragraph>
          <Typography.Text strong>{t(`${P}.voidReasonRequired`)}</Typography.Text>
          <InputReason key={`void-${rk}`} placeholder={t(`${P}.reasonPlaceholder`)} onChange={(v) => { voidReasonRef.current = v; }} />
        </div>
      ),
      onOk: async () => {
        const r = voidReasonRef.current.trim();
        if (!r) {
          message.warning(t(`${P}.voidReasonMissing`));
          return Promise.reject();
        }
        await apiRequest(`/apps/kuaicaiwu/sales-invoices/${id}/void`, {
          method: 'POST',
          data: { reason: r },
        });
        message.success(t(`${P}.voided`));
        load();
      },
    });
  };

  const openRedLetter = () => {
    redLetterReasonRef.current = '';
    reasonFieldKeyRef.current += 1;
    const rk = reasonFieldKeyRef.current;
    Modal.confirm({
      title: t(`${P}.redLetterTitle`),
      width: 520,
      content: (
        <div style={{ marginTop: 12 }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
            {t(`${P}.redLetterHint`)}
          </Typography.Paragraph>
          <Typography.Text strong>{t(`${P}.redLetterReasonRequired`)}</Typography.Text>
          <InputReason key={`red-${rk}`} placeholder={t(`${P}.reasonPlaceholder`)} onChange={(v) => { redLetterReasonRef.current = v; }} />
        </div>
      ),
      onOk: async () => {
        const r = redLetterReasonRef.current.trim();
        if (!r) {
          message.warning(t(`${P}.redLetterReasonMissing`));
          return Promise.reject();
        }
        const created = await apiRequest<SalesInvoiceDetail>(`/apps/kuaicaiwu/sales-invoices/${id}/red-letter`, {
          method: 'POST',
          data: { reason: r },
        });
        message.success(t(`${P}.redLetterDraftCreated`));
        navigate(`/apps/kuaicaiwu/finance-management/sales-invoices/${created.id}`, { replace: true });
      },
    });
  };

  const lineColumns: ColumnsType<SalesInvoiceLine> = useMemo(
    () => [
      { title: t('app.kuaicaiwu.invoice.line.itemName'), dataIndex: 'item_name', width: 200 },
      { title: t('app.kuaicaiwu.invoice.line.specModel'), dataIndex: 'spec_model', width: 120 },
      { title: t('app.kuaicaiwu.invoice.line.unit'), dataIndex: 'unit', width: 72 },
      {
        title: t('app.kuaicaiwu.invoice.line.quantity'),
        dataIndex: 'quantity',
        width: 88,
        align: 'right',
        render: (v) => (v == null || v === '' ? '—' : String(v)),
      },
      {
        title: t(`${P}.line.unitPriceExcl`),
        dataIndex: 'unit_price',
        width: 110,
        align: 'right',
        render: (v) => (v == null || v === '' ? '—' : moneyCell(v)),
      },
      {
        title: t(`${P}.line.amountExcl`),
        dataIndex: 'amount',
        width: 120,
        align: 'right',
        render: (_, r) => moneyCell(r.amount),
      },
      {
        title: t('app.kuaicaiwu.invoice.line.taxRate'),
        dataIndex: 'tax_rate',
        width: 72,
        align: 'right',
        render: (_, r) => `${(Number(r.tax_rate) <= 1 ? Number(r.tax_rate) * 100 : Number(r.tax_rate)).toFixed(2)}%`,
      },
      {
        title: t('app.kuaicaiwu.invoice.line.taxAmount'),
        dataIndex: 'tax_amount',
        width: 100,
        align: 'right',
        render: (_, r) => moneyCell(r.tax_amount),
      },
    ],
    [t],
  );

  if (!id) return null;

  const isRedDraft = data?.original_invoice_id != null;
  const showRedLetterBtn = data
    && String(data.status || '') === '已审核'
    && !data.red_flush_invoice_id
    && !isRedDraft;

  const pageActions = data ? (
    <Space wrap size={8}>
      <Button onClick={() => navigate('/apps/kuaicaiwu/finance-management/sales-invoices')}>{t('app.kuaicaiwu.common.back')}</Button>
      {editable ? (
        <Button type="primary" onClick={save}>
          {t(`${P}.saveChanges`)}
        </Button>
      ) : null}
      {data.review_status === '待审核' && ['未审核', 'DRAFT'].includes(String(data.status || '')) ? (
        <Button type="primary" onClick={approve}>
          {t(`${P}.approvePass`)}
        </Button>
      ) : null}
      {editable ? (
        <Button danger onClick={openVoid}>
          {t('app.kuaicaiwu.common.void')}
        </Button>
      ) : null}
      {canDeleteSalesInvoice(data) ? (
        <Button danger onClick={remove}>
          {t('common.delete')}
        </Button>
      ) : null}
      {showRedLetterBtn ? (
        <Button onClick={openRedLetter}>
          {t(`${P}.applyRedLetter`)}
        </Button>
      ) : null}
    </Space>
  ) : null;

  const renderShell = (body: React.ReactNode) => (
    <div style={uniTabsChildPageVerticalInsetStyle()}>
      <div style={DOCUMENT_DETAIL_PAGE_HEADER_STYLE}>
        <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
          {pageTitle}
        </Typography.Title>
        {pageActions}
      </div>
      {body}
    </div>
  );

  if (loading && !data) {
    return renderShell(
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <Spin size="large" />
      </div>,
    );
  }

  if (!data) {
    return renderShell(<Empty description={t(`${P}.detailNotFound`)} />);
  }

  const lc = getChineseInvoiceLifecycle(data as unknown as Record<string, unknown>, t);
  const reviewLabel = reviewStatusEnum[data.review_status]?.text ?? data.review_status;

  return renderShell(
    <>
      <DetailDrawerSection title={t(`${P}.section.statusAndLink`)}>
        <Space align="start" size={24} wrap>
          <UniLifecycle percent={lc.percent} stageName={lc.stageName} status={lc.status} subStages={lc.subStages} showLabel size="small" />
          {isRedDraft ? <Tag color="volcano">{t(`${P}.redLetterTag`)}</Tag> : null}
          {data.original_invoice_id ? (
            <Typography.Link onClick={() => navigate(`/apps/kuaicaiwu/finance-management/sales-invoices/${data.original_invoice_id}`)}>
              {t(`${P}.viewBlueInvoice`, { id: data.original_invoice_id })}
            </Typography.Link>
          ) : null}
          {data.red_flush_invoice_id ? (
            <Typography.Link onClick={() => navigate(`/apps/kuaicaiwu/finance-management/sales-invoices/${data.red_flush_invoice_id}`)}>
              {t(`${P}.viewRedInvoice`, { id: data.red_flush_invoice_id })}
            </Typography.Link>
          ) : null}
          {data.receivable_id != null ? (
            <Typography.Link onClick={() => navigate(`/apps/kuaicaiwu/finance-management/receivables/${data.receivable_id}`)}>
              {t(`${P}.linkedReceivable`, { code: data.receivable_code || `#${data.receivable_id}` })}
            </Typography.Link>
          ) : null}
        </Space>
      </DetailDrawerSection>

      <DetailDrawerSection title={t(`${P}.section.faceAndHeader`)}>
        <ProDescriptions column={2} bordered size="small">
          <ProDescriptions.Item label={t('app.kuaicaiwu.common.customer')}>{data.customer_name}</ProDescriptions.Item>
          <ProDescriptions.Item label={t(`${P}.sourceOrder`)}>{data.sales_order_code || '—'}</ProDescriptions.Item>
          <ProDescriptions.Item label={t('common.status')}>{formatStatusLabel(data.status)}</ProDescriptions.Item>
          <ProDescriptions.Item label={t('app.kuaicaiwu.common.reviewStatus')}>{reviewLabel}</ProDescriptions.Item>
          {data.void_reason ? (
            <ProDescriptions.Item label={t(`${P}.voidReason`)} span={2}>
              <Typography.Text type="danger">{data.void_reason}</Typography.Text>
              {data.voided_at ? `（${formatDateTime(data.voided_at, 'YYYY-MM-DD HH:mm')}）` : null}
            </ProDescriptions.Item>
          ) : null}
        </ProDescriptions>
      </DetailDrawerSection>

      {editable ? (
        <DetailDrawerSection title={t(`${P}.section.editFace`)}>
          <ProForm form={form} submitter={false} layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 14 }}>
            <ProFormText
              name="invoice_number"
              label={t('app.kuaicaiwu.invoice.col.invoiceNumber')}
              placeholder={t(`${P}.form.invoiceNumberFace`)}
            />
            <ProFormDatePicker
              name="invoice_date"
              label={t('app.kuaicaiwu.common.invoiceDate')}
              rules={[{ required: true }]}
              fieldProps={{ style: { width: '100%' } }}
            />
            <ProFormSelect
              name="invoice_type"
              label={t(`${P}.col.invoiceType`)}
              options={invoiceTypeOptions}
              rules={[{ required: true }]}
            />
            <ProFormSelect
              name="tax_rate"
              label={t(`${P}.col.taxRate`)}
              options={TAX_RATE_OPTIONS}
              rules={[{ required: true }]}
            />
            <ProFormDigit
              name="invoice_amount"
              label={t(`${P}.col.exclTax`)}
              min={-1e12}
              fieldProps={{ precision: 2 }}
              rules={[{ required: true }]}
            />
            <ProFormDigit name="tax_amount" label={t(`${P}.col.taxAmount`)} min={-1e12} fieldProps={{ precision: 2 }} rules={[{ required: true }]} />
            <ProFormDigit
              name="total_amount"
              label={t('app.kuaicaiwu.invoice.col.totalAmount')}
              min={-1e12}
              fieldProps={{ precision: 2 }}
              rules={[{ required: true }]}
            />
            <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} />
          </ProForm>
        </DetailDrawerSection>
      ) : (
        <DetailDrawerSection title={t(`${P}.section.amountAndType`)}>
          <ProDescriptions column={2} bordered size="small">
            <ProDescriptions.Item label={t('app.kuaicaiwu.invoice.col.invoiceNumber')}>
              {data.invoice_number?.trim() ? data.invoice_number : '—'}
            </ProDescriptions.Item>
            <ProDescriptions.Item label={t('app.kuaicaiwu.common.invoiceDate')}>{data.invoice_date}</ProDescriptions.Item>
            <ProDescriptions.Item label={t(`${P}.col.invoiceType`)}>{formatChineseInvoiceType(data.invoice_type, t)}</ProDescriptions.Item>
            <ProDescriptions.Item label={t(`${P}.col.taxRate`)}>{data.tax_rate}%</ProDescriptions.Item>
            <ProDescriptions.Item label={t(`${P}.col.exclTax`)}>¥{moneyCell(data.invoice_amount)}</ProDescriptions.Item>
            <ProDescriptions.Item label={t(`${P}.col.taxAmount`)}>¥{moneyCell(data.tax_amount)}</ProDescriptions.Item>
            <ProDescriptions.Item label={t('app.kuaicaiwu.invoice.col.totalAmount')}>
              <Typography.Text strong>¥{moneyCell(data.total_amount)}</Typography.Text>
            </ProDescriptions.Item>
            <ProDescriptions.Item label={t('app.kuaicaiwu.common.notes')} span={2}>
              {data.notes || '—'}
            </ProDescriptions.Item>
          </ProDescriptions>
        </DetailDrawerSection>
      )}

      <DetailDrawerSection title={t(`${P}.section.lines`)} marginBottom={0}>
        <Table<SalesInvoiceLine>
          size="small"
          rowKey="id"
          pagination={false}
          columns={lineColumns}
          dataSource={data.items || []}
          locale={{ emptyText: t(`${P}.noLines`) }}
          scroll={{ x: 1000 }}
        />
      </DetailDrawerSection>
    </>,
  );
};

/** 供 Modal 内收集多行文本 */
function InputReason({
  onChange,
  placeholder,
}: {
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [v, setV] = useState('');
  return (
    <Input.TextArea
      rows={4}
      style={{ marginTop: 8 }}
      placeholder={placeholder}
      value={v}
      onChange={(e) => {
        setV(e.target.value);
        onChange(e.target.value);
      }}
    />
  );
}

export default SalesInvoiceDetailPage;
