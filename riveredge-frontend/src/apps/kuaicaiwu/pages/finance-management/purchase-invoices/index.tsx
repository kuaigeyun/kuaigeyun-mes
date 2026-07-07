/**
 * 采购发票列表页
 */
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Typography, Tag, Alert, Spin, Table, Empty } from 'antd';
import { EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '../../../../../services/api';
import {
  purchaseInvoiceService,
  type PurchaseInvoicePullCandidate,
  type PurchaseInvoicePullPreview,
} from '../../../services/finance/purchase-invoice';
import { PurchaseInvoice } from '../../../types/finance/purchase-invoice';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import { getChineseInvoiceLifecycle } from '../../../utils/financeLifecycle';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { ModalForm, ProFormDatePicker, ProFormDigit, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import { buildKuaicaiwuPullCreateMenuItems, getKuaicaiwuDocumentAction } from '../../../constants/documentActionRegistry';
import DocumentAttachmentsField from '../../../../kuaizhizao/components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../../kuaizhizao/utils/documentAttachments';
import { getStatusDisplay } from '../../../../kuaizhizao/constants/documentStatus';
import { buildReviewStatusEnum, getChineseInvoiceTypeOptions } from '../../../utils/financeSharedOptions';
import { purchaseInvoiceCapabilityReasonMessage } from '../../../utils/purchaseInvoiceCapabilityMessages';
import { formatDateTime } from '../../../../../utils/format';

const P = 'app.kuaicaiwu.purchaseInvoice';

const TAX_RATE_OPTIONS = [
  { label: '13%', value: 13 },
  { label: '9%', value: 9 },
  { label: '6%', value: 6 },
  { label: '1%', value: 1 },
  { label: '0%', value: 0 },
];

type PullPreviewKind = 'purchase_order' | 'purchase_receipt';

const PurchaseInvoiceList: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [pullSubmitting, setPullSubmitting] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [pullPreviewOpen, setPullPreviewOpen] = useState(false);
  const [pullPreviewLoading, setPullPreviewLoading] = useState(false);
  const [pullPreviewData, setPullPreviewData] = useState<PurchaseInvoicePullPreview | null>(null);
  const [pullPreviewSourceId, setPullPreviewSourceId] = useState<number | null>(null);
  const [pullPreviewKind, setPullPreviewKind] = useState<PullPreviewKind | null>(null);
  const pullFormRef = useRef<any>(null);
  const pullFromPurchaseOrderCloseRef = useRef<(() => void) | null>(null);
  const pullFromPurchaseReceiptCloseRef = useRef<(() => void) | null>(null);
  const [supplierOptions, setSupplierOptions] = useState<{ label: string; value: number }[]>([]);
  const { message: messageApi } = App.useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invoiceTypeOptions = useMemo(
    () => getChineseInvoiceTypeOptions(t, { includeOther: true, includeReceipt: false }),
    [t],
  );
  const pullFromPurchaseOrderAction = getKuaicaiwuDocumentAction('purchase_invoice.pull_from_purchase_order');
  const pullFromPurchaseReceiptAction = getKuaicaiwuDocumentAction('purchase_invoice.pull_from_purchase_receipt');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiRequest<unknown>('/apps/master-data/supply-chain/suppliers', {
          params: { limit: 1000, is_active: true },
        });
        const list = Array.isArray(res) ? res : (res as any)?.data ?? (res as any)?.items ?? [];
        setSupplierOptions(
          (Array.isArray(list) ? list : []).map((s: any) => ({
            label: s.name || s.supplier_name || s.code || String(s.id),
            value: s.id,
          })),
        );
      } catch {
        setSupplierOptions([]);
      }
    };
    load();
  }, []);

  const handleRegister = async (values: any) => {
    try {
      const invoiceAmount = Number(values.invoice_amount) || 0;
      const taxRate = Number(values.tax_rate) || 13;
      const taxAmount = Number((invoiceAmount * taxRate / 100).toFixed(2));
      const totalAmount = Number((invoiceAmount + taxAmount).toFixed(2));

      const data: any = {
        supplier_id: values.supplier_id,
        supplier_name: supplierOptions.find((o) => o.value === values.supplier_id)?.label || '',
        invoice_number: values.invoice_number,
        invoice_date: formatDateTime(values.invoice_date || dayjs(), 'YYYY-MM-DD'),
        invoice_type: values.invoice_type || '增值税专用发票',
        tax_rate: taxRate,
        invoice_amount: invoiceAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        notes: values.notes,
        status: '未审核',
        review_status: '待审核',
        attachments: normalizeDocumentAttachments(values.attachments),
      };

      await purchaseInvoiceService.create(data);
      messageApi.success(t(`${P}.createSuccess`));
      setCreateModalVisible(false);
      actionRef.current?.reload();
      return true;
    } catch (error: any) {
      messageApi.error(error?.message || t(`${P}.registerFailed`));
      return false;
    }
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
        kind === 'purchase_order'
          ? await purchaseInvoiceService.previewPullFromPurchaseOrder(sourceId)
          : await purchaseInvoiceService.previewPullFromPurchaseReceipt(sourceId);
      setPullPreviewData(data);
      const maxPush = Number(data.items?.[0]?.max_push_quantity ?? 0);
      const taxRate = 13;
      const defaultExcl = maxPush > 0 ? Number((maxPush / (1 + taxRate / 100)).toFixed(2)) : 0;
      const sourceLabel =
        kind === 'purchase_order'
          ? pullFromPurchaseOrderAction.sourceLabel
          : pullFromPurchaseReceiptAction.sourceLabel;
      pullFormRef.current?.setFieldsValue({
        source_code: data.source_code,
        supplier_name: data.supplier_name,
        invoice_date: dayjs(),
        invoice_type: '增值税专用发票',
        tax_rate: taxRate,
        invoice_amount: defaultExcl,
        notes: t('app.kuaicaiwu.common.createdFromSourceNote', {
          source: sourceLabel,
          code: data.source_code,
        }),
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

  const pullFromPurchaseOrderQuery = useUniPullQuery<PurchaseInvoicePullCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    isRowDisabled: (record) => record.capabilities?.pull_purchase_invoice?.allowed === false,
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const res = await purchaseInvoiceService.listPurchaseOrderPullCandidates({
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
        messageApi.warning(t(`${P}.selectSource`, { label: pullFromPurchaseOrderAction.sourceLabel }));
        return;
      }
      pullFromPurchaseOrderCloseRef.current?.();
      await openPullPreview('purchase_order', selected.id);
    },
  });
  pullFromPurchaseOrderCloseRef.current = pullFromPurchaseOrderQuery.closeModal;

  const pullFromPurchaseReceiptQuery = useUniPullQuery<PurchaseInvoicePullCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    isRowDisabled: (record) => record.capabilities?.pull_purchase_invoice?.allowed === false,
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const res = await purchaseInvoiceService.listPurchaseReceiptPullCandidates({
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
        messageApi.warning(t(`${P}.selectSource`, { label: pullFromPurchaseReceiptAction.sourceLabel }));
        return;
      }
      pullFromPurchaseReceiptCloseRef.current?.();
      await openPullPreview('purchase_receipt', selected.id);
    },
  });
  pullFromPurchaseReceiptCloseRef.current = pullFromPurchaseReceiptQuery.closeModal;

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
      pullPreviewKind === 'purchase_order'
        ? pullFromPurchaseOrderAction.sourceLabel
        : pullFromPurchaseReceiptAction.sourceLabel;
    setPullSubmitting(true);
    try {
      await purchaseInvoiceService.create({
        purchase_order_id: pullPreviewData.purchase_order_id ?? undefined,
        purchase_order_code: pullPreviewData.purchase_order_code ?? undefined,
        supplier_id: Number(pullPreviewData.supplier_id || 0),
        supplier_name: pullPreviewData.supplier_name || '',
        source_type: pullPreviewKind,
        source_id: pullPreviewSourceId,
        invoice_number: String(values.invoice_number ?? '').trim(),
        invoice_date: formatDateTime(values.invoice_date || dayjs(), 'YYYY-MM-DD'),
        invoice_type: values.invoice_type || '增值税专用发票',
        tax_rate: taxRate,
        invoice_amount: invoiceAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        notes:
          String(values.notes ?? '').trim() ||
          t('app.kuaicaiwu.common.createdFromSourceNote', {
            source: sourceLabel,
            code: pullPreviewData.source_code,
          }),
        status: '未审核',
        review_status: '待审核',
        attachments: normalizeDocumentAttachments(values.attachments),
      });
      messageApi.success(t(`${P}.pullCreateSuccess`, { target: pullFromPurchaseOrderAction.targetLabel }));
      resetPullPreview();
      actionRef.current?.reload();
      return true;
    } catch (e: any) {
      messageApi.error(
        e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || t('common.createFailed'),
      );
      return false;
    } finally {
      setPullSubmitting(false);
    }
  };

  const handleBatchApprove = async (keys: React.Key[]) => {
    try {
      for (const id of keys) {
        await purchaseInvoiceService.approve(Number(id));
      }
      messageApi.success(t(`${P}.batchApproveSuccess`, { count: keys.length }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaicaiwu.common.batchApproveFailed'));
    }
  };

  const columns: ProColumns<PurchaseInvoice>[] = useMemo(
    () => [
      {
        title: t(`${P}.col.code`),
        dataIndex: 'invoice_code',
        width: 168,
        fixed: 'left',
        render: (_, entity) => (
          <Typography.Text copyable={{ text: String(entity.invoice_code ?? '') }} ellipsis>
            <a onClick={() => navigate(`/apps/kuaicaiwu/finance-management/purchase-invoices/${entity.id}`)}>
              {entity.invoice_code}
            </a>
          </Typography.Text>
        ),
      },
      {
        title: t(`${P}.col.purchaseOrder`),
        dataIndex: 'purchase_order_code',
        width: 150,
      },
      {
        title: t('app.kuaicaiwu.common.supplier'),
        dataIndex: 'supplier_name',
        width: 200,
      },
      {
        title: t(`${P}.col.invoiceNumber`),
        dataIndex: 'invoice_number',
        width: 120,
      },
      {
        title: t(`${P}.col.totalAmount`),
        dataIndex: 'total_amount',
        valueType: 'money',
        align: 'right',
        width: 120,
      },
      {
        title: t('app.kuaicaiwu.common.invoiceDate'),
        dataIndex: 'invoice_date',
        valueType: 'date',
        width: 120,
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
        valueEnum: buildReviewStatusEnum(t),
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
        render: (_, record) =>
          [
            <Button
              {...rowActionKind('read')}
              key="det"
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/apps/kuaicaiwu/finance-management/purchase-invoices/${record.id}`)}
            >
              {t('common.detail')}
            </Button>,
            record.review_status === '待审核' ? (
              <UniWorkflowActions
                {...rowActionKind('skip')}
                key="wf"
                record={record}
                entityName={t(`${P}.entityName`)}
                statusField="status"
                reviewStatusField="review_status"
                draftStatuses={[]}
                pendingStatuses={['待审核']}
                approvedStatuses={['已审核', '通过']}
                rejectedStatuses={['已驳回', '驳回']}
                theme="link"
                size="small"
                onSuccess={() => actionRef.current?.reload()}
              />
            ) : null,
          ].filter(Boolean) as React.ReactNode[],
      },
    ],
    [t, navigate],
  );

  const pullTableColumns = useMemo(
    () => [
      { title: t(`${P}.pull.col.sourceCode`), dataIndex: 'code', width: 220, ellipsis: true },
      { title: t('app.kuaicaiwu.common.supplier'), dataIndex: 'supplier_name', width: 220, ellipsis: true },
      {
        title: t(`${P}.pull.col.docStatus`),
        dataIndex: 'source_status',
        width: 130,
        align: 'center' as const,
        render: (v: unknown) => {
          const { text, color } = getStatusDisplay(v);
          return text === '-' ? '-' : <Tag color={color}>{text}</Tag>;
        },
      },
      {
        title: t('app.kuaicaiwu.common.businessDate'),
        dataIndex: 'source_date',
        width: 130,
        render: (v: unknown) => (v ? formatDateTime(String(v), 'YYYY-MM-DD') : '-'),
      },
      {
        title: t(`${P}.col.amount`),
        dataIndex: 'amount',
        width: 140,
        align: 'right' as const,
        render: (v: unknown) => `¥${Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
      },
    ],
    [t],
  );

  const pullPreviewMaxPush = Number(pullPreviewData?.items?.[0]?.max_push_quantity ?? 0);
  const formatPullMoney = (v: number) =>
    `¥${Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
  const pullPreviewTargetLabel =
    pullPreviewKind === 'purchase_receipt'
      ? pullFromPurchaseReceiptAction.targetLabel
      : pullFromPurchaseOrderAction.targetLabel;

  return (
    <ListPageTemplate>
      <UniTable<PurchaseInvoice>
        headerTitle={t(`${P}.pageTitle`)}
        actionRef={actionRef}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        columns={columns}
        columnPersistenceId="apps.kuaicaiwu.pages.finance-management.purchase-invoices"
        scroll={{ x: 1600 }}
        showAdvancedSearch
        request={async (params) => {
          const { current, pageSize, ...rest } = params;
          try {
            const res = await purchaseInvoiceService.list({
              skip: ((current || 1) - 1) * (pageSize || 20),
              limit: pageSize || 20,
              ...rest,
            });
            return {
              data: res.items || [],
              total: res.total || 0,
              success: true,
            };
          } catch (error: any) {
            messageApi.error(error?.message || t('app.kuaicaiwu.common.loadListFailed'));
            return { data: [], total: 0, success: false };
          }
        }}
        rowKey="id"
        showCreateButton={false}
        createButtonText={t(`${P}.createButton`)}
        onCreate={() => setCreateModalVisible(true)}
        toolBarActionsAfterBatch={[
          <UniBatchMenuButton
            key="purchase-invoice-batch-actions"
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
            compactKey="create-purchase-invoice-with-pull"
            createIcon={<PlusOutlined />}
            createLabel={t(`${P}.createButton`)}
            onCreate={() => setCreateModalVisible(true)}
            menuItems={buildKuaicaiwuPullCreateMenuItems([
              {
                key: 'pull-from-po',
                actionKey: 'purchase_invoice.pull_from_purchase_order',
                onClick: pullFromPurchaseOrderQuery.openModal,
              },
              {
                key: 'pull-from-pr',
                actionKey: 'purchase_invoice.pull_from_purchase_receipt',
                onClick: pullFromPurchaseReceiptQuery.openModal,
              },
            ])}
          />,
        ]}
      />

      <UniPullQueryModal<PurchaseInvoicePullCandidate>
        open={pullFromPurchaseOrderQuery.open}
        title={pullFromPurchaseOrderAction.label}
        onCancel={pullFromPurchaseOrderQuery.closeModal}
        onOk={() => {
          void pullFromPurchaseOrderQuery.handleConfirm();
        }}
        rowKey="id"
        columns={pullTableColumns}
        dataSource={pullFromPurchaseOrderQuery.dataSource}
        loading={pullFromPurchaseOrderQuery.loading}
        confirmLoading={pullFromPurchaseOrderQuery.confirmLoading}
        selectionType={pullFromPurchaseOrderQuery.selectionType}
        selectedRowKeys={pullFromPurchaseOrderQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromPurchaseOrderQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromPurchaseOrderQuery.isRowDisabled}
        searchDraft={pullFromPurchaseOrderQuery.searchDraft}
        onSearchDraftChange={pullFromPurchaseOrderQuery.setSearchDraft}
        onSearchApply={pullFromPurchaseOrderQuery.handleSearchApply}
        onSearchClear={pullFromPurchaseOrderQuery.handleSearchClear}
        appliedKeyword={pullFromPurchaseOrderQuery.appliedKeyword}
        searchPlaceholder={t(`${P}.pull.searchPlaceholder`)}
        page={pullFromPurchaseOrderQuery.page}
        pageSize={pullFromPurchaseOrderQuery.pageSize}
        total={pullFromPurchaseOrderQuery.total}
        onPageChange={pullFromPurchaseOrderQuery.handlePageChange}
        okText={t('components.uniLifecycle.nextStep')}
        width={1180}
      />

      <UniPullQueryModal<PurchaseInvoicePullCandidate>
        open={pullFromPurchaseReceiptQuery.open}
        title={pullFromPurchaseReceiptAction.label}
        onCancel={pullFromPurchaseReceiptQuery.closeModal}
        onOk={() => {
          void pullFromPurchaseReceiptQuery.handleConfirm();
        }}
        rowKey="id"
        columns={pullTableColumns}
        dataSource={pullFromPurchaseReceiptQuery.dataSource}
        loading={pullFromPurchaseReceiptQuery.loading}
        confirmLoading={pullFromPurchaseReceiptQuery.confirmLoading}
        selectionType={pullFromPurchaseReceiptQuery.selectionType}
        selectedRowKeys={pullFromPurchaseReceiptQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromPurchaseReceiptQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromPurchaseReceiptQuery.isRowDisabled}
        searchDraft={pullFromPurchaseReceiptQuery.searchDraft}
        onSearchDraftChange={pullFromPurchaseReceiptQuery.setSearchDraft}
        onSearchApply={pullFromPurchaseReceiptQuery.handleSearchApply}
        onSearchClear={pullFromPurchaseReceiptQuery.handleSearchClear}
        appliedKeyword={pullFromPurchaseReceiptQuery.appliedKeyword}
        searchPlaceholder={t(`${P}.pull.searchPlaceholder`)}
        page={pullFromPurchaseReceiptQuery.page}
        pageSize={pullFromPurchaseReceiptQuery.pageSize}
        total={pullFromPurchaseReceiptQuery.total}
        onPageChange={pullFromPurchaseReceiptQuery.handlePageChange}
        okText={t('components.uniLifecycle.nextStep')}
        width={1180}
      />

      <Modal
        title={
          pullPreviewKind === 'purchase_receipt'
            ? pullFromPurchaseReceiptAction.label
            : pullFromPurchaseOrderAction.label
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
          <div
            style={{
              minHeight: 120,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <Spin />
            <div style={{ color: 'var(--ant-color-primary)' }}>
              {t('app.kuaizhizao.salesOrder.loadingPreview')}
            </div>
          </div>
        ) : pullPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{pullPreviewData.summary}</p>
            {pullPreviewData.has_blocking_issues && pullPreviewData.blocking_reason ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={purchaseInvoiceCapabilityReasonMessage(pullPreviewData.blocking_reason, t)}
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
                  { title: t('app.kuaicaiwu.common.supplier'), dataIndex: 'supplier_name', width: 160, ellipsis: true },
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
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('app.kuaizhizao.purchaseReturn.pull.previewNoLines')}
              />
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
                <ProFormText name="source_code" label={t('app.kuaicaiwu.common.sourceDoc')} readonly />
                <ProFormText name="supplier_name" label={t('app.kuaicaiwu.common.supplier')} readonly />
                <ProFormText
                  name="invoice_number"
                  label={t(`${P}.col.invoiceNumber`)}
                  rules={[{ required: true, message: t(`${P}.form.invoiceNumberRequired`) }]}
                  placeholder={t(`${P}.form.invoiceNumberPlaceholder`)}
                />
                <ProFormSelect
                  name="invoice_type"
                  label={t(`${P}.col.invoiceType`)}
                  options={invoiceTypeOptions}
                  rules={[{ required: true, message: t(`${P}.form.invoiceTypeRequired`) }]}
                />
                <ProFormDatePicker
                  name="invoice_date"
                  label={t('app.kuaicaiwu.common.invoiceDate')}
                  rules={[{ required: true, message: t(`${P}.form.invoiceDateRequired`) }]}
                  fieldProps={{ style: { width: '100%' } }}
                />
                <ProFormSelect
                  name="tax_rate"
                  label={t(`${P}.col.taxRate`)}
                  options={TAX_RATE_OPTIONS}
                  rules={[{ required: true, message: t(`${P}.form.taxRateRequired`) }]}
                />
                <ProFormDigit
                  name="invoice_amount"
                  label={t(`${P}.col.exclTax`)}
                  min={0}
                  rules={[{ required: true, message: t(`${P}.form.exTaxAmountRequired`) }]}
                  fieldProps={{ precision: 2, style: { width: '100%' } }}
                />
                <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} fieldProps={{ rows: 3 }} />
                <DocumentAttachmentsField category="purchase_invoice_attachments" />
              </ModalForm>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ModalForm
        title={t(`${P}.createTitle`)}
        open={createModalVisible}
        onOpenChange={setCreateModalVisible}
        onFinish={handleRegister}
        width={520}
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: '#8c8c8c', fontSize: '13px' }}>{t(`${P}.createHint`)}</p>
        </div>
        <ProFormSelect
          name="supplier_id"
          label={t('app.kuaicaiwu.common.supplier')}
          options={supplierOptions}
          rules={[{ required: true, message: t('app.kuaicaiwu.common.selectSupplier') }]}
          placeholder={t('app.kuaicaiwu.common.selectSupplier')}
          showSearch
        />
        <ProFormText
          name="invoice_number"
          label={t(`${P}.col.invoiceNumber`)}
          rules={[{ required: true, message: t(`${P}.form.invoiceNumberRequired`) }]}
          placeholder={t(`${P}.form.invoiceNumberPlaceholder`)}
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
        <ProFormDigit
          name="tax_rate"
          label={t(`${P}.col.taxRate`)}
          initialValue={13}
          min={0}
          max={100}
          rules={[{ required: true }]}
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormDigit
          name="invoice_amount"
          label={t(`${P}.col.exclTax`)}
          min={0}
          rules={[{ required: true, message: t(`${P}.form.exTaxAmountRequired`) }]}
          fieldProps={{ precision: 2, style: { width: '100%' } }}
        />
        <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} />
        <DocumentAttachmentsField category="purchase_invoice_attachments" />
      </ModalForm>
    </ListPageTemplate>
  );
};

export default PurchaseInvoiceList;
