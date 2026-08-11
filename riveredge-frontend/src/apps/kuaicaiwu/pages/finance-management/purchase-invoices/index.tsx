/**
 * 采购发票列表页
 */
import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Typography, Tag, Alert, Spin, Table, Empty, Form } from 'antd';
import { EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { apiRequest, formatApiErrorDetail } from '../../../../../services/api';
import {
  purchaseInvoiceService,
  type PurchaseInvoicePullCandidate,
  type PurchaseInvoicePullPreview,
} from '../../../services/finance/purchase-invoice';
import { PurchaseInvoice } from '../../../types/finance/purchase-invoice';
import { useNavigate, useLocation } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { UniAuditBatchMenuButton, createUniAuditBatchHandlers } from '../../../../../components/uni-batch';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import {
  UniPullQueryModal,
  filterByPullScope,
  paginatePullRows,
  UNI_PULL_QUERY_MAX_FETCH_LIMIT,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import { getChineseInvoiceLifecycle } from '../../../utils/financeLifecycle';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import {
  ModalForm,
  ProForm,
  ProFormDatePicker,
  ProFormDigit,
  ProFormRadio,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  convertInvoiceAmountBetweenModes,
  invoiceInclFromExcl,
  recalcEnteredAmountOnTaxRateChange,
  resolveInvoiceAmountsForSubmit,
  type InvoiceAmountInputMode,
} from '../../../utils/invoiceAmountInput';
import dayjs from 'dayjs';
import { buildKuaicaiwuPullCreateMenuItems, getKuaicaiwuDocumentAction } from '../../../constants/documentActionRegistry';
import DocumentAttachmentsField from '../../../../kuaizhizao/components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../../kuaizhizao/utils/documentAttachments';
import { getStatusDisplay } from '../../../../kuaizhizao/constants/documentStatus';
import { buildReviewStatusEnum, getChineseInvoiceTypeOptions } from '../../../utils/financeSharedOptions';
import { purchaseInvoiceCapabilityReasonMessage } from '../../../utils/purchaseInvoiceCapabilityMessages';
import { formatDateTime } from '../../../../../utils/format';
import {
  FINANCE_INVOICE_PINNED_REVIEW_FIELD,
  financeDocCodePartnerSearchColumns,
  financeDocCreatedUpdatedColumns,
  financeInvoiceNumberSearchColumn,
  resolvePurchaseInvoiceListParams,
} from '../../../utils/financeListCore';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import type { PurchaseInvoiceListParams } from '../../../types/finance/purchase-invoice';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';

const P = 'app.kuaicaiwu.purchaseInvoice';

function resolveApiErrorMessage(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { detail?: unknown } }; message?: string };
  return (
    formatApiErrorDetail(err?.response?.data?.detail)
    || err?.message
    || fallback
  );
}
const PURCHASE_INVOICE_RESOURCE = 'kuaicaiwu:purchase-invoice';

const TAX_RATE_OPTIONS = [
  { label: '13%', value: 13 },
  { label: '9%', value: 9 },
  { label: '6%', value: 6 },
  { label: '1%', value: 1 },
  { label: '0%', value: 0 },
];

type PullPreviewKind = 'purchase_order' | 'purchase_receipt' | 'payable';

const PurchaseInvoiceList: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [pullSubmitting, setPullSubmitting] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [tableRows, setTableRows] = useState<PurchaseInvoice[]>([]);
  const [pullPreviewOpen, setPullPreviewOpen] = useState(false);
  const [pullPreviewLoading, setPullPreviewLoading] = useState(false);
  const [pullPreviewData, setPullPreviewData] = useState<PurchaseInvoicePullPreview | null>(null);
  const [pullPreviewSourceId, setPullPreviewSourceId] = useState<number | null>(null);
  const [pullPreviewKind, setPullPreviewKind] = useState<PullPreviewKind | null>(null);
  const [pullForm] = Form.useForm();
  const pullAmountModeRef = useRef<InvoiceAmountInputMode>('tax_exclusive');
  const pullTaxRateRef = useRef<number>(13);
  const pullFromPurchaseOrderCloseRef = useRef<(() => void) | null>(null);
  const pullFromPurchaseReceiptCloseRef = useRef<(() => void) | null>(null);
  const pullFromPayableCloseRef = useRef<(() => void) | null>(null);
  const [supplierOptions, setSupplierOptions] = useState<{ label: string; value: number }[]>([]);
  const { message: messageApi } = App.useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const invoiceTypeOptions = useMemo(
    () => getChineseInvoiceTypeOptions(t, { includeOther: true, includeReceipt: false }),
    [t],
  );
  const pullFromPurchaseOrderAction = getKuaicaiwuDocumentAction('purchase_invoice.pull_from_purchase_order');
  const pullFromPurchaseReceiptAction = getKuaicaiwuDocumentAction('purchase_invoice.pull_from_purchase_receipt');
  const pullFromPayableAction = getKuaicaiwuDocumentAction('purchase_invoice.pull_from_payable');

  const purchaseInvoiceAuditEnabled = useAuditRequired('purchase_invoice', false);
  const purchaseInvoicePerms = useResourcePermissions(PURCHASE_INVOICE_RESOURCE);
  const purchaseInvoiceAuditBatchHandlers = useMemo(
    () => createUniAuditBatchHandlers('purchase_invoice'),
    [],
  );
  const selectedRecordsForBatch = useMemo(
    () => tableRows.filter((row) => row.id != null && selectedRowKeys.includes(row.id)),
    [tableRows, selectedRowKeys],
  );
  const handlePurchaseInvoiceAuditBatchSuccess = () => {
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  };

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

      const data: any = {
        supplier_id: values.supplier_id,
        supplier_name: supplierOptions.find((o) => o.value === values.supplier_id)?.label || '',
        invoice_number: values.invoice_number,
        invoice_date: formatDateTime(values.invoice_date || dayjs(), 'YYYY-MM-DD'),
        invoice_type: values.invoice_type || '增值税专用发票',
        tax_rate: taxRate,
        invoice_amount: invoiceAmount,
        notes: values.notes,
        status: '未审核',
        review_status: '草稿',
        attachments: normalizeDocumentAttachments(values.attachments),
      };

      await purchaseInvoiceService.create(data);
      messageApi.success(t(`${P}.createSuccess`));
      setCreateModalVisible(false);
      actionRef.current?.reload();
      return true;
    } catch (error: unknown) {
      messageApi.error(resolveApiErrorMessage(error, t(`${P}.registerFailed`)));
      return false;
    }
  };

  const resetPullPreview = () => {
    setPullPreviewOpen(false);
    setPullPreviewSourceId(null);
    setPullPreviewData(null);
    setPullPreviewKind(null);
    pullForm.resetFields();
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
          : kind === 'purchase_receipt'
            ? await purchaseInvoiceService.previewPullFromPurchaseReceipt(sourceId)
            : await purchaseInvoiceService.previewPullFromPayable(sourceId);
      setPullPreviewData(data);
    } catch (e: any) {
      messageApi.error(
        e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || t(`${P}.loadSourceFailed`),
      );
      resetPullPreview();
    } finally {
      setPullPreviewLoading(false);
    }
  };

  const isPullPurchaseInvoiceSelectable = useCallback(
    (record: PurchaseInvoicePullCandidate) => record.capabilities?.pull_purchase_invoice?.allowed !== false,
    [],
  );

  const pullQueryScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const pullFromPurchaseOrderQuery = useUniPullQuery<PurchaseInvoicePullCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions: pullQueryScopeOptions,
    defaultScope: 'pullable',
    isRowDisabled: (record) => !isPullPurchaseInvoiceSelectable(record),
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const res = await purchaseInvoiceService.listPurchaseOrderPullCandidates({
          skip: 0,
          limit: UNI_PULL_QUERY_MAX_FETCH_LIMIT,
          keyword: keyword.trim() || undefined,
        });
        const rows = res.data || [];
        const filtered = filterByPullScope(rows, scope, isPullPurchaseInvoiceSelectable);
        return paginatePullRows(filtered, page, pageSize);
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
    scopeOptions: pullQueryScopeOptions,
    defaultScope: 'pullable',
    isRowDisabled: (record) => !isPullPurchaseInvoiceSelectable(record),
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const res = await purchaseInvoiceService.listPurchaseReceiptPullCandidates({
          skip: 0,
          limit: UNI_PULL_QUERY_MAX_FETCH_LIMIT,
          keyword: keyword.trim() || undefined,
        });
        const rows = res.data || [];
        const filtered = filterByPullScope(rows, scope, isPullPurchaseInvoiceSelectable);
        return paginatePullRows(filtered, page, pageSize);
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

  const pullFromPayableQuery = useUniPullQuery<PurchaseInvoicePullCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions: pullQueryScopeOptions,
    defaultScope: 'pullable',
    isRowDisabled: (record) => !isPullPurchaseInvoiceSelectable(record),
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const res = await purchaseInvoiceService.listPayablePullCandidates({
          skip: 0,
          limit: UNI_PULL_QUERY_MAX_FETCH_LIMIT,
          keyword: keyword.trim() || undefined,
        });
        const rows = res.data || [];
        const filtered = filterByPullScope(rows, scope, isPullPurchaseInvoiceSelectable);
        return paginatePullRows(filtered, page, pageSize);
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
        messageApi.warning(t(`${P}.selectSource`, { label: pullFromPayableAction.sourceLabel }));
        return;
      }
      pullFromPayableCloseRef.current?.();
      await openPullPreview('payable', selected.id);
    },
  });
  pullFromPayableCloseRef.current = pullFromPayableQuery.closeModal;

  const handlePullCreateSubmit = async (values: any) => {
    if (!pullPreviewData || !pullPreviewSourceId || !pullPreviewKind) {
      messageApi.warning(t(`${P}.pullPreviewIncomplete`));
      return false;
    }
    if (pullPreviewData.has_blocking_issues) {
      messageApi.warning(
        purchaseInvoiceCapabilityReasonMessage(pullPreviewData.blocking_reason, t)
          || t(`${P}.pullPreviewBlocked`),
      );
      return false;
    }
    const maxPush = Number(pullPreviewData.items?.[0]?.max_push_quantity ?? 0);
    const enteredAmount = Number(values.invoice_amount) || 0;
    if (enteredAmount <= 0) {
      messageApi.warning(t(`${P}.amountRequired`));
      return false;
    }
    const taxRate = Number(values.tax_rate) || 13;
    const amountMode = (values.amount_input_mode || 'tax_exclusive') as InvoiceAmountInputMode;
    const { invoiceAmountExcl: invoiceAmount, totalIncl: estimatedTotal } = resolveInvoiceAmountsForSubmit(
      enteredAmount,
      taxRate,
      amountMode,
    );
    if (estimatedTotal > maxPush) {
      messageApi.warning(t(`${P}.pullExceedMax`, { max: maxPush.toFixed(2) }));
      return false;
    }
    const sourceLabel =
      pullPreviewKind === 'purchase_order'
        ? pullFromPurchaseOrderAction.sourceLabel
        : pullPreviewKind === 'purchase_receipt'
          ? pullFromPurchaseReceiptAction.sourceLabel
          : pullFromPayableAction.sourceLabel;
    const targetLabel =
      pullPreviewKind === 'purchase_order'
        ? pullFromPurchaseOrderAction.targetLabel
        : pullPreviewKind === 'purchase_receipt'
          ? pullFromPurchaseReceiptAction.targetLabel
          : pullFromPayableAction.targetLabel;
    setPullSubmitting(true);
    try {
      await purchaseInvoiceService.create({
        purchase_order_id: pullPreviewData.purchase_order_id ?? undefined,
        purchase_order_code: pullPreviewData.purchase_order_code ?? undefined,
        payable_id: pullPreviewKind === 'payable' ? pullPreviewSourceId : pullPreviewData.payable_id,
        payable_code: pullPreviewKind === 'payable' ? pullPreviewData.source_code : pullPreviewData.payable_code,
        supplier_id: Number(pullPreviewData.supplier_id || 0),
        supplier_name: pullPreviewData.supplier_name || '',
        source_type: pullPreviewKind,
        source_id: pullPreviewSourceId,
        invoice_number: String(values.invoice_number ?? '').trim(),
        invoice_date: formatDateTime(values.invoice_date || dayjs(), 'YYYY-MM-DD'),
        invoice_type: values.invoice_type || '增值税专用发票',
        tax_rate: taxRate,
        invoice_amount: invoiceAmount,
        notes:
          String(values.notes ?? '').trim() ||
          t('app.kuaicaiwu.common.createdFromSourceNote', {
            source: sourceLabel,
            code: pullPreviewData.source_code,
          }),
        status: '未审核',
        review_status: '草稿',
        attachments: normalizeDocumentAttachments(values.attachments),
      });
      messageApi.success(t(`${P}.pullCreateSuccess`, { target: targetLabel }));
      resetPullPreview();
      actionRef.current?.reload();
      return true;
    } catch (e: unknown) {
      messageApi.error(resolveApiErrorMessage(e, t('common.createFailed')));
      return false;
    } finally {
      setPullSubmitting(false);
    }
  };

  const reviewStatusEnum = useMemo(() => buildReviewStatusEnum(t), [t]);

  const columns: ProColumns<PurchaseInvoice>[] = useMemo(
    () => [
      ...financeDocCodePartnerSearchColumns({
        docCodeLabel: t(`${P}.col.code`),
        docCodeField: 'invoice_code',
        partnerLabel: t('app.kuaicaiwu.common.supplier'),
        partnerIdField: 'supplier_id',
        partnerNameField: 'supplier_name',
        partnerOptions: supplierOptions,
      }),
      financeInvoiceNumberSearchColumn(t(`${P}.col.invoiceNumber`)),
      {
        title: t(`${P}.col.code`),
        dataIndex: 'invoice_code',
        width: 168,
        fixed: 'left',
        hideInSearch: true,
        sorter: true,
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
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('app.kuaicaiwu.common.supplier'),
        dataIndex: 'supplier_name',
        width: 200,
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t(`${P}.col.invoiceNumber`),
        dataIndex: 'invoice_number',
        width: 120,
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t(`${P}.col.totalAmount`),
        dataIndex: 'total_amount',
        valueType: 'money',
        align: 'right',
        width: 120,
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('app.kuaicaiwu.common.invoiceDate'),
        dataIndex: 'invoice_date',
        valueType: 'date',
        width: 120,
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('app.kuaicaiwu.common.invoiceDate'),
        dataIndex: 'invoice_date_range',
        valueType: 'dateRange',
        hideInTable: true,
        order: 20,
        formItemProps: formDateRangeFormItemProps,
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        hideInTable: true,
        order: 21,
      },
      {
        title: t('app.kuaicaiwu.common.reviewStatus'),
        dataIndex: 'review_status',
        hideInTable: true,
        order: 22,
        valueEnum: reviewStatusEnum,
      },
      ...financeDocCreatedUpdatedColumns<PurchaseInvoice>(t),
      {
        title: t('app.kuaicaiwu.common.lifecycle'),
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
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
            <UniWorkflowActions
              {...rowActionKind('skip')}
              key="wf"
              record={record}
              apiPrefix="/apps/kuaicaiwu/purchase-invoices"
              entityType="purchase_invoice"
              entityName={t(`${P}.entityName`)}
              statusField="status"
              reviewStatusField="review_status"
              draftStatuses={['草稿', 'draft']}
              pendingStatuses={['待审核']}
              approvedStatuses={['已审核']}
              rejectedStatuses={['已驳回', '驳回']}
              theme="link"
              size="small"
              onSuccess={() => actionRef.current?.reload()}
            />,
          ].filter(Boolean) as React.ReactNode[],
      },
    ],
    [t, navigate, supplierOptions, reviewStatusEnum],
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
      : pullPreviewKind === 'payable'
        ? pullFromPayableAction.targetLabel
        : pullFromPurchaseOrderAction.targetLabel;

  const pullFormInitialValues = useMemo(() => {
    if (!pullPreviewData || !pullPreviewKind) return undefined;
    const maxPush = Number(pullPreviewData.items?.[0]?.max_push_quantity ?? 0);
    const taxRate = 13;
    const defaultExcl = maxPush > 0 ? Number((maxPush / (1 + taxRate / 100)).toFixed(2)) : undefined;
    const sourceLabel =
      pullPreviewKind === 'purchase_order'
        ? pullFromPurchaseOrderAction.sourceLabel
        : pullPreviewKind === 'purchase_receipt'
          ? pullFromPurchaseReceiptAction.sourceLabel
          : pullFromPayableAction.sourceLabel;
    return {
      source_code: pullPreviewData.source_code,
      supplier_name: pullPreviewData.supplier_name,
      invoice_date: dayjs(),
      invoice_type: '增值税专用发票',
      tax_rate: taxRate,
      amount_input_mode: 'tax_exclusive' as InvoiceAmountInputMode,
      invoice_amount: defaultExcl,
      notes: t('app.kuaicaiwu.common.createdFromSourceNote', {
        source: sourceLabel,
        code: pullPreviewData.source_code,
      }),
    };
  }, [
    pullPreviewData,
    pullPreviewKind,
    pullFromPurchaseOrderAction.sourceLabel,
    pullFromPurchaseReceiptAction.sourceLabel,
    pullFromPayableAction.sourceLabel,
    t,
  ]);

  useEffect(() => {
    const pullPayableId = (location.state as { pullPayableId?: number } | null)?.pullPayableId;
    if (!pullPayableId) return;
    void openPullPreview('payable', pullPayableId);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!pullPreviewOpen || pullPreviewLoading || !pullFormInitialValues) return;
    pullAmountModeRef.current = 'tax_exclusive';
    pullTaxRateRef.current = Number(pullFormInitialValues.tax_rate) || 13;
    pullForm.setFieldsValue(pullFormInitialValues);
  }, [pullPreviewOpen, pullPreviewLoading, pullFormInitialValues, pullForm]);

  const pullAmountInputMode = Form.useWatch('amount_input_mode', pullForm) as InvoiceAmountInputMode | undefined;
  const pullTaxRateWatch = Form.useWatch('tax_rate', pullForm);
  const pullInvoiceAmountWatch = Form.useWatch('invoice_amount', pullForm);
  const pullAmountCounterpartHint = useMemo(() => {
    const entered = Number(pullInvoiceAmountWatch || 0);
    const taxRate = Number(pullTaxRateWatch) || 13;
    if (!(entered > 0)) return '';
    if ((pullAmountInputMode || 'tax_exclusive') === 'tax_inclusive') {
      const excl = resolveInvoiceAmountsForSubmit(entered, taxRate, 'tax_inclusive').invoiceAmountExcl;
      return t(`${P}.form.amountHintExcl`, { amount: excl.toFixed(2) });
    }
    return t(`${P}.form.amountHintIncl`, {
      amount: invoiceInclFromExcl(entered, taxRate).toFixed(2),
    });
  }, [pullAmountInputMode, pullInvoiceAmountWatch, pullTaxRateWatch, t]);

  const handlePullPreviewOk = async () => {
    if (pullPreviewLoading || !pullPreviewData) {
      messageApi.warning(t(`${P}.pullPreviewIncomplete`));
      return;
    }
    if (pullPreviewData.has_blocking_issues) {
      messageApi.warning(
        purchaseInvoiceCapabilityReasonMessage(pullPreviewData.blocking_reason, t)
          || t(`${P}.pullPreviewBlocked`),
      );
      return;
    }
    if (pullPreviewMaxPush <= 0) {
      messageApi.warning(t(`${P}.pullNoInvoiceableAmount`));
      return;
    }
    let values: Record<string, unknown>;
    try {
      values = await pullForm.validateFields();
    } catch {
      messageApi.warning(t(`${P}.pullFormValidationFailed`));
      return;
    }
    await handlePullCreateSubmit(values);
  };

  return (
    <ListPageTemplate>
      <UniTable<PurchaseInvoice>
        headerTitle={t(`${P}.pageTitle`)}
        actionRef={actionRef}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        onTableDataChange={setTableRows}
        columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
        columnPersistenceId="apps.kuaicaiwu.pages.finance-management.purchase-invoices"
        showAdvancedSearch
        request={async (params, sort, _filter, searchFormValues) => {
          const listParams = resolvePurchaseInvoiceListParams(searchFormValues, sort);
          lastListParamsRef.current = listParams;
          const apiParams: PurchaseInvoiceListParams = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            ...listParams,
          };
          try {
            const res = await purchaseInvoiceService.list(apiParams);
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
        skipFuzzyPinyinClientFilter
        pinnedTabsField={FINANCE_INVOICE_PINNED_REVIEW_FIELD}
        rowKey="id"
        showCreateButton={false}
        createButtonText={t(`${P}.createButton`)}
        onCreate={() => setCreateModalVisible(true)}
        toolBarActionsAfterBatch={[
          <UniAuditBatchMenuButton
            key="purchase-invoice-batch-audit"
            selectedRowKeys={selectedRowKeys}
            selectedRecords={selectedRecordsForBatch}
            auditEnabled={purchaseInvoiceAuditEnabled}
            permGates={purchaseInvoicePerms}
            handlers={purchaseInvoiceAuditBatchHandlers}
            onSuccess={handlePurchaseInvoiceAuditBatchSuccess}
            toolBarButtonSize="middle"
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
              {
                key: 'pull-from-payable',
                actionKey: 'purchase_invoice.pull_from_payable',
                onClick: pullFromPayableQuery.openModal,
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
        scopeOptions={pullFromPurchaseOrderQuery.scopeOptions}
        scope={pullFromPurchaseOrderQuery.scope}
        onScopeChange={pullFromPurchaseOrderQuery.handleScopeChange}
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
        scopeOptions={pullFromPurchaseReceiptQuery.scopeOptions}
        scope={pullFromPurchaseReceiptQuery.scope}
        onScopeChange={pullFromPurchaseReceiptQuery.handleScopeChange}
        okText={t('components.uniLifecycle.nextStep')}
        width={1180}
      />

      <UniPullQueryModal<PurchaseInvoicePullCandidate>
        open={pullFromPayableQuery.open}
        title={pullFromPayableAction.label}
        onCancel={pullFromPayableQuery.closeModal}
        onOk={() => {
          void pullFromPayableQuery.handleConfirm();
        }}
        rowKey="id"
        columns={pullTableColumns}
        dataSource={pullFromPayableQuery.dataSource}
        loading={pullFromPayableQuery.loading}
        confirmLoading={pullFromPayableQuery.confirmLoading}
        selectionType={pullFromPayableQuery.selectionType}
        selectedRowKeys={pullFromPayableQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromPayableQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromPayableQuery.isRowDisabled}
        searchDraft={pullFromPayableQuery.searchDraft}
        onSearchDraftChange={pullFromPayableQuery.setSearchDraft}
        onSearchApply={pullFromPayableQuery.handleSearchApply}
        onSearchClear={pullFromPayableQuery.handleSearchClear}
        appliedKeyword={pullFromPayableQuery.appliedKeyword}
        searchPlaceholder={t(`${P}.pull.searchPlaceholder`)}
        page={pullFromPayableQuery.page}
        pageSize={pullFromPayableQuery.pageSize}
        total={pullFromPayableQuery.total}
        onPageChange={pullFromPayableQuery.handlePageChange}
        scopeOptions={pullFromPayableQuery.scopeOptions}
        scope={pullFromPayableQuery.scope}
        onScopeChange={pullFromPayableQuery.handleScopeChange}
        okText={t('components.uniLifecycle.nextStep')}
        width={1180}
      />

      <Modal
        title={
          pullPreviewKind === 'purchase_receipt'
            ? pullFromPurchaseReceiptAction.label
            : pullPreviewKind === 'payable'
              ? pullFromPayableAction.label
              : pullFromPurchaseOrderAction.label
        }
        open={pullPreviewOpen}
        destroyOnClose
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        onCancel={resetPullPreview}
        okText={pullPreviewTargetLabel}
        cancelText={t('common.cancel')}
        confirmLoading={pullSubmitting}
        onOk={() => {
          void handlePullPreviewOk();
        }}
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
              <ProForm
                key={`pull-purchase-invoice-${pullPreviewKind}-${pullPreviewSourceId}`}
                form={pullForm}
                initialValues={pullFormInitialValues}
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
                  fieldProps={{
                    onChange: (nextRate: number) => {
                      const prevRate = pullTaxRateRef.current;
                      const mode = (pullForm.getFieldValue('amount_input_mode')
                        || 'tax_exclusive') as InvoiceAmountInputMode;
                      const current = Number(pullForm.getFieldValue('invoice_amount')) || 0;
                      const next = Number(nextRate) || 0;
                      if (current > 0) {
                        pullForm.setFieldValue(
                          'invoice_amount',
                          recalcEnteredAmountOnTaxRateChange(current, prevRate, next, mode),
                        );
                      }
                      pullTaxRateRef.current = next;
                    },
                  }}
                />
                <ProFormRadio.Group
                  name="amount_input_mode"
                  label={t(`${P}.form.amountInputMode`)}
                  options={[
                    { label: t(`${P}.form.amountModeExcl`), value: 'tax_exclusive' },
                    { label: t(`${P}.form.amountModeIncl`), value: 'tax_inclusive' },
                  ]}
                  fieldProps={{
                    onChange: (e) => {
                      const nextMode = e.target.value as InvoiceAmountInputMode;
                      const prevMode = pullAmountModeRef.current;
                      const taxRate = Number(pullForm.getFieldValue('tax_rate')) || 13;
                      const current = Number(pullForm.getFieldValue('invoice_amount')) || 0;
                      if (current > 0 && prevMode && prevMode !== nextMode) {
                        pullForm.setFieldValue(
                          'invoice_amount',
                          convertInvoiceAmountBetweenModes(current, taxRate, prevMode, nextMode),
                        );
                      }
                      pullAmountModeRef.current = nextMode;
                    },
                  }}
                />
                <ProFormDigit
                  name="invoice_amount"
                  label={
                    (pullAmountInputMode || 'tax_exclusive') === 'tax_inclusive'
                      ? t(`${P}.form.amountModeIncl`)
                      : t(`${P}.form.amountModeExcl`)
                  }
                  min={0}
                  rules={[{ required: true, message: t(`${P}.amountRequired`) }]}
                  extra={pullAmountCounterpartHint || undefined}
                  fieldProps={{ precision: 2, style: { width: '100%' } }}
                />
                <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} fieldProps={{ rows: 3 }} />
                <DocumentAttachmentsField category="purchase_invoice_attachments" />
              </ProForm>
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
