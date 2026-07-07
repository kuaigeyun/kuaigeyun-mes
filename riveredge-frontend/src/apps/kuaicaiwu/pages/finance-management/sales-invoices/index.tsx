/**
 * 销售发票列表页
 *
 * 管理向客户开具的销项发票，支持关联销售订单和应收单。
 */
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Typography, Space, Dropdown, Tag, Alert, Spin, Table, Empty } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ModalForm, ProFormDatePicker, ProFormDigit, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { CheckCircleOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, DownOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
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
import { buildKuaicaiwuPullCreateMenuItems, getKuaicaiwuDocumentAction } from '../../../constants/documentActionRegistry';
import {
  salesInvoiceService,
  type SalesInvoicePullCandidate,
  type SalesInvoicePullPreview,
} from '../../../services/finance/sales-invoice';
import { salesInvoiceCapabilityReasonMessage } from '../../../utils/salesInvoiceCapabilityMessages';
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

type PullPreviewKind = 'sales_order' | 'sales_delivery';

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
  const [pullPreviewOpen, setPullPreviewOpen] = useState(false);
  const [pullPreviewLoading, setPullPreviewLoading] = useState(false);
  const [pullPreviewData, setPullPreviewData] = useState<SalesInvoicePullPreview | null>(null);
  const [pullPreviewSourceId, setPullPreviewSourceId] = useState<number | null>(null);
  const [pullPreviewKind, setPullPreviewKind] = useState<PullPreviewKind | null>(null);
  const pullFormRef = useRef<any>(null);
  const pullFromSalesOrderCloseRef = useRef<(() => void) | null>(null);
  const pullFromSalesDeliveryCloseRef = useRef<(() => void) | null>(null);
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

  const resetPullPreview = () => {
    setPullPreviewOpen(false);
    setPullPreviewSourceId(null);
    setPullPreviewData(null);
    setPullPreviewKind(null);
    pullFormRef.current?.resetFields();
  };

  const openPullPreview = async (kind: PullPreviewKind, sourceId: number) => {
    setPullPreviewKind(kind);
    setPullPreviewOpen(true);
    setPullPreviewLoading(true);
    setPullPreviewData(null);
    setPullPreviewSourceId(sourceId);
    try {
      const data =
        kind === 'sales_order'
          ? await salesInvoiceService.previewPullFromSalesOrder(sourceId)
          : await salesInvoiceService.previewPullFromSalesDelivery(sourceId);
      setPullPreviewData(data);
      const maxPush = Number(data.items?.[0]?.max_push_quantity ?? 0);
      const taxRate = 13;
      const defaultExcl = maxPush > 0 ? Number((maxPush / (1 + taxRate / 100)).toFixed(2)) : 0;
      const sourceLabel =
        kind === 'sales_order' ? pullFromSalesOrderAction.sourceLabel : pullFromSalesDeliveryAction.sourceLabel;
      pullFormRef.current?.setFieldsValue({
        source_code: data.source_code,
        customer_name: data.customer_name,
        invoice_date: dayjs(),
        invoice_type: '增值税专用发票',
        tax_rate: taxRate,
        invoice_amount: defaultExcl,
        notes: t(`${P}.pullNotes`, { source: sourceLabel, code: data.source_code }),
      });
    } catch (e: any) {
      messageApi.error(
        e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || t(`${P}.loadSourceFailed`),
      );
      resetPullPreview();
    } finally {
      setPullPreviewLoading(false);
    }
  };

  const pullFromSalesOrderQuery = useUniPullQuery<SalesInvoicePullCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    isRowDisabled: (record) => record.capabilities?.pull_sales_invoice?.allowed === false,
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const res = await salesInvoiceService.listSalesOrderPullCandidates({
          skip: (page - 1) * pageSize,
          limit: pageSize,
          keyword: keyword.trim() || undefined,
        });
        return { data: res.data || [], total: res.total ?? 0 };
      } catch (e: any) {
        messageApi.error(
          e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || t(`${P}.loadSourceFailed`),
        );
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys, rows) => {
      const selected = rows.find((x) => String(x.id) === String(keys[0]));
      if (!selected?.id) {
        messageApi.warning(t(`${P}.selectSource`, { label: pullFromSalesOrderAction.sourceLabel }));
        return;
      }
      pullFromSalesOrderCloseRef.current?.();
      await openPullPreview('sales_order', selected.id);
    },
  });
  pullFromSalesOrderCloseRef.current = pullFromSalesOrderQuery.closeModal;

  const pullFromSalesDeliveryQuery = useUniPullQuery<SalesInvoicePullCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    isRowDisabled: (record) => record.capabilities?.pull_sales_invoice?.allowed === false,
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const res = await salesInvoiceService.listSalesDeliveryPullCandidates({
          skip: (page - 1) * pageSize,
          limit: pageSize,
          keyword: keyword.trim() || undefined,
        });
        return { data: res.data || [], total: res.total ?? 0 };
      } catch (e: any) {
        messageApi.error(
          e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || t(`${P}.loadSourceFailed`),
        );
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys, rows) => {
      const selected = rows.find((x) => String(x.id) === String(keys[0]));
      if (!selected?.id) {
        messageApi.warning(t(`${P}.selectSource`, { label: pullFromSalesDeliveryAction.sourceLabel }));
        return;
      }
      pullFromSalesDeliveryCloseRef.current?.();
      await openPullPreview('sales_delivery', selected.id);
    },
  });
  pullFromSalesDeliveryCloseRef.current = pullFromSalesDeliveryQuery.closeModal;

  const handlePullCreateSubmit = async (values: any) => {
    if (!pullPreviewData || !pullPreviewSourceId || !pullPreviewKind) return false;
    if (pullPreviewData.has_blocking_issues) return false;
    const maxPush = Number(pullPreviewData.items?.[0]?.max_push_quantity ?? 0);
    const invoiceAmount = Number(values.invoice_amount) || 0;
    if (invoiceAmount <= 0) {
      messageApi.warning(t(`${P}.amountRequired`));
      return false;
    }
    const taxRate = Number(values.tax_rate) || 13;
    const taxAmount = Number((invoiceAmount * taxRate / 100).toFixed(2));
    const totalAmount = Number((invoiceAmount + taxAmount).toFixed(2));
    if (totalAmount > maxPush) {
      messageApi.warning(t(`${P}.pullExceedMax`, { max: maxPush.toFixed(2) }));
      return false;
    }
    const sourceLabel =
      pullPreviewKind === 'sales_order'
        ? pullFromSalesOrderAction.sourceLabel
        : pullFromSalesDeliveryAction.sourceLabel;
    setPullSubmitting(true);
    try {
      await apiRequest('/apps/kuaicaiwu/sales-invoices', {
        method: 'POST',
        data: {
          customer_id: pullPreviewData.customer_id,
          customer_name: pullPreviewData.customer_name || '',
          sales_order_id: pullPreviewData.sales_order_id ?? undefined,
          sales_order_code: pullPreviewData.sales_order_code ?? pullPreviewData.source_code,
          source_type: pullPreviewKind,
          source_id: pullPreviewSourceId,
          invoice_number: String(values.invoice_number ?? '').trim(),
          invoice_date: formatDateTime(values.invoice_date || dayjs(), 'YYYY-MM-DD'),
          invoice_type: values.invoice_type || '增值税专用发票',
          tax_rate: taxRate,
          invoice_amount: invoiceAmount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          notes: String(values.notes ?? '').trim() || t(`${P}.pullNotes`, { source: sourceLabel, code: pullPreviewData.source_code }),
          attachments: normalizeDocumentAttachments(values.attachments),
        },
      });
      messageApi.success(t(`${P}.pullCreateSuccess`, { target: pullFromSalesOrderAction.targetLabel }));
      resetPullPreview();
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
      { title: t(`${P}.pull.col.sourceCode`), dataIndex: 'code', width: 220, ellipsis: true },
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
    ],
    [t],
  );

  const pullPreviewMaxPush = Number(pullPreviewData?.items?.[0]?.max_push_quantity ?? 0);
  const formatPullMoney = (v: number) =>
    `¥${Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
  const pullPreviewTargetLabel =
    pullPreviewKind === 'sales_delivery'
      ? pullFromSalesDeliveryAction.targetLabel
      : pullFromSalesOrderAction.targetLabel;

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

      <UniPullQueryModal<SalesInvoicePullCandidate>
        open={pullFromSalesOrderQuery.open}
        title={pullFromSalesOrderAction.label}
        onCancel={pullFromSalesOrderQuery.closeModal}
        onOk={() => {
          void pullFromSalesOrderQuery.handleConfirm();
        }}
        rowKey="id"
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

      <UniPullQueryModal<SalesInvoicePullCandidate>
        open={pullFromSalesDeliveryQuery.open}
        title={pullFromSalesDeliveryAction.label}
        onCancel={pullFromSalesDeliveryQuery.closeModal}
        onOk={() => {
          void pullFromSalesDeliveryQuery.handleConfirm();
        }}
        rowKey="id"
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

      <Modal
        title={
          pullPreviewKind === 'sales_delivery'
            ? pullFromSalesDeliveryAction.label
            : pullFromSalesOrderAction.label
        }
        open={pullPreviewOpen}
        destroyOnClose
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        onCancel={resetPullPreview}
        okText={pullPreviewTargetLabel}
        cancelText={t('common.cancel')}
        confirmLoading={pullSubmitting}
        onOk={() => pullFormRef.current?.submit?.()}
        okButtonProps={{
          disabled:
            pullPreviewLoading ||
            !pullPreviewData ||
            !!pullPreviewData?.has_blocking_issues ||
            pullPreviewMaxPush <= 0,
        }}
      >
        {pullPreviewLoading ? (
          <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Spin />
            <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
          </div>
        ) : pullPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{pullPreviewData.summary}</p>
            {pullPreviewData.has_blocking_issues && pullPreviewData.blocking_reason ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={salesInvoiceCapabilityReasonMessage(pullPreviewData.blocking_reason, t)}
              />
            ) : null}
            {pullPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pullPreviewData.items}
                rowKey={(row) => String(row.item_id)}
                pagination={false}
                scroll={{ x: 720 }}
                columns={[
                  { title: t(`${P}.pull.col.sourceCode`), dataIndex: 'source_code', width: 140, ellipsis: true },
                  { title: t('app.kuaicaiwu.common.customer'), dataIndex: 'customer_name', width: 160, ellipsis: true },
                  {
                    title: t(`${P}.pull.col.docAmount`),
                    dataIndex: 'quantity',
                    width: 120,
                    align: 'right',
                    render: (v: number) => formatPullMoney(v),
                  },
                  {
                    title: t(`${P}.pull.col.invoicedAmount`),
                    dataIndex: 'pushed_quantity',
                    width: 120,
                    align: 'right',
                    render: (v: number) => formatPullMoney(v),
                  },
                  {
                    title: t(`${P}.pull.col.invoiceableAmount`),
                    dataIndex: 'max_push_quantity',
                    width: 120,
                    align: 'right',
                    render: (v: number) => formatPullMoney(v),
                  },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.purchaseReturn.pull.previewNoLines')} />
            )}
            {pullPreviewData.tip ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 16 }}>
                {pullPreviewData.tip}
              </Typography.Paragraph>
            ) : null}
            {!pullPreviewData.has_blocking_issues && pullPreviewMaxPush > 0 ? (
              <ModalForm
                formRef={pullFormRef}
                submitter={false}
                onFinish={handlePullCreateSubmit}
                layout="vertical"
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
            ) : null}
          </div>
        ) : null}
      </Modal>

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
