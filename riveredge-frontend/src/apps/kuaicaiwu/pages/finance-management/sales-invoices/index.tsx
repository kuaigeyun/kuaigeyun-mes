/**
 * 销售发票列表页
 *
 * 管理向客户开具的销项发票，支持关联销售订单和应收单。
 */
import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ModalForm, ProFormDatePicker, ProFormDigit, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { CheckCircleOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { getChineseInvoiceLifecycle } from '../../../utils/financeLifecycle';
import { renderRowActionsOverflow } from '../../../utils/renderRowActionsOverflow';
import {
  INVOICE_TYPE_OPTIONS,
  formatSalesInvoiceTypeZh,
  displaySalesInvoiceListCode,
  isUuidInvoiceCode,
} from '../../../utils/salesInvoiceUi';
import dayjs from 'dayjs';

interface SalesInvoice {
  id: number;
  invoice_code: string;
  customer_id: number;
  customer_name: string;
  sales_order_id?: number;
  sales_order_code?: string;
  invoice_number: string;
  invoice_date: string;
  invoice_type: string;
  tax_rate: number;
  invoice_amount: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  review_status: string;
  notes?: string;
  created_at: string;
  receivable_id?: number | null;
  receivable_code?: string | null;
}

const TAX_RATE_OPTIONS = [
  { label: '13%', value: 13 },
  { label: '9%', value: 9 },
  { label: '6%', value: 6 },
  { label: '1%', value: 1 },
  { label: '0%', value: 0 },
];

const SalesInvoicesPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const navigate = useNavigate();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [customerOptions, setCustomerOptions] = useState<{ label: string; value: number }[]>([]);
  const { message: messageApi } = App.useApp();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiRequest<unknown>('/apps/master-data/supply-chain/customers', { params: { limit: 1000, is_active: true } });
        const list = Array.isArray(res) ? res : (res as any)?.data ?? (res as any)?.items ?? [];
        setCustomerOptions((Array.isArray(list) ? list : []).map((c: any) => ({
          label: c.name || c.customer_name || c.code || String(c.id),
          value: c.id,
        })));
      } catch {
        setCustomerOptions([]);
      }
    };
    load();
  }, []);

  const handleCreate = async (values: any) => {
    const invoiceAmount = Number(values.invoice_amount) || 0;
    const taxRate = Number(values.tax_rate) || 13;
    const taxAmount = Number((invoiceAmount * taxRate / 100).toFixed(2));
    const totalAmount = Number((invoiceAmount + taxAmount).toFixed(2));
    const data = {
      customer_id: values.customer_id,
      customer_name: customerOptions.find(o => o.value === values.customer_id)?.label || '',
      invoice_number: String(values.invoice_number ?? '').trim(),
      invoice_date: values.invoice_date?.format ? values.invoice_date.format('YYYY-MM-DD') : (values.invoice_date || dayjs().format('YYYY-MM-DD')),
      invoice_type: values.invoice_type || '增值税专用发票',
      tax_rate: taxRate,
      invoice_amount: invoiceAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      notes: values.notes,
    };
    await apiRequest('/apps/kuaicaiwu/sales-invoices', { method: 'POST', data });
    messageApi.success('销售发票创建成功');
    setCreateModalVisible(false);
    actionRef.current?.reload();
  };

  const handleApprove = async (record: SalesInvoice) => {
    Modal.confirm({
      title: '审核销售发票',
      content: `确定审核通过发票 ${record.invoice_number?.trim() || displaySalesInvoiceListCode(record)}？`,
      onOk: async () => {
        try {
          await apiRequest(`/apps/kuaicaiwu/sales-invoices/${record.id}/approve`, { method: 'POST' });
          messageApi.success('审核通过');
          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.message || '操作失败');
        }
      },
    });
  };

  const handleDelete = async (record: SalesInvoice) => {
    Modal.confirm({
      title: '删除销售发票',
      content: `确定删除发票 ${record.invoice_number?.trim() || displaySalesInvoiceListCode(record)}？已审核的发票不能删除。`,
      onOk: async () => {
        try {
          await apiRequest(`/apps/kuaicaiwu/sales-invoices/${record.id}`, { method: 'DELETE' });
          messageApi.success('删除成功');
          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.message || '操作失败');
        }
      },
    });
  };

  const columns: ProColumns<SalesInvoice>[] = [
    {
      title: '发票编号',
      dataIndex: 'invoice_code',
      width: 120,
      fixed: 'left',
      render: (_, r) => {
        const shown = displaySalesInvoiceListCode(r);
        const copyText = isUuidInvoiceCode(r.invoice_code) ? shown : String(r.invoice_code ?? '');
        return (
          <Typography.Text copyable={copyText ? { text: copyText } : false} ellipsis={{ tooltip: shown }}>
            {shown}
          </Typography.Text>
        );
      },
    },
    {
      title: '发票号码',
      dataIndex: 'invoice_number',
      width: 160,
      render: (_, r) => (r.invoice_number?.trim() ? r.invoice_number : '—'),
    },
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      width: 200,
    },
    {
      title: '发票类型',
      dataIndex: 'invoice_type',
      width: 140,
      render: (_, r) => formatSalesInvoiceTypeZh(r.invoice_type),
    },
    {
      title: '开票日期',
      dataIndex: 'invoice_date',
      valueType: 'date',
      width: 110,
    },
    {
      title: '税率(%)',
      dataIndex: 'tax_rate',
      width: 80,
      render: (_, r) => `${r.tax_rate}%`,
    },
    {
      title: '不含税金额',
      dataIndex: 'invoice_amount',
      valueType: 'money',
      align: 'right',
      width: 130,
    },
    {
      title: '税额',
      dataIndex: 'tax_amount',
      valueType: 'money',
      align: 'right',
      width: 110,
    },
    {
      title: '价税合计',
      dataIndex: 'total_amount',
      valueType: 'money',
      align: 'right',
      width: 130,
      render: (_, record) => (
        <span style={{ fontWeight: 'bold', color: '#1677ff' }}>
          ¥{Number(record.total_amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      title: '关联应收',
      dataIndex: 'receivable_code',
      width: 140,
      hideInSearch: true,
      render: (_, r) =>
        r.receivable_id != null && r.receivable_id !== undefined ? (
          <Typography.Link onClick={() => navigate(`/apps/kuaicaiwu/finance-management/receivables/${r.receivable_id}`)}>
            {r.receivable_code || `#${r.receivable_id}`}
          </Typography.Link>
        ) : (
          '—'
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      hideInTable: true,
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      hideInTable: true,
      valueEnum: {
        待审核: { text: '待审核' },
        已审核: { text: '已审核' },
        已驳回: { text: '已驳回' },
        已作废: { text: '已作废' },
        已红冲: { text: '已红冲' },
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 168,
      hideInSearch: true,
      render: (_, r) => (r.created_at ? dayjs(r.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      fixed: 'right',
      align: 'left',
      width: 130,
      hideInSearch: true,
      render: (_, record) => {
        const lc = getChineseInvoiceLifecycle(record as unknown as Record<string, unknown>);
        return (
          <UniLifecycle
            percent={lc.percent}
            stageName={lc.stageName}
            status={lc.status}
            subStages={lc.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 200,
      render: (_, record) =>
        renderRowActionsOverflow(
          [
            <Button
              key="det"
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/apps/kuaicaiwu/finance-management/sales-invoices/${record.id}`)}
            >
              详情
            </Button>,
            record.review_status === '待审核' ? (
              <Button key="ap" type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleApprove(record)}>
                审核
              </Button>
            ) : null,
            ['未审核', 'DRAFT'].includes(String(record.status || '')) ? (
              <Button key="del" type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
                删除
              </Button>
            ) : null,
          ].filter(Boolean) as React.ReactNode[],
          `si-${record.id}`,
        ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<SalesInvoice>
        headerTitle="销售发票"
        actionRef={actionRef}
        rowKey="id"
        columnPersistenceId="kuaicaiwu-finance-sales-invoices"
        scroll={{ x: 1800 }}
        showAdvancedSearch
        search={{ labelWidth: 120 }}
        showCreateButton
        createButtonText="新建销售发票"
        onCreate={() => setCreateModalVisible(true)}
        request={async (params) => {
          const { current, pageSize, ...rest } = params;
          const res = await apiRequest<any>('/apps/kuaicaiwu/sales-invoices', {
            params: {
              skip: ((current || 1) - 1) * (pageSize || 20),
              limit: pageSize || 20,
              ...rest,
            },
          });
          return {
            data: res?.items || [],
            total: res?.total || 0,
            success: true,
          };
        }}
        columns={columns}
      />

      <ModalForm
        title="开具销售发票"
        open={createModalVisible}
        onOpenChange={setCreateModalVisible}
        onFinish={handleCreate}
        width={520}
      >
        <ProFormSelect
          name="customer_id"
          label="客户"
          options={customerOptions}
          rules={[{ required: true, message: '请选择客户' }]}
          placeholder="请选择客户"
          showSearch
        />
        <ProFormText
          name="invoice_number"
          label="发票号码"
          placeholder="可选，取得纸质/电子票面号码后填写"
        />
        <ProFormSelect
          name="invoice_type"
          label="发票类型"
          options={INVOICE_TYPE_OPTIONS}
          initialValue="增值税专用发票"
          rules={[{ required: true }]}
        />
        <ProFormDatePicker name="invoice_date" label="开票日期" rules={[{ required: true }]} initialValue={dayjs()} fieldProps={{ style: { width: '100%' } }} />
        <ProFormSelect
          name="tax_rate"
          label="税率"
          options={TAX_RATE_OPTIONS}
          initialValue={13}
          rules={[{ required: true }]}
        />
        <ProFormDigit
          name="invoice_amount"
          label="不含税金额"
          min={0}
          rules={[{ required: true, message: '请输入不含税金额' }]}
          fieldProps={{ precision: 2, style: { width: '100%' } }}
        />
        <ProFormTextArea name="notes" label="备注" />
      </ModalForm>
    </ListPageTemplate>
  );
};

export default SalesInvoicesPage;
