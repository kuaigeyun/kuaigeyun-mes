/**
 * 销售发票详情 / 编辑 / 实务操作（作废、红字发票）
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  PageContainer,
  ProDescriptions,
  ProForm,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Button, Card, Form, Input, Modal, Space, Spin, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { apiRequest, formatApiErrorDetail } from '../../../../../services/api';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getChineseInvoiceLifecycle } from '../../../utils/financeLifecycle';
import {
  displaySalesInvoiceListCode,
  formatSalesInvoiceTypeZh,
  INVOICE_TYPE_OPTIONS,
} from '../../../utils/salesInvoiceUi';

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

function moneyCell(v: string | number | undefined | null) {
  const n = Number(v ?? 0);
  const abs = Math.abs(n).toLocaleString('zh-CN', { minimumFractionDigits: 2 });
  return n < 0 ? `-${abs}` : abs;
}

const SalesInvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const voidReasonRef = useRef('');
  const redLetterReasonRef = useRef('');
  const reasonFieldKeyRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SalesInvoiceDetail | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiRequest<SalesInvoiceDetail>(`/apps/kuaicaiwu/sales-invoices/${id}`);
      setData(res);
      const typeZh = formatSalesInvoiceTypeZh(res.invoice_type);
      const typeOpt = INVOICE_TYPE_OPTIONS.find(
        (o) => o.value === res.invoice_type || o.label === typeZh || res.invoice_type === o.label
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
      message.error(formatApiErrorDetail((e as any)?.response?.data?.detail) || (e as Error)?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [id, form]);

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
      message.success('已保存');
      load();
    } catch (e: unknown) {
      if ((e as any)?.errorFields) return;
      message.error(formatApiErrorDetail((e as any)?.response?.data?.detail) || (e as Error)?.message || '保存失败');
    }
  };

  const approve = () => {
    if (!id || !data) return;
    Modal.confirm({
      title: '审核通过',
      content: `确认审核通过 ${data.invoice_number?.trim() || displaySalesInvoiceListCode(data)}？`,
      onOk: async () => {
        await apiRequest(`/apps/kuaicaiwu/sales-invoices/${id}/approve`, { method: 'POST' });
        message.success('已审核');
        load();
      },
    });
  };

  const openVoid = () => {
    voidReasonRef.current = '';
    reasonFieldKeyRef.current += 1;
    const rk = reasonFieldKeyRef.current;
    Modal.confirm({
      title: '发票作废',
      width: 480,
      content: (
        <div style={{ marginTop: 12 }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
            适用于未审核/草稿阶段发现开票信息有误、尚未确认记账的情形。已审核发票请使用「申请红字发票」。
          </Typography.Paragraph>
          <Typography.Text strong>作废原因（必填）</Typography.Text>
          <InputReason key={`void-${rk}`} onChange={(v) => { voidReasonRef.current = v; }} />
        </div>
      ),
      onOk: async () => {
        const r = voidReasonRef.current.trim();
        if (!r) {
          message.warning('请填写作废原因');
          return Promise.reject();
        }
        await apiRequest(`/apps/kuaicaiwu/sales-invoices/${id}/void`, {
          method: 'POST',
          data: { reason: r },
        });
        message.success('已作废');
        load();
      },
    });
  };

  const openRedLetter = () => {
    redLetterReasonRef.current = '';
    reasonFieldKeyRef.current += 1;
    const rk = reasonFieldKeyRef.current;
    Modal.confirm({
      title: '申请红字发票',
      width: 520,
      content: (
        <div style={{ marginTop: 12 }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
            系统将生成一张金额为负数的销项发票草稿，用于账务冲销；请在税控系统完成红字信息表及开票后，回填票面号码。
          </Typography.Paragraph>
          <Typography.Text strong>红冲原因（必填）</Typography.Text>
          <InputReason key={`red-${rk}`} onChange={(v) => { redLetterReasonRef.current = v; }} />
        </div>
      ),
      onOk: async () => {
        const r = redLetterReasonRef.current.trim();
        if (!r) {
          message.warning('请填写红冲原因');
          return Promise.reject();
        }
        const created = await apiRequest<SalesInvoiceDetail>(`/apps/kuaicaiwu/sales-invoices/${id}/red-letter`, {
          method: 'POST',
          data: { reason: r },
        });
        message.success('已生成红字发票草稿');
        navigate(`/apps/kuaicaiwu/finance-management/sales-invoices/${created.id}`, { replace: true });
      },
    });
  };

  if (!id) return null;

  if (loading && !data) {
    return (
      <PageContainer>
        <div style={{ padding: 80, textAlign: 'center' }}>
          <Spin size="large" />
        </div>
      </PageContainer>
    );
  }

  if (!data) {
    return (
      <PageContainer>
        <Typography.Text type="secondary">未找到发票</Typography.Text>
      </PageContainer>
    );
  }

  const lc = getChineseInvoiceLifecycle(data as unknown as Record<string, unknown>);
  const isRedDraft = data.original_invoice_id != null;
  const showRedLetterBtn =
    String(data.status || '') === '已审核' && !data.red_flush_invoice_id && !isRedDraft;

  const lineColumns: ColumnsType<SalesInvoiceLine> = [
    { title: '货物或应税劳务名称', dataIndex: 'item_name', width: 200 },
    { title: '规格型号', dataIndex: 'spec_model', width: 120 },
    { title: '单位', dataIndex: 'unit', width: 72 },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 88,
      align: 'right',
      render: (v) => (v == null || v === '' ? '—' : String(v)),
    },
    {
      title: '单价(不含税)',
      dataIndex: 'unit_price',
      width: 110,
      align: 'right',
      render: (v) => (v == null || v === '' ? '—' : moneyCell(v)),
    },
    {
      title: '金额(不含税)',
      dataIndex: 'amount',
      width: 120,
      align: 'right',
      render: (_, r) => moneyCell(r.amount),
    },
    {
      title: '税率',
      dataIndex: 'tax_rate',
      width: 72,
      align: 'right',
      render: (_, r) => `${(Number(r.tax_rate) <= 1 ? Number(r.tax_rate) * 100 : Number(r.tax_rate)).toFixed(2)}%`,
    },
    {
      title: '税额',
      dataIndex: 'tax_amount',
      width: 100,
      align: 'right',
      render: (_, r) => moneyCell(r.tax_amount),
    },
  ];

  return (
    <PageContainer
      title={`销售发票 · ${displaySalesInvoiceListCode(data)}`}
      extra={[
        <Button key="back" onClick={() => navigate('/apps/kuaicaiwu/finance-management/sales-invoices')}>
          返回列表
        </Button>,
        editable ? (
          <Button key="save" type="primary" onClick={save}>
            保存修改
          </Button>
        ) : null,
        data.review_status === '待审核' && ['未审核', 'DRAFT'].includes(String(data.status || '')) ? (
          <Button key="ap" type="primary" onClick={approve}>
            审核通过
          </Button>
        ) : null,
        editable ? (
          <Button key="void" danger onClick={openVoid}>
            作废
          </Button>
        ) : null,
        showRedLetterBtn ? (
          <Button key="red" onClick={openRedLetter}>
            申请红字发票
          </Button>
        ) : null,
      ].filter(Boolean)}
    >
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space align="start" size={24} wrap>
          <UniLifecycle percent={lc.percent} stageName={lc.stageName} status={lc.status} subStages={lc.subStages} showLabel size="small" />
          {isRedDraft ? <Tag color="volcano">红字发票</Tag> : null}
          {data.original_invoice_id ? (
            <Typography.Link onClick={() => navigate(`/apps/kuaicaiwu/finance-management/sales-invoices/${data.original_invoice_id}`)}>
              查看对应蓝字发票 #{data.original_invoice_id}
            </Typography.Link>
          ) : null}
          {data.red_flush_invoice_id ? (
            <Typography.Link onClick={() => navigate(`/apps/kuaicaiwu/finance-management/sales-invoices/${data.red_flush_invoice_id}`)}>
              查看红字发票 #{data.red_flush_invoice_id}
            </Typography.Link>
          ) : null}
          {data.receivable_id != null ? (
            <Typography.Link onClick={() => navigate(`/apps/kuaicaiwu/finance-management/receivables/${data.receivable_id}`)}>
              关联应收 {data.receivable_code || `#${data.receivable_id}`}
            </Typography.Link>
          ) : null}
        </Space>
      </Card>

      <ProDescriptions column={2} bordered size="small" title="票面与抬头">
        <ProDescriptions.Item label="内部序号">{displaySalesInvoiceListCode(data)}</ProDescriptions.Item>
        <ProDescriptions.Item label="系统编码（调试）">
          <Typography.Text copyable={{ text: data.invoice_code }} code style={{ fontSize: 12 }}>
            {data.invoice_code}
          </Typography.Text>
        </ProDescriptions.Item>
        <ProDescriptions.Item label="客户">{data.customer_name}</ProDescriptions.Item>
        <ProDescriptions.Item label="来源订单号">{data.sales_order_code || '—'}</ProDescriptions.Item>
        <ProDescriptions.Item label="状态">{data.status}</ProDescriptions.Item>
        <ProDescriptions.Item label="审核">{data.review_status}</ProDescriptions.Item>
        {data.void_reason ? (
          <ProDescriptions.Item label="作废原因" span={2}>
            <Typography.Text type="danger">{data.void_reason}</Typography.Text>
            {data.voided_at ? `（${dayjs(data.voided_at).format('YYYY-MM-DD HH:mm')}）` : null}
          </ProDescriptions.Item>
        ) : null}
      </ProDescriptions>

      {editable ? (
        <Card size="small" title="编辑票面信息" style={{ marginTop: 16 }}>
          <ProForm form={form} submitter={false} layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 14 }}>
            <ProFormText name="invoice_number" label="发票号码" placeholder="取得税控票面号码后填写" />
            <ProFormDatePicker name="invoice_date" label="开票日期" rules={[{ required: true }]} fieldProps={{ style: { width: '100%' } }} />
            <ProFormSelect name="invoice_type" label="发票类型" options={INVOICE_TYPE_OPTIONS} rules={[{ required: true }]} />
            <ProFormSelect name="tax_rate" label="税率(%)" options={TAX_RATE_OPTIONS} rules={[{ required: true }]} />
            <ProFormDigit name="invoice_amount" label="不含税金额" min={-1e12} fieldProps={{ precision: 2 }} rules={[{ required: true }]} />
            <ProFormDigit name="tax_amount" label="税额" min={-1e12} fieldProps={{ precision: 2 }} rules={[{ required: true }]} />
            <ProFormDigit name="total_amount" label="价税合计" min={-1e12} fieldProps={{ precision: 2 }} rules={[{ required: true }]} />
            <ProFormTextArea name="notes" label="备注" />
          </ProForm>
        </Card>
      ) : (
        <ProDescriptions column={2} bordered size="small" title="金额与类型" style={{ marginTop: 16 }}>
          <ProDescriptions.Item label="发票号码">{data.invoice_number?.trim() ? data.invoice_number : '—'}</ProDescriptions.Item>
          <ProDescriptions.Item label="开票日期">{data.invoice_date}</ProDescriptions.Item>
          <ProDescriptions.Item label="发票类型">{formatSalesInvoiceTypeZh(data.invoice_type)}</ProDescriptions.Item>
          <ProDescriptions.Item label="税率">{data.tax_rate}%</ProDescriptions.Item>
          <ProDescriptions.Item label="不含税金额">¥{moneyCell(data.invoice_amount)}</ProDescriptions.Item>
          <ProDescriptions.Item label="税额">¥{moneyCell(data.tax_amount)}</ProDescriptions.Item>
          <ProDescriptions.Item label="价税合计">
            <Typography.Text strong>¥{moneyCell(data.total_amount)}</Typography.Text>
          </ProDescriptions.Item>
          <ProDescriptions.Item label="备注" span={2}>
            {data.notes || '—'}
          </ProDescriptions.Item>
        </ProDescriptions>
      )}

      <Card size="small" title="发票明细" style={{ marginTop: 16 }}>
        <Table<SalesInvoiceLine>
          size="small"
          rowKey="id"
          pagination={false}
          columns={lineColumns}
          dataSource={data.items || []}
          locale={{ emptyText: '无明细（可通过统一发票入口维护明细）' }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </PageContainer>
  );
};

/** 供 Modal 内收集多行文本 */
function InputReason({ onChange }: { onChange: (v: string) => void }) {
  const [v, setV] = useState('');
  return (
    <Input.TextArea
      rows={4}
      style={{ marginTop: 8 }}
      placeholder="请填写原因，留存审计痕迹"
      value={v}
      onChange={(e) => {
        setV(e.target.value);
        onChange(e.target.value);
      }}
    />
  );
}

export default SalesInvoiceDetailPage;
