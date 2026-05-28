/**
 * 销售发票列表页
 *
 * 管理向客户开具的销项发票，支持关联销售订单和应收单。
 */
import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Typography, Space, Dropdown, Input, Table, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ModalForm, ProFormDatePicker, ProFormDigit, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { CheckCircleOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, DownOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { getChineseInvoiceLifecycle } from '../../../utils/financeLifecycle';
import { renderRowActionsOverflow } from '../../../utils/renderRowActionsOverflow';
import {
  INVOICE_TYPE_OPTIONS,
  formatSalesInvoiceTypeZh,
  displaySalesInvoiceListCode,
  canDeleteSalesInvoice,
} from '../../../utils/salesInvoiceUi';
import dayjs from 'dayjs';
import { listSalesOrders } from '../../../../kuaizhizao/services/sales-order';
import { warehouseApi } from '../../../../kuaizhizao/services/warehouse-execution';
import { buildKuaicaiwuPullCreateMenuItems, getKuaicaiwuDocumentAction } from '../../../constants/documentActionRegistry';
import { getStatusDisplay } from '../../../../kuaizhizao/constants/documentStatus';

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

type PullInvoiceCandidate = {
  source_type: 'sales_order' | 'sales_delivery';
  source_id: number;
  source_code: string;
  customer_id?: number;
  customer_name?: string;
  source_date?: string;
  source_status?: string;
  amount?: number;
  converted?: boolean;
};

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
  const [pullVisible, setPullVisible] = useState(false);
  const [pullLoading, setPullLoading] = useState(false);
  const [pullSubmitting, setPullSubmitting] = useState(false);
  const [pullKeyword, setPullKeyword] = useState('');
  const [pullSourceType, setPullSourceType] = useState<'sales_order' | 'sales_delivery'>('sales_order');
  const [pullCandidates, setPullCandidates] = useState<PullInvoiceCandidate[]>([]);
  const [selectedPullSourceId, setSelectedPullSourceId] = useState<number | null>(null);
  const [pullFormVisible, setPullFormVisible] = useState(false);
  const [pullSelectedSource, setPullSelectedSource] = useState<PullInvoiceCandidate | null>(null);
  const [customerOptions, setCustomerOptions] = useState<{ label: string; value: number }[]>([]);
  const { message: messageApi } = App.useApp();
  const pullFromSalesOrderAction = getKuaicaiwuDocumentAction('sales_invoice.pull_from_sales_order');
  const pullFromSalesDeliveryAction = getKuaicaiwuDocumentAction('sales_invoice.pull_from_sales_delivery');

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

  const fetchExistingSourceCodesFromInvoices = async (): Promise<Set<string>> => {
    const codes = new Set<string>();
    const pageSize = 200;
    let skip = 0;
    let total = Infinity;
    while (skip < total) {
      const res = await apiRequest<any>('/apps/kuaicaiwu/sales-invoices', {
        params: { skip, limit: pageSize },
      });
      const items = res?.items || [];
      total = Number(res?.total ?? items.length);
      items.forEach((x: any) => {
        const code = String(x?.sales_order_code || '').trim();
        if (code) codes.add(code);
      });
      if (items.length < pageSize) break;
      skip += pageSize;
    }
    return codes;
  };

  const loadPullCandidates = async (sourceType: 'sales_order' | 'sales_delivery', keyword = '') => {
    setPullLoading(true);
    try {
      const kw = keyword.trim().toLowerCase();
      const existedCodes = await fetchExistingSourceCodesFromInvoices();

      if (sourceType === 'sales_order') {
        const orderRes = await listSalesOrders({ skip: 0, limit: 200, keyword: kw || undefined });
        const rows = (orderRes?.data || []).map((row: any) => {
          const code = String(row.order_code || row.code || row.id || '');
          const amount = Number(row.total_amount || 0);
          return {
            source_type: 'sales_order' as const,
            source_id: Number(row.id),
            source_code: code,
            customer_id: row.customer_id,
            customer_name: row.customer_name,
            source_date: row.order_date,
            source_status: row.status,
            amount,
            converted: existedCodes.has(code),
          };
        });
        setPullCandidates(rows.filter((r: PullInvoiceCandidate) => (kw ? `${r.source_code} ${r.customer_name || ''}`.toLowerCase().includes(kw) : true)));
      } else {
        const deliveryRes: any = await warehouseApi.salesDelivery.list({ skip: 0, limit: 200, keyword: kw || undefined });
        const rows = (Array.isArray(deliveryRes) ? deliveryRes : (deliveryRes?.data || [])).map((row: any) => {
          const code = String(row.delivery_code || row.code || row.id || '');
          const amount = Number(row.total_amount || 0);
          return {
            source_type: 'sales_delivery' as const,
            source_id: Number(row.id),
            source_code: code,
            customer_id: row.customer_id,
            customer_name: row.customer_name,
            source_date: row.delivery_date || row.delivery_time,
            source_status: row.status,
            amount,
            converted: existedCodes.has(code),
          };
        });
        setPullCandidates(rows.filter((r: PullInvoiceCandidate) => (kw ? `${r.source_code} ${r.customer_name || ''}`.toLowerCase().includes(kw) : true)));
      }
    } catch (e: any) {
      setPullCandidates([]);
      messageApi.error(e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || '加载来源单失败');
    } finally {
      setPullLoading(false);
    }
  };

  const openPullModal = async (sourceType: 'sales_order' | 'sales_delivery') => {
    setPullSourceType(sourceType);
    setPullKeyword('');
    setSelectedPullSourceId(null);
    setPullVisible(true);
    await loadPullCandidates(sourceType, '');
  };

  const handlePullNext = () => {
    if (!selectedPullSourceId) {
      messageApi.warning(`请选择${pullSourceType === 'sales_order' ? pullFromSalesOrderAction.sourceLabel : pullFromSalesDeliveryAction.sourceLabel}`);
      return;
    }
    const selected = pullCandidates.find((x) => x.source_id === selectedPullSourceId);
    if (!selected) return;
    if (selected.converted) {
      messageApi.warning(`该${pullSourceType === 'sales_order' ? pullFromSalesOrderAction.sourceLabel : pullFromSalesDeliveryAction.sourceLabel}已创建${pullFromSalesOrderAction.targetLabel}，请勿重复创建`);
      return;
    }
    const invoiceAmount = Number(selected.amount || 0);
    if (invoiceAmount <= 0) {
      messageApi.warning(`源单据金额为 0，无法创建${pullFromSalesOrderAction.targetLabel}`);
      return;
    }
    setPullSelectedSource(selected);
    setPullVisible(false);
    setPullFormVisible(true);
  };

  const handlePullCreateSubmit = async (values: any) => {
    if (!pullSelectedSource) return false;
    const invoiceAmount = Number(values.invoice_amount) || 0;
    if (invoiceAmount <= 0) {
      messageApi.warning('不含税金额必须大于 0');
      return false;
    }
    const taxRate = Number(values.tax_rate) || 13;
    const taxAmount = Number((invoiceAmount * taxRate / 100).toFixed(2));
    const totalAmount = Number((invoiceAmount + taxAmount).toFixed(2));
    const sourceLabel = pullSelectedSource.source_type === 'sales_order'
      ? pullFromSalesOrderAction.sourceLabel
      : pullFromSalesDeliveryAction.sourceLabel;
    setPullSubmitting(true);
    try {
      await apiRequest('/apps/kuaicaiwu/sales-invoices', {
        method: 'POST',
        data: {
          customer_id: pullSelectedSource.customer_id,
          customer_name: pullSelectedSource.customer_name || '',
          sales_order_code: pullSelectedSource.source_code,
          invoice_number: String(values.invoice_number ?? '').trim(),
          invoice_date: values.invoice_date?.format
            ? values.invoice_date.format('YYYY-MM-DD')
            : (values.invoice_date || dayjs().format('YYYY-MM-DD')),
          invoice_type: values.invoice_type || '增值税专用发票',
          tax_rate: taxRate,
          invoice_amount: invoiceAmount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          notes: String(values.notes ?? '').trim() || `从${sourceLabel} ${pullSelectedSource.source_code} 创建`,
        },
      });
      messageApi.success(`已创建${pullFromSalesOrderAction.targetLabel}`);
      setPullFormVisible(false);
      setPullSelectedSource(null);
      setSelectedPullSourceId(null);
      actionRef.current?.reload();
      return true;
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || '创建失败');
      return false;
    } finally {
      setPullSubmitting(false);
    }
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
      title: '发票号码',
      dataIndex: 'invoice_number',
      width: 160,
      fixed: 'left',
      render: (_, r) => {
        const shown = r.invoice_number?.trim() || '—';
        const canLink = !!r.invoice_number?.trim();
        return canLink ? (
          <Typography.Text copyable={{ text: shown }} ellipsis={{ tooltip: shown }}>
            <a onClick={() => navigate(`/apps/kuaicaiwu/finance-management/sales-invoices/${r.id}`)}>{shown}</a>
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        );
      },
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
      dataIndex: 'lifecycle_stage',
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
            canDeleteSalesInvoice(record) ? (
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
        columnPersistenceId="apps.kuaicaiwu.pages.finance-management.sales-invoices"
        scroll={{ x: 1800 }}
        showAdvancedSearch
        search={{ labelWidth: 120 }}
        showCreateButton={false}
        createButtonText="新建销售发票"
        onCreate={() => setCreateModalVisible(true)}
        toolBarRender={() => [
          <UniPullCreateToolbar
            compactKey="create-sales-invoice-with-pull"
            createIcon={<PlusOutlined />}
            createLabel="新建销售发票"
            onCreate={() => setCreateModalVisible(true)}
            menuItems={buildKuaicaiwuPullCreateMenuItems([
              {
                key: 'pull-from-sales-order',
                actionKey: 'sales_invoice.pull_from_sales_order',
                onClick: () => {
                  void openPullModal('sales_order');
                },
              },
              {
                key: 'pull-from-sales-delivery',
                actionKey: 'sales_invoice.pull_from_sales_delivery',
                onClick: () => {
                  void openPullModal('sales_delivery');
                },
              },
            ])}
          />,
        ]}
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

      <Modal
        title={pullSourceType === 'sales_order' ? pullFromSalesOrderAction.label : pullFromSalesDeliveryAction.label}
        open={pullVisible}
        width={1180}
        onCancel={() => {
          if (pullSubmitting) return;
          setPullVisible(false);
          setSelectedPullSourceId(null);
        }}
        onOk={handlePullNext}
        okText="下一步"
        confirmLoading={false}
        destroyOnClose
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Input.Search
            allowClear
            placeholder="按单号/客户搜索"
            value={pullKeyword}
            onChange={(e) => setPullKeyword(e.target.value)}
            onSearch={(value) => {
              setPullKeyword(value);
              void loadPullCandidates(pullSourceType, value);
            }}
            enterButton="搜索"
          />
          <Table<PullInvoiceCandidate>
            rowKey={(r) => `${r.source_type}-${r.source_id}`}
            loading={pullLoading}
            dataSource={pullCandidates}
            pagination={false}
            scroll={{ x: 1100, y: 360 }}
            rowSelection={{
              type: 'radio',
              selectedRowKeys: selectedPullSourceId ? [`${pullSourceType}-${selectedPullSourceId}`] : [],
              onChange: (keys) => {
                const key = String(keys?.[0] || '');
                const id = Number(key.split('-').slice(-1)[0]);
                if (Number.isFinite(id)) setSelectedPullSourceId(id);
                else setSelectedPullSourceId(null);
              },
              getCheckboxProps: (record) => ({ disabled: !!record.converted }),
            }}
            onRow={(record) => ({
              onClick: () => {
                if (record.converted) return;
                setSelectedPullSourceId(record.source_id);
              },
            })}
            columns={[
              { title: '源单号', dataIndex: 'source_code', width: 220, ellipsis: true },
              { title: '客户', dataIndex: 'customer_name', width: 220, ellipsis: true },
              {
                title: '单据状态',
                dataIndex: 'source_status',
                width: 130,
                align: 'center',
                render: (v) => {
                  const { text, color } = getStatusDisplay(v);
                  return text === '-' ? '-' : <Tag color={color}>{text}</Tag>;
                },
              },
              { title: '业务日期', dataIndex: 'source_date', width: 130, render: (v) => (v ? dayjs(v).format('YYYY-MM-DD') : '-') },
              {
                title: '金额',
                dataIndex: 'amount',
                width: 140,
                align: 'right',
                render: (v) => `¥${Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
              },
              {
                title: '转单状态',
                key: 'convert_status',
                width: 140,
                align: 'center',
                render: (_, r) => (r.converted ? <Tag color="gold">已创建</Tag> : <Tag color="success">可创建</Tag>),
              },
            ]}
          />
        </Space>
      </Modal>

      <ModalForm
        title="填写销项发票信息"
        open={pullFormVisible}
        onOpenChange={(open) => {
          if (pullSubmitting) return;
          setPullFormVisible(open);
          if (!open) {
            setPullSelectedSource(null);
            setSelectedPullSourceId(null);
          }
        }}
        onFinish={handlePullCreateSubmit}
        width={560}
        modalProps={{ destroyOnClose: true }}
        submitter={{ submitButtonProps: { loading: pullSubmitting } }}
        initialValues={
          pullSelectedSource
            ? {
                source_code: pullSelectedSource.source_code,
                customer_name: pullSelectedSource.customer_name,
                invoice_date: pullSelectedSource.source_date ? dayjs(pullSelectedSource.source_date) : dayjs(),
                invoice_type: '增值税专用发票',
                tax_rate: 13,
                invoice_amount: pullSelectedSource.amount,
                notes: `从${
                  pullSelectedSource.source_type === 'sales_order'
                    ? pullFromSalesOrderAction.sourceLabel
                    : pullFromSalesDeliveryAction.sourceLabel
                } ${pullSelectedSource.source_code} 创建`,
              }
            : undefined
        }
      >
        <ProFormText name="source_code" label="来源单号" readonly />
        <ProFormText name="customer_name" label="客户" readonly />
        <ProFormText
          name="invoice_number"
          label="发票号码"
          placeholder="可选，取得纸质/电子票面号码后填写"
        />
        <ProFormSelect
          name="invoice_type"
          label="发票类型"
          options={INVOICE_TYPE_OPTIONS}
          rules={[{ required: true, message: '请选择发票类型' }]}
        />
        <ProFormDatePicker
          name="invoice_date"
          label="开票日期"
          rules={[{ required: true, message: '请选择开票日期' }]}
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormSelect
          name="tax_rate"
          label="税率"
          options={TAX_RATE_OPTIONS}
          rules={[{ required: true, message: '请选择税率' }]}
        />
        <ProFormDigit
          name="invoice_amount"
          label="不含税金额"
          min={0}
          rules={[{ required: true, message: '请输入不含税金额' }]}
          fieldProps={{ precision: 2, style: { width: '100%' } }}
        />
        <ProFormTextArea name="notes" label="备注" fieldProps={{ rows: 3 }} />
      </ModalForm>

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
