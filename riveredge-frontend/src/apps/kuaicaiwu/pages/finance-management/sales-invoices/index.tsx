/**
 * 销售发票列表页
 *
 * 管理向客户开具的销项发票，支持关联销售订单和应收单。
 */
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Typography, Space, Dropdown, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ModalForm, ProFormDatePicker, ProFormDigit, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { CheckCircleOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, DownOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import { getChineseInvoiceLifecycle } from '../../../utils/financeLifecycle';
import {
  buildReviewStatusEnum,
  formatChineseInvoiceType,
  getChineseInvoiceTypeOptions,
} from '../../../utils/financeSharedOptions';
import {
  displaySalesInvoiceListCode,
  canDeleteSalesInvoice,
} from '../../../utils/salesInvoiceUi';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { listSalesOrders } from '../../../../kuaizhizao/services/sales-order';
import { warehouseApi } from '../../../../kuaizhizao/services/warehouse-execution';
import { buildKuaicaiwuPullCreateMenuItems, getKuaicaiwuDocumentAction } from '../../../constants/documentActionRegistry';
import DocumentAttachmentsField from '../../../../kuaizhizao/components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../../kuaizhizao/utils/documentAttachments';
import { getStatusDisplay } from '../../../../kuaizhizao/constants/documentStatus';
import { formatDateTime } from '../../../../../utils/format';

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

const P = 'app.kuaicaiwu.salesInvoice';

const SalesInvoicesPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const invoiceTypeOptions = useMemo(() => getChineseInvoiceTypeOptions(t), [t]);
  const reviewStatusEnum = useMemo(
    () => ({
      ...buildReviewStatusEnum(t),
      已作废: { text: t('app.kuaicaiwu.financeLifecycle.voided') },
      已红冲: { text: t('app.kuaicaiwu.financeLifecycle.redFlushed') },
    }),
    [t],
  );
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SalesInvoice | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [pullSubmitting, setPullSubmitting] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
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
      invoice_date: formatDateTime(values.invoice_date || dayjs(), 'YYYY-MM-DD'),
      invoice_type: values.invoice_type || '增值税专用发票',
      tax_rate: taxRate,
      invoice_amount: invoiceAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      notes: values.notes,
      attachments: normalizeDocumentAttachments(values.attachments),
    };
    await apiRequest('/apps/kuaicaiwu/sales-invoices', { method: 'POST', data });
    messageApi.success(t(`${P}.createSuccess`));
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

  const loadPullCandidatesBySource = async (
    sourceType: 'sales_order' | 'sales_delivery',
    keyword: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: PullInvoiceCandidate[]; total: number }> => {
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
      const filtered = rows.filter((r: PullInvoiceCandidate) => (kw ? `${r.source_code} ${r.customer_name || ''}`.toLowerCase().includes(kw) : true));
      const start = (page - 1) * pageSize;
      return { data: filtered.slice(start, start + pageSize), total: filtered.length };
    }
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
    const filtered = rows.filter((r: PullInvoiceCandidate) => (kw ? `${r.source_code} ${r.customer_name || ''}`.toLowerCase().includes(kw) : true));
    const start = (page - 1) * pageSize;
    return { data: filtered.slice(start, start + pageSize), total: filtered.length };
  };

  const openPullFormFromRows = (
    sourceType: 'sales_order' | 'sales_delivery',
    keys: React.Key[],
    rows: PullInvoiceCandidate[],
    closeModal: () => void,
  ) => {
    const selected = rows.find((x) => String(x.source_id) === String(keys[0]));
    if (!selected) {
      messageApi.warning(t(`${P}.selectSource`, {
        label: sourceType === 'sales_order' ? pullFromSalesOrderAction.sourceLabel : pullFromSalesDeliveryAction.sourceLabel,
      }));
      return;
    }
    if (!selected) return;
    if (selected.converted) {
      messageApi.warning(t(`${P}.sourceConverted`, {
        source: sourceType === 'sales_order' ? pullFromSalesOrderAction.sourceLabel : pullFromSalesDeliveryAction.sourceLabel,
        target: pullFromSalesOrderAction.targetLabel,
      }));
      return;
    }
    const invoiceAmount = Number(selected.amount || 0);
    if (invoiceAmount <= 0) {
      messageApi.warning(t(`${P}.zeroAmount`, { target: pullFromSalesOrderAction.targetLabel }));
      return;
    }
    setPullSelectedSource(selected);
    closeModal();
    setPullFormVisible(true);
  };

  const pullFromSalesOrderQuery = useUniPullQuery<PullInvoiceCandidate>({
    rowKey: 'source_id',
    selectionType: 'radio',
    isRowDisabled: (record) => !!record.converted,
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        return await loadPullCandidatesBySource('sales_order', keyword, page, pageSize);
      } catch (e: any) {
        messageApi.error(e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || t(`${P}.loadSourceFailed`));
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys, rows) => {
      openPullFormFromRows('sales_order', keys, rows, pullFromSalesOrderQuery.closeModal);
    },
  });

  const pullFromSalesDeliveryQuery = useUniPullQuery<PullInvoiceCandidate>({
    rowKey: 'source_id',
    selectionType: 'radio',
    isRowDisabled: (record) => !!record.converted,
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        return await loadPullCandidatesBySource('sales_delivery', keyword, page, pageSize);
      } catch (e: any) {
        messageApi.error(e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || t(`${P}.loadSourceFailed`));
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys, rows) => {
      openPullFormFromRows('sales_delivery', keys, rows, pullFromSalesDeliveryQuery.closeModal);
    },
  });

  const handlePullCreateSubmit = async (values: any) => {
    if (!pullSelectedSource) return false;
    const invoiceAmount = Number(values.invoice_amount) || 0;
    if (invoiceAmount <= 0) {
      messageApi.warning(t(`${P}.amountRequired`));
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
          invoice_date: formatDateTime(values.invoice_date || dayjs(), 'YYYY-MM-DD'),
          invoice_type: values.invoice_type || '增值税专用发票',
          tax_rate: taxRate,
          invoice_amount: invoiceAmount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          notes: String(values.notes ?? '').trim() || t(`${P}.pullNotes`, { source: sourceLabel, code: pullSelectedSource.source_code }),
          attachments: normalizeDocumentAttachments(values.attachments),
        },
      });
      messageApi.success(t(`${P}.pullCreateSuccess`, { target: pullFromSalesOrderAction.targetLabel }));
      setPullFormVisible(false);
      setPullSelectedSource(null);
      actionRef.current?.reload();
      return true;
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || t('common.createFailed'));
      return false;
    } finally {
      setPullSubmitting(false);
    }
  };

  const handleApprove = async (record: SalesInvoice) => {
    Modal.confirm({
      title: t(`${P}.approveTitle`),
      content: t(`${P}.approveContent`, {
        number: record.invoice_number?.trim() || displaySalesInvoiceListCode(record),
      }),
      onOk: async () => {
        try {
          await apiRequest(`/apps/kuaicaiwu/sales-invoices/${record.id}/approve`, { method: 'POST' });
          messageApi.success(t(`${P}.approveSuccess`));
          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.message || t('common.operationFailed'));
        }
      },
    });
  };

  const handleDelete = async (record: SalesInvoice) => {
    Modal.confirm({
      title: t(`${P}.deleteTitle`),
      content: t(`${P}.deleteContent`, {
        number: record.invoice_number?.trim() || displaySalesInvoiceListCode(record),
      }),
      onOk: async () => {
        try {
          await apiRequest(`/apps/kuaicaiwu/sales-invoices/${record.id}`, { method: 'DELETE' });
          messageApi.success(t('common.deleteSuccess'));
          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.message || t('common.operationFailed'));
        }
      },
    });
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    try {
      for (const id of keys) {
        await apiRequest(`/apps/kuaicaiwu/sales-invoices/${id}`, { method: 'DELETE' });
      }
      messageApi.success(t(`${P}.batchDeleteSuccess`, { count: keys.length }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.batchDeleteFailed'));
    }
  };

  const handleBatchApprove = async (keys: React.Key[]) => {
    try {
      for (const id of keys) {
        await apiRequest(`/apps/kuaicaiwu/sales-invoices/${id}/approve`, { method: 'POST' });
      }
      messageApi.success(t(`${P}.batchApproveSuccess`, { count: keys.length }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaicaiwu.common.batchApproveFailed'));
    }
  };

  const openEditModal = (record: SalesInvoice) => {
    setEditingRecord(record);
    setEditVisible(true);
  };

  const handleEditSubmit = async (values: { invoice_number?: string }) => {
    if (!editingRecord) return false;
    setEditSubmitting(true);
    try {
      await apiRequest(`/apps/kuaicaiwu/sales-invoices/${editingRecord.id}`, {
        method: 'PUT',
        data: {
          invoice_number: String(values.invoice_number ?? '').trim(),
          attachments: normalizeDocumentAttachments(values.attachments),
        },
      });
      messageApi.success(t(`${P}.editNumberSuccess`));
      setEditVisible(false);
      setEditingRecord(null);
      actionRef.current?.reload();
      return true;
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || t('common.saveFailed'));
      return false;
    } finally {
      setEditSubmitting(false);
    }
  };

  const columns: ProColumns<SalesInvoice>[] = useMemo(
    () => [
      {
        title: t('app.kuaicaiwu.invoice.col.invoiceNumber'),
        dataIndex: 'invoice_number',
        width: 160,
        fixed: 'left',
        render: (_, r) => {
          const shown = r.invoice_number?.trim() || displaySalesInvoiceListCode(r);
          return (
            <Typography.Text copyable={{ text: shown }} ellipsis={{ tooltip: shown }}>
              <a onClick={() => navigate(`/apps/kuaicaiwu/finance-management/sales-invoices/${r.id}`)}>{shown}</a>
            </Typography.Text>
          );
        },
      },
      {
        title: t('app.kuaicaiwu.common.customer'),
        dataIndex: 'customer_name',
        width: 200,
      },
      {
        title: t(`${P}.col.invoiceType`),
        dataIndex: 'invoice_type',
        width: 140,
        render: (_, r) => formatChineseInvoiceType(r.invoice_type, t),
      },
      {
        title: t('app.kuaicaiwu.common.invoiceDate'),
        dataIndex: 'invoice_date',
        valueType: 'date',
        width: 110,
      },
      {
        title: t(`${P}.col.taxRate`),
        dataIndex: 'tax_rate',
        width: 80,
        render: (_, r) => `${r.tax_rate}%`,
      },
      {
        title: t(`${P}.col.exclTax`),
        dataIndex: 'invoice_amount',
        valueType: 'money',
        align: 'right',
        width: 130,
      },
      {
        title: t(`${P}.col.taxAmount`),
        dataIndex: 'tax_amount',
        valueType: 'money',
        align: 'right',
        width: 110,
      },
      {
        title: t('app.kuaicaiwu.invoice.col.totalAmount'),
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
        title: t(`${P}.col.linkedReceivable`),
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
        title: t('common.status'),
        dataIndex: 'status',
        hideInTable: true,
      },
      {
        title: t('app.kuaicaiwu.common.reviewStatus'),
        dataIndex: 'review_status',
        hideInTable: true,
        valueEnum: reviewStatusEnum,
      },
      {
        title: t('common.createdAt'),
        dataIndex: 'created_at',
        width: 168,
        hideInSearch: true,
        render: (_, r) => (r.created_at ? formatDateTime(r.created_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: t('app.kuaicaiwu.common.lifecycle'),
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        align: 'left',
        width: 130,
        hideInSearch: true,
        render: (_, record) => {
          const lc = getChineseInvoiceLifecycle(record as unknown as Record<string, unknown>, t);
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
        title: t('common.actions'),
        valueType: 'option',
        fixed: 'right',
        width: 200,
        render: (_, record) => [
          !['已审核', '已作废', '已红冲'].includes(String(record.status || '').trim()) ? (
            <Button {...rowActionKind('edit')} key="edit" onClick={() => openEditModal(record)}>
              {t(`${P}.fillNumber`)}
            </Button>
          ) : null,
          <Button {...rowActionKind('read')}
            key="det"
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/apps/kuaicaiwu/finance-management/sales-invoices/${record.id}`)}
          >
            {t('common.detail')}
          </Button>,
          record.review_status === '待审核' ? (
            <Button {...rowActionKind('audit')} key="ap" onClick={() => handleApprove(record)}>
              {t('components.uniAction.audit')}
            </Button>
          ) : null,
          canDeleteSalesInvoice(record) ? (
            <Button {...rowActionKind('delete')} key="del" onClick={() => handleDelete(record)}>
              {t('common.delete')}
            </Button>
          ) : null,
        ].filter(Boolean) as React.ReactNode[],
      },
    ],
    [t, navigate, reviewStatusEnum],
  );

  const pullTableColumns = useMemo(
    () => [
      { title: t(`${P}.pull.col.sourceCode`), dataIndex: 'source_code', width: 220, ellipsis: true },
      { title: t('app.kuaicaiwu.common.customer'), dataIndex: 'customer_name', width: 220, ellipsis: true },
      {
        title: t(`${P}.pull.col.docStatus`),
        dataIndex: 'source_status',
        width: 130,
        align: 'center' as const,
        render: (v: string) => {
          const { text, color } = getStatusDisplay(v);
          return text === '-' ? '-' : <Tag color={color}>{text}</Tag>;
        },
      },
      {
        title: t('app.kuaicaiwu.common.businessDate'),
        dataIndex: 'source_date',
        width: 130,
        render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t('app.kuaicaiwu.invoice.col.totalAmount'),
        dataIndex: 'amount',
        width: 140,
        align: 'right' as const,
        render: (v: number) => `¥${Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
      },
      {
        title: t(`${P}.pull.col.convertStatus`),
        key: 'convert_status',
        width: 140,
        align: 'center' as const,
        render: (_: unknown, r: PullInvoiceCandidate) =>
          r.converted ? <Tag color="gold">{t(`${P}.pull.converted`)}</Tag> : <Tag color="success">{t(`${P}.pull.convertible`)}</Tag>,
      },
    ],
    [t],
  );

  return (
    <ListPageTemplate>
      <UniTable<SalesInvoice>
        headerTitle={t(`${P}.pageTitle`)}
        actionRef={actionRef}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        rowKey="id"
        columnPersistenceId="apps.kuaicaiwu.pages.finance-management.sales-invoices"
        scroll={{ x: 1800 }}
        showAdvancedSearch
        search={{ labelWidth: 120 }}
        showCreateButton={false}
        createButtonText={t(`${P}.createTitle`)}
        onCreate={() => setCreateModalVisible(true)}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('app.kuaicaiwu.common.confirmBatchDelete')}
        deleteConfirmDescription={(count) => t(`${P}.batchDeleteConfirm`, { count })}
        toolBarActionsAfterDelete={[
          <UniBatchMenuButton
            key="sales-invoice-batch-actions"
            selectedRowKeys={selectedRowKeys}
            buttonText={t('components.uniBatch.batchActions')}
            menuItems={[
              {
                key: 'batch-approve',
                label: t('app.kuaicaiwu.common.batchApprove'),
                requireConfirm: true,
                confirmTitle: (count) => t(`${P}.batchApproveTitle`, { count }),
                confirmDescription: t('app.kuaicaiwu.common.batchOnlyPendingApprove'),
                onClick: handleBatchApprove,
              },
            ]}
          />,
        ]}
        toolBarRender={() => [
          <UniPullCreateToolbar
            compactKey="create-sales-invoice-with-pull"
            createIcon={<PlusOutlined />}
            createLabel={t(`${P}.createTitle`)}
            onCreate={() => setCreateModalVisible(true)}
            menuItems={buildKuaicaiwuPullCreateMenuItems([
              {
                key: 'pull-from-sales-order',
                actionKey: 'sales_invoice.pull_from_sales_order',
                onClick: () => {
                  pullFromSalesOrderQuery.openModal();
                },
              },
              {
                key: 'pull-from-sales-delivery',
                actionKey: 'sales_invoice.pull_from_sales_delivery',
                onClick: () => {
                  pullFromSalesDeliveryQuery.openModal();
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

      <UniPullQueryModal<PullInvoiceCandidate>
        open={pullFromSalesOrderQuery.open}
        title={pullFromSalesOrderAction.label}
        onCancel={pullFromSalesOrderQuery.closeModal}
        onOk={() => {
          void pullFromSalesOrderQuery.handleConfirm();
        }}
        rowKey="source_id"
        columns={pullTableColumns}
        dataSource={pullFromSalesOrderQuery.dataSource}
        loading={pullFromSalesOrderQuery.loading}
        confirmLoading={pullFromSalesOrderQuery.confirmLoading}
        selectionType={pullFromSalesOrderQuery.selectionType}
        selectedRowKeys={pullFromSalesOrderQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromSalesOrderQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromSalesOrderQuery.isRowDisabled}
        searchDraft={pullFromSalesOrderQuery.searchDraft}
        onSearchDraftChange={pullFromSalesOrderQuery.setSearchDraft}
        onSearchApply={pullFromSalesOrderQuery.handleSearchApply}
        onSearchClear={pullFromSalesOrderQuery.handleSearchClear}
        appliedKeyword={pullFromSalesOrderQuery.appliedKeyword}
        searchPlaceholder={t(`${P}.pull.searchPlaceholder`)}
        page={pullFromSalesOrderQuery.page}
        pageSize={pullFromSalesOrderQuery.pageSize}
        total={pullFromSalesOrderQuery.total}
        onPageChange={pullFromSalesOrderQuery.handlePageChange}
        okText={t('components.uniLifecycle.nextStep')}
      />

      <UniPullQueryModal<PullInvoiceCandidate>
        open={pullFromSalesDeliveryQuery.open}
        title={pullFromSalesDeliveryAction.label}
        onCancel={pullFromSalesDeliveryQuery.closeModal}
        onOk={() => {
          void pullFromSalesDeliveryQuery.handleConfirm();
        }}
        rowKey="source_id"
        columns={pullTableColumns}
        dataSource={pullFromSalesDeliveryQuery.dataSource}
        loading={pullFromSalesDeliveryQuery.loading}
        confirmLoading={pullFromSalesDeliveryQuery.confirmLoading}
        selectionType={pullFromSalesDeliveryQuery.selectionType}
        selectedRowKeys={pullFromSalesDeliveryQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromSalesDeliveryQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromSalesDeliveryQuery.isRowDisabled}
        searchDraft={pullFromSalesDeliveryQuery.searchDraft}
        onSearchDraftChange={pullFromSalesDeliveryQuery.setSearchDraft}
        onSearchApply={pullFromSalesDeliveryQuery.handleSearchApply}
        onSearchClear={pullFromSalesDeliveryQuery.handleSearchClear}
        appliedKeyword={pullFromSalesDeliveryQuery.appliedKeyword}
        searchPlaceholder={t(`${P}.pull.searchPlaceholder`)}
        page={pullFromSalesDeliveryQuery.page}
        pageSize={pullFromSalesDeliveryQuery.pageSize}
        total={pullFromSalesDeliveryQuery.total}
        onPageChange={pullFromSalesDeliveryQuery.handlePageChange}
        okText={t('components.uniLifecycle.nextStep')}
      />

      <ModalForm
        title={t(`${P}.pullFormTitle`)}
        open={pullFormVisible}
        onOpenChange={(open) => {
          if (pullSubmitting) return;
          setPullFormVisible(open);
          if (!open) {
            setPullSelectedSource(null);
          }
        }}
        onFinish={handlePullCreateSubmit}
        width={560}
        modalProps={{ destroyOnHidden: true }}
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
                notes: t(`${P}.pullNotes`, {
                  source:
                    pullSelectedSource.source_type === 'sales_order'
                      ? pullFromSalesOrderAction.sourceLabel
                      : pullFromSalesDeliveryAction.sourceLabel,
                  code: pullSelectedSource.source_code,
                }),
              }
            : undefined
        }
      >
        <ProFormText name="source_code" label={t(`${P}.form.sourceCode`)} readonly />
        <ProFormText name="customer_name" label={t('app.kuaicaiwu.common.customer')} readonly />
        <ProFormText
          name="invoice_number"
          label={t('app.kuaicaiwu.invoice.col.invoiceNumber')}
          placeholder={t(`${P}.form.invoiceNumberOptional`)}
        />
        <ProFormSelect
          name="invoice_type"
          label={t(`${P}.col.invoiceType`)}
          options={invoiceTypeOptions}
          rules={[{ required: true, message: t(`${P}.form.selectInvoiceType`) }]}
        />
        <ProFormDatePicker
          name="invoice_date"
          label={t('app.kuaicaiwu.common.invoiceDate')}
          rules={[{ required: true, message: t(`${P}.form.selectInvoiceDate`) }]}
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormSelect
          name="tax_rate"
          label={t(`${P}.form.taxRate`)}
          options={TAX_RATE_OPTIONS}
          rules={[{ required: true, message: t(`${P}.form.selectTaxRate`) }]}
        />
        <ProFormDigit
          name="invoice_amount"
          label={t(`${P}.col.exclTax`)}
          min={0}
          rules={[{ required: true, message: t(`${P}.amountRequired`) }]}
          fieldProps={{ precision: 2, style: { width: '100%' } }}
        />
        <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} fieldProps={{ rows: 3 }} />
        <DocumentAttachmentsField category="sales_invoice_attachments" />
      </ModalForm>

      <ModalForm
        title={
          editingRecord?.invoice_code
            ? t(`${P}.editNumberTitleWithCode`, { code: displaySalesInvoiceListCode(editingRecord) })
            : t(`${P}.editNumberTitle`)
        }
        open={editVisible}
        onOpenChange={(open) => {
          if (editSubmitting) return;
          setEditVisible(open);
          if (!open) setEditingRecord(null);
        }}
        onFinish={handleEditSubmit}
        width={480}
        modalProps={{ destroyOnHidden: true }}
        submitter={{ submitButtonProps: { loading: editSubmitting } }}
        initialValues={{
          invoice_number: editingRecord?.invoice_number || '',
          attachments: mapAttachmentsToUploadList((editingRecord as any)?.attachments),
        }}
      >
        <ProFormText
          name="invoice_number"
          label={t('app.kuaicaiwu.invoice.col.invoiceNumber')}
          rules={[{ required: true, message: t(`${P}.form.invoiceNumberRequired`) }]}
          placeholder={t(`${P}.form.invoiceNumberRequired`)}
        />
        <DocumentAttachmentsField category="sales_invoice_attachments" />
      </ModalForm>

      <ModalForm
        title={t(`${P}.createTitle`)}
        open={createModalVisible}
        onOpenChange={setCreateModalVisible}
        onFinish={handleCreate}
        width={520}
      >
        <ProFormSelect
          name="customer_id"
          label={t('app.kuaicaiwu.common.customer')}
          options={customerOptions}
          rules={[{ required: true, message: t('app.kuaicaiwu.common.selectCustomer') }]}
          placeholder={t('app.kuaicaiwu.common.selectCustomer')}
          showSearch
        />
        <ProFormText
          name="invoice_number"
          label={t('app.kuaicaiwu.invoice.col.invoiceNumber')}
          placeholder={t(`${P}.form.invoiceNumberOptional`)}
        />
        <ProFormSelect
          name="invoice_type"
          label={t(`${P}.col.invoiceType`)}
          options={invoiceTypeOptions}
          initialValue="增值税专用发票"
          rules={[{ required: true }]}
        />
        <ProFormDatePicker
          name="invoice_date"
          label={t('app.kuaicaiwu.common.invoiceDate')}
          rules={[{ required: true }]}
          initialValue={dayjs()}
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormSelect
          name="tax_rate"
          label={t(`${P}.form.taxRate`)}
          options={TAX_RATE_OPTIONS}
          initialValue={13}
          rules={[{ required: true }]}
        />
        <ProFormDigit
          name="invoice_amount"
          label={t(`${P}.col.exclTax`)}
          min={0}
          rules={[{ required: true, message: t(`${P}.amountRequired`) }]}
          fieldProps={{ precision: 2, style: { width: '100%' } }}
        />
        <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} />
        <DocumentAttachmentsField category="sales_invoice_attachments" />
      </ModalForm>
    </ListPageTemplate>
  );
};

export default SalesInvoicesPage;
