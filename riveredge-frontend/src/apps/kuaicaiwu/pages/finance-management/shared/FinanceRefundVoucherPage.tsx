/**
 * 收款退款 / 付款退款共享列表页
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ProForm,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Modal, Spin, Alert, Table, Empty, Form } from 'antd';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { FinanceVoucherDetailDrawer } from '../shared/FinanceVoucherDetailDrawer';
import {
  financeAmountDigitFieldProps,
  financeColFull,
  financeColHalf,
  financeFormGridProps,
} from '../../../utils/financeFormLayout';
import {
  UniPullQueryModal,
  filterByPullScope,
  paginatePullRows,
  renderPullQueryReviewStatus,
  UNI_PULL_QUERY_MAX_FETCH_LIMIT,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import { UniPullLoadButton } from '../../../../../components/uni-pull';
import { buildKuaicaiwuPullCreateMenuItems, getKuaicaiwuDocumentAction } from '../../../constants/documentActionRegistry';
import { getStatusDisplay } from '../../../../kuaizhizao/constants/documentStatus';
import { financeRefundCapabilityReasonMessage } from '../../../utils/financeRefundCapabilityMessages';
import { getFinanceVoucherLifecycle } from '../../../utils/financeLifecycle';
import {
  buildVoucherStatusEnum,
  formatPaymentMethod,
  getPaymentMethodOptions,
  assertBankAccountForPaymentMethod,
  BANK_TRANSFER_PAYMENT_METHOD,
} from '../../../utils/financeSharedOptions';
import {
  LedgerAccountFormFields,
  resolveFinanceVoucherReferenceNote,
} from '../../../components/LedgerAccountFormFields';
import { formatSettlementType } from '../../../utils/financeUiLabels';
import { formatDateTime } from '../../../../../utils/format';
import { normalizeDocumentAttachments } from '../../../../kuaizhizao/utils/documentAttachments';
import DocumentAttachmentsField from '../../../../kuaizhizao/components/DocumentAttachmentsField';
import {
  financeDocCodePartnerSearchColumns,
  financeDocCreatedUpdatedColumns,
  resolveReceiptListParams,
  resolvePaymentListParams,
} from '../../../utils/financeListCore';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { rowActionKind } from '../../../../../components/uni-action';
import { bankAccountService, type BankAccount } from '../../../services/finance/bank-account';
import { apiRequest } from '../../../../../services/api';
import {
  receiptRefundService,
  type ReceiptRefundPullCandidate,
  type ReceiptRefundPullPreview,
  RECEIPT_REFUND_RESOURCE,
} from '../../../services/finance/receipt-refund';
import {
  paymentRefundService,
  type PaymentRefundPullCandidate,
  type PaymentRefundPullPreview,
  PAYMENT_REFUND_RESOURCE,
} from '../../../services/finance/payment-refund';
import type { ReceiptVoucher } from '../../../services/finance/receipt';
import type { PaymentVoucher } from '../../../services/finance/payment';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import {
  buildFinanceVoucherLinkHandlers,
  useFinanceVoucherDetail,
} from '../../../components/FinanceVoucherDetailProvider';

type RefundMode = 'receipt-refund' | 'payment-refund';
type RefundVoucher = ReceiptVoucher | PaymentVoucher;
type PullCandidate = ReceiptRefundPullCandidate | PaymentRefundPullCandidate;

type Props = {
  mode: RefundMode;
  columnPersistenceId: string;
};

const CONFIG = {
  'receipt-refund': {
    ns: 'app.kuaicaiwu.receiptRefund',
    resource: RECEIPT_REFUND_RESOURCE,
    partnerLabelKey: 'app.kuaicaiwu.common.customer',
    partnerIdField: 'customer_id' as const,
    partnerNameField: 'customer_name' as const,
    codeField: 'receipt_code',
    sourceCodeField: 'receipt_code' as const,
    dateField: 'receipt_date',
    pullCapabilityKey: 'pull_receipt_refund',
    pullActionKey: 'receipt_refund.pull_from_receipt' as const,
    noteDirection: 'receivable' as const,
    resolveListParams: resolveReceiptListParams,
    list: receiptRefundService.list,
    get: receiptRefundService.get,
    create: receiptRefundService.create,
    confirm: receiptRefundService.confirm,
    cancel: receiptRefundService.cancel,
    listPullCandidates: receiptRefundService.listPullCandidates,
    previewPull: receiptRefundService.previewPull,
    voucherKind: 'receipt' as const,
  },
  'payment-refund': {
    ns: 'app.kuaicaiwu.paymentRefund',
    resource: PAYMENT_REFUND_RESOURCE,
    partnerLabelKey: 'app.kuaicaiwu.common.supplier',
    partnerIdField: 'supplier_id' as const,
    partnerNameField: 'supplier_name' as const,
    codeField: 'payment_code',
    sourceCodeField: 'payment_code' as const,
    dateField: 'payment_date',
    pullCapabilityKey: 'pull_payment_refund',
    pullActionKey: 'payment_refund.pull_from_payment' as const,
    noteDirection: 'payable' as const,
    resolveListParams: resolvePaymentListParams,
    list: paymentRefundService.list,
    get: paymentRefundService.get,
    create: paymentRefundService.create,
    confirm: paymentRefundService.confirm,
    cancel: paymentRefundService.cancel,
    listPullCandidates: paymentRefundService.listPullCandidates,
    previewPull: paymentRefundService.previewPull,
    voucherKind: 'payment' as const,
  },
};

const FinanceRefundVoucherPage: React.FC<Props> = ({ mode, columnPersistenceId }) => {
  const cfg = CONFIG[mode];
  const NS = cfg.ns;
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { openFinanceVoucherDetail } = useFinanceVoucherDetail();
  const voucherLinkHandlers = useMemo(
    () =>
      buildFinanceVoucherLinkHandlers({
        openVoucher: openFinanceVoucherDetail,
        navigate,
      }),
    [navigate, openFinanceVoucherDetail],
  );
  const actionRef = useRef<ActionType>();
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const perms = useResourcePermissions(cfg.resource);
  const paymentMethodOptions = useMemo(() => getPaymentMethodOptions(t), [t]);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [partnerOptions, setPartnerOptions] = useState<{ label: string; value: number }[]>([]);
  const [pullPreviewOpen, setPullPreviewOpen] = useState(false);
  const [pullPreviewLoading, setPullPreviewLoading] = useState(false);
  const [pullPreviewData, setPullPreviewData] = useState<
    ReceiptRefundPullPreview | PaymentRefundPullPreview | null
  >(null);
  const [pullPreviewSourceId, setPullPreviewSourceId] = useState<number | null>(null);
  const [pullSubmitting, setPullSubmitting] = useState(false);
  const [pullForm] = Form.useForm();
  const pullCloseRef = useRef<(() => void) | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailRecord, setDetailRecord] = useState<RefundVoucher | null>(null);

  useEffect(() => {
    const partnerPath =
      mode === 'receipt-refund'
        ? '/apps/master-data/supply-chain/customers'
        : '/apps/master-data/supply-chain/suppliers';
    void apiRequest<unknown>(partnerPath, { params: { limit: 1000, is_active: true } }).then((res) => {
      const list = Array.isArray(res) ? res : (res as { data?: unknown[]; items?: unknown[] })?.data ?? (res as { items?: unknown[] })?.items ?? [];
      setPartnerOptions(
        (Array.isArray(list) ? list : []).map((p: Record<string, unknown>) => ({
          label: String(p.name || p.customer_name || p.supplier_name || p.code || p.id),
          value: Number(p.id),
        })),
      );
    });
    void bankAccountService.list({ limit: 200, is_active: true }).then((res) => setBankAccounts(res.data || []));
  }, [mode]);

  const resetPull = () => {
    setPullPreviewOpen(false);
    setPullPreviewData(null);
    setPullPreviewSourceId(null);
    pullForm.resetFields();
  };

  const openPullPreview = async (sourceId: number) => {
    setPullPreviewOpen(true);
    setPullPreviewLoading(true);
    setPullPreviewData(null);
    setPullPreviewSourceId(sourceId);
    try {
      const data = await cfg.previewPull(sourceId);
      setPullPreviewData(data);
      const maxPush = Number(data.items?.[0]?.max_push_quantity ?? 0);
      const dateKey = cfg.dateField;
      pullForm.setFieldsValue({
        source_code: data.source_code,
        [cfg.partnerIdField]: data[cfg.partnerIdField as keyof typeof data],
        [cfg.partnerNameField]: data[cfg.partnerNameField as keyof typeof data],
        total_amount: maxPush > 0 ? maxPush : undefined,
        [dateKey]: dayjs(),
        payment_method: BANK_TRANSFER_PAYMENT_METHOD,
        notes: t(`${NS}.defaultNote`, { code: data.source_code }),
      });
    } catch (e) {
      messageApi.error(getApiErrorMessage(e, t(`${NS}.loadSourceFailed`)));
      resetPull();
    } finally {
      setPullPreviewLoading(false);
    }
  };

  useEffect(() => {
    const pullSourceId = Number((location.state as { pullSourceId?: number } | null)?.pullSourceId ?? 0);
    if (!pullSourceId) return;
    void openPullPreview(pullSourceId);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const isPullSelectable = useCallback(
    (record: PullCandidate) => {
      const cap = record.capabilities as Record<string, { allowed?: boolean }> | undefined;
      return cap?.[cfg.pullCapabilityKey]?.allowed !== false;
    },
    [cfg.pullCapabilityKey],
  );

  const pullAction = getKuaicaiwuDocumentAction(cfg.pullActionKey);
  const capabilityNs =
    mode === 'receipt-refund' ? 'app.kuaicaiwu.receiptRefund' : 'app.kuaicaiwu.paymentRefund';

  const pullQueryScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const pullQuery = useUniPullQuery<PullCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions: pullQueryScopeOptions,
    defaultScope: 'pullable',
    isRowDisabled: (record) => !isPullSelectable(record),
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const res = await cfg.listPullCandidates({
          skip: 0,
          limit: UNI_PULL_QUERY_MAX_FETCH_LIMIT,
          keyword: keyword.trim() || undefined,
        });
        const rows = res.data || [];
        const filtered = filterByPullScope(rows, scope, isPullSelectable);
        return paginatePullRows(filtered, page, pageSize);
      } catch (e) {
        messageApi.error(getApiErrorMessage(e, t(`${NS}.loadSourceFailed`)));
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys, rows) => {
      const selected = rows.find((x) => String(x.id) === String(keys[0]));
      if (!selected?.id) {
        messageApi.warning(t(`${NS}.selectSource`));
        return;
      }
      pullCloseRef.current?.();
      await openPullPreview(selected.id);
    },
  });
  pullCloseRef.current = pullQuery.closeModal;

  const handlePullSubmit = async (values: Record<string, unknown>) => {
    if (!pullPreviewData || !pullPreviewSourceId) return false;
    if (pullPreviewData.has_blocking_issues) return false;
    try {
      assertBankAccountForPaymentMethod(values.payment_method as string, values.bank_account_id, t);
    } catch (e: unknown) {
      messageApi.warning((e as Error).message);
      return false;
    }
    const maxPush = Number(pullPreviewData.items?.[0]?.max_push_quantity ?? 0);
    const totalAmount = Number(values.total_amount) || 0;
    if (totalAmount <= 0 || totalAmount > maxPush) {
      messageApi.warning(t(`${NS}.amountExceedMax`, { max: maxPush.toFixed(2) }));
      return false;
    }
    setPullSubmitting(true);
    try {
      const dateKey = cfg.dateField;
      const payload = {
        [cfg.partnerIdField]: Number(
          pullPreviewData[cfg.partnerIdField as keyof typeof pullPreviewData] ||
            values[cfg.partnerIdField],
        ),
        [cfg.partnerNameField]: String(
          pullPreviewData[cfg.partnerNameField as keyof typeof pullPreviewData] ||
            values[cfg.partnerNameField] ||
            '',
        ),
        total_amount: totalAmount,
        [dateKey]: formatDateTime(values[dateKey] || dayjs(), 'YYYY-MM-DD'),
        payment_method: values.payment_method,
        bank_account_id: values.bank_account_id,
        bank_account: resolveFinanceVoucherReferenceNote(
          bankAccounts,
          values.payment_method as string,
          values.bank_account_id,
          values.bank_account as string,
        ),
        notes: String(values.notes ?? '').trim(),
        attachments: normalizeDocumentAttachments(values.attachments),
        source_type: mode === 'receipt-refund' ? 'receipt' : 'payment',
        source_id: pullPreviewSourceId,
      };
      await cfg.create(payload as never);
      messageApi.success(t(`${NS}.createSuccess`));
      resetPull();
      actionRef.current?.reload();
      return true;
    } catch (e) {
      messageApi.error(getApiErrorMessage(e, t('common.createFailed')));
      return false;
    } finally {
      setPullSubmitting(false);
    }
  };

  const openDetail = async (record: RefundVoucher) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailRecord(null);
    try {
      const detail = await cfg.get(record.id);
      setDetailRecord(detail);
    } catch (e) {
      setDetailError(getApiErrorMessage(e, t(`${NS}.loadDetailFailed`)));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleConfirm = (record: RefundVoucher) => {
    getAntdModal().confirm({
      title: t(`${NS}.confirmTitle`),
      content: t(`${NS}.confirmContent`, { code: (record as Record<string, string>)[cfg.codeField] }),
      onOk: async () => {
        try {
          await cfg.confirm(record.id);
          messageApi.success(t(`${NS}.confirmSuccess`));
          actionRef.current?.reload();
          if (detailRecord?.id === record.id) void openDetail(record);
        } catch (e) {
          messageApi.error(getApiErrorMessage(e, t(`${NS}.confirmFailed`)));
        }
      },
    });
  };

  const handleCancel = (record: RefundVoucher) => {
    getAntdModal().confirm({
      title: t(`${NS}.cancelTitle`),
      content: t(`${NS}.cancelContent`, { code: (record as Record<string, string>)[cfg.codeField] }),
      onOk: async () => {
        try {
          await cfg.cancel(record.id);
          messageApi.success(t(`${NS}.cancelSuccess`));
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error(getApiErrorMessage(e, t(`${NS}.cancelFailed`)));
        }
      },
    });
  };

  const pullPreviewMaxPush = Number(pullPreviewData?.items?.[0]?.max_push_quantity ?? 0);
  const formatPullMoney = (v: number) =>
    `¥${Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

  const pullTableColumns = useMemo(
    () => [
      {
        title: t(`${NS}.pullCol.sourceCode`),
        dataIndex: cfg.sourceCodeField,
        width: 168,
        ellipsis: true,
        render: (_: unknown, row: PullCandidate) =>
          String((row as Record<string, unknown>)[cfg.sourceCodeField] || row.code || '').trim() ||
          '-',
      },
      {
        title: t(cfg.partnerLabelKey),
        dataIndex: cfg.partnerNameField,
        ellipsis: true,
        render: (_: unknown, row: PullCandidate) =>
          String((row as Record<string, unknown>)[cfg.partnerNameField] ?? '').trim() || '-',
      },
      {
        title: t('app.kuaicaiwu.common.businessStatus'),
        dataIndex: 'source_status',
        width: 112,
        align: 'center' as const,
        render: (v: unknown) => {
          const { text, color } = getStatusDisplay(v);
          return text === '-' ? '-' : <MarkerTag color={color}>{text}</MarkerTag>;
        },
      },
      {
        title: t('app.kuaicaiwu.common.reviewStatus'),
        dataIndex: 'review_status',
        width: 112,
        align: 'center' as const,
        render: (v: unknown) => renderPullQueryReviewStatus(t, v),
      },
      {
        title: t(`${NS}.col.date`),
        dataIndex: 'source_date',
        width: 112,
        render: (v: unknown) => (v ? formatDateTime(String(v), 'YYYY-MM-DD') : '-'),
      },
      {
        title: t(`${NS}.pullCol.docAmount`),
        dataIndex: 'amount',
        width: 120,
        align: 'right' as const,
        render: (v: unknown) => formatPullMoney(Number(v || 0)),
      },
      {
        title: t(`${NS}.pullCol.refundedAmount`),
        dataIndex: 'refunded_amount',
        width: 120,
        align: 'right' as const,
        render: (v: unknown) => formatPullMoney(Number(v || 0)),
      },
      {
        title: t(`${NS}.pullCol.refundableAmount`),
        dataIndex: 'remaining_amount',
        width: 120,
        align: 'right' as const,
        render: (v: unknown) => formatPullMoney(Number(v || 0)),
      },
    ],
    [NS, cfg.partnerLabelKey, cfg.partnerNameField, cfg.sourceCodeField, t],
  );

  const columns: ProColumns<RefundVoucher>[] = useMemo(
    () => [
      ...financeDocCodePartnerSearchColumns({
        docCodeLabel: t(`${NS}.col.code`),
        docCodeField: cfg.codeField,
        partnerLabel: t(cfg.partnerLabelKey),
        partnerIdField: cfg.partnerIdField,
        partnerNameField: cfg.partnerNameField,
        partnerOptions,
      }),
      {
        title: t(`${NS}.col.code`),
        key: 'finance_doc_partner_stacked',
        dataIndex: cfg.codeField,
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        fixed: 'left',
        hideInSearch: true,
        sorter: true,
        render: (_, r) => (
          <UniTableStackedPrimaryCell
            primary={String((r as Record<string, string>)[cfg.partnerNameField] ?? '')}
            secondary={String((r as Record<string, string>)[cfg.codeField] ?? '')}
            onSecondaryClick={() => openDetail(r)}
          />
        ),
      },
      {
        title: t(`${NS}.col.amount`),
        dataIndex: 'total_amount',
        valueType: 'money',
        align: 'right',
        width: 130,
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t(`${NS}.col.date`),
        dataIndex: cfg.dateField,
        valueType: 'date',
        width: 110,
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t(`${NS}.col.date`),
        dataIndex: `${cfg.dateField}_range`,
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
      },
      {
        title: t(`${NS}.col.paymentMethod`),
        dataIndex: 'payment_method',
        width: 110,
        hideInSearch: true,
        render: (_, record) => formatPaymentMethod(record.payment_method, t),
      },
      {
        title: t(`${NS}.col.settlementType`),
        dataIndex: 'settlement_type',
        width: 100,
        hideInSearch: true,
        render: (_, record) => (
          <MarkerTag color="orange">{formatSettlementType(record.settlement_type, t)}</MarkerTag>
        ),
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        hideInTable: true,
        valueEnum: buildVoucherStatusEnum(t),
      },
      ...financeDocCreatedUpdatedColumns<RefundVoucher>(t),
      {
        title: t('app.kuaicaiwu.common.lifecycle'),
        key: 'lifecycle',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => {
          const lc = getFinanceVoucherLifecycle(record as Record<string, unknown>, t);
          return (
            <UniLifecycle
              percent={lc.percent}
              stageName={lc.stageName}
              status={lc.status}
              showLabel
              size="small"
              showCircleTooltip={false}
            />
          );
        },
      },
      {
        title: t('common.actions'),
        key: 'action',
        valueType: 'option',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => [
          <Button {...rowActionKind('read')} key="det" onClick={() => openDetail(record)}>
            {t('common.detail')}
          </Button>,
          record.status === 'Draft' && perms.canAction?.('audit') ? (
            <Button {...rowActionKind('audit')} key="cf" onClick={() => handleConfirm(record)}>
              {t('common.confirm')}
            </Button>
          ) : null,
          record.status === 'Draft' && perms.canAction?.('revoke') ? (
            <Button {...rowActionKind('danger')} key="ca" onClick={() => handleCancel(record)}>
              {t('common.void')}
            </Button>
          ) : null,
        ],
      },
    ],
    [t, cfg, partnerOptions, perms],
  );

  return (
    <ListPageTemplate helpViewConfig={undefined}>
      <UniTable<RefundVoucher>
        actionRef={actionRef}
        columnPersistenceId={columnPersistenceId}
        columns={columns}
        rowKey="id"
        headerTitle={undefined}
        toolBarRender={() => [
          perms.canCreate ? (
            <UniPullLoadButton
              key="pull-refund"
              compactKey="pull-refund"
              label={pullAction.label}
              type="primary"
              variant="solid"
              menuItems={buildKuaicaiwuPullCreateMenuItems([
                {
                  key: cfg.pullActionKey,
                  actionKey: cfg.pullActionKey,
                  onClick: () => pullQuery.openModal(),
                },
              ])}
            />
          ) : null,
        ]}
        request={async (params, sort) => {
          const listParams = cfg.resolveListParams(params, sort);
          lastListParamsRef.current = listParams;
          const res = await cfg.list(listParams as never);
          return { data: res.items || [], success: true, total: res.total || 0 };
        }}
      />

      <UniPullQueryModal<PullCandidate>
        open={pullQuery.open}
        title={pullAction.label}
        onCancel={pullQuery.closeModal}
        onOk={() => {
          void pullQuery.handleConfirm();
        }}
        rowKey="id"
        columns={pullTableColumns}
        dataSource={pullQuery.dataSource}
        loading={pullQuery.loading}
        confirmLoading={pullQuery.confirmLoading}
        selectionType={pullQuery.selectionType}
        selectedRowKeys={pullQuery.selectedRowKeys}
        selectedRows={pullQuery.selectedRows}
        onSelectedRowKeysChange={pullQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullQuery.isRowDisabled}
        getRowLabel={(row) =>
          String((row as Record<string, unknown>)[cfg.sourceCodeField] || row.code || row.id)
        }
        searchDraft={pullQuery.searchDraft}
        onSearchDraftChange={pullQuery.setSearchDraft}
        onSearchApply={pullQuery.handleSearchApply}
        onSearchClear={pullQuery.handleSearchClear}
        appliedKeyword={pullQuery.appliedKeyword}
        searchPlaceholder={t(`${NS}.pullSearchPlaceholder`)}
        page={pullQuery.page}
        pageSize={pullQuery.pageSize}
        total={pullQuery.total}
        onPageChange={pullQuery.handlePageChange}
        scopeOptions={pullQuery.scopeOptions}
        scope={pullQuery.scope}
        onScopeChange={pullQuery.handleScopeChange}
        okText={t('common.next')}
      />

      <Modal
        title={pullAction.label}
        open={pullPreviewOpen}
        onCancel={resetPull}
        destroyOnHidden
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        okText={pullAction.targetLabel}
        cancelText={t('common.cancel')}
        confirmLoading={pullSubmitting}
        okButtonProps={{
          disabled:
            pullPreviewLoading ||
            !pullPreviewData ||
            !!pullPreviewData?.has_blocking_issues ||
            pullPreviewMaxPush <= 0,
        }}
        onOk={() => pullForm.submit()}
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
                title={financeRefundCapabilityReasonMessage(
                  capabilityNs,
                  pullPreviewData.blocking_reason,
                  t,
                )}
              />
            ) : null}
            {pullPreviewData.items?.length ? (
              <Table
                size="small"
                dataSource={pullPreviewData.items}
                rowKey={(row) => String(row.item_id)}
                pagination={false}
                scroll={{ x: 720 }}
                columns={[
                  { title: t(`${NS}.pullCol.sourceCode`), dataIndex: 'source_code', width: 140, ellipsis: true },
                  {
                    title: t(cfg.partnerLabelKey),
                    dataIndex: mode === 'receipt-refund' ? 'customer_name' : 'supplier_name',
                    width: 160,
                    ellipsis: true,
                  },
                  {
                    title: t(`${NS}.pullCol.docAmount`),
                    dataIndex: 'quantity',
                    align: 'right',
                    width: 120,
                    render: (v: number) => formatPullMoney(v),
                  },
                  {
                    title: t(`${NS}.pullCol.refundedAmount`),
                    dataIndex: 'pushed_quantity',
                    align: 'right',
                    width: 120,
                    render: (v: number) => formatPullMoney(v),
                  },
                  {
                    title: t(`${NS}.pullCol.refundableAmount`),
                    dataIndex: 'max_push_quantity',
                    align: 'right',
                    width: 120,
                    render: (v: number) => formatPullMoney(v),
                  },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
            {!pullPreviewData.has_blocking_issues && pullPreviewMaxPush > 0 ? (
              <ProForm
                key={`pull-refund-${pullPreviewSourceId}`}
                form={pullForm}
                submitter={false}
                onFinish={handlePullSubmit}
                layout="vertical"
                {...financeFormGridProps}
              >
                <ProFormText name="source_code" label={t(`${NS}.pullCol.sourceCode`)} readonly colProps={financeColHalf} />
                <ProFormText name={cfg.partnerIdField} hidden />
                <ProFormText name={cfg.partnerNameField} label={t(cfg.partnerLabelKey)} readonly colProps={financeColHalf} />
                <ProFormDigit
                  name="total_amount"
                  label={t(`${NS}.col.amount`)}
                  min={0.01}
                  rules={[{ required: true }]}
                  fieldProps={financeAmountDigitFieldProps}
                  colProps={financeColHalf}
                />
                <ProFormDatePicker
                  name={cfg.dateField}
                  label={t(`${NS}.col.date`)}
                  rules={[{ required: true }]}
                  fieldProps={{ style: { width: '100%' } }}
                  colProps={financeColHalf}
                />
                <ProFormSelect
                  name="payment_method"
                  label={t(`${NS}.col.paymentMethod`)}
                  options={paymentMethodOptions}
                  rules={[{ required: true }]}
                  colProps={financeColHalf}
                />
                <LedgerAccountFormFields
                  accounts={bankAccounts}
                  accountLabel={t(`${NS}.bankAccount`)}
                  noteLabel={t(`${NS}.bankAccountNote`)}
                  acceptanceNoteDirection={cfg.noteDirection}
                  partnerFieldName={cfg.partnerIdField}
                />
                <ProFormTextArea name="notes" label={t('common.remark')} fieldProps={{ rows: 3 }} colProps={financeColFull} />
                <DocumentAttachmentsField
                  category={mode === 'receipt-refund' ? 'receipt_attachments' : 'payment_attachments'}
                />
              </ProForm>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <FinanceVoucherDetailDrawer
        kind={cfg.voucherKind}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailRecord(null);
        }}
        loading={detailLoading}
        error={detailError}
        record={detailRecord}
        onRetry={detailRecord ? () => openDetail(detailRecord) : undefined}
        bankAccountLabel={t(`${NS}.bankAccount`)}
        linkHandlers={voucherLinkHandlers}
        isRefund
        extra={
          detailRecord?.status === 'Draft' && perms.canAction?.('audit') ? (
            <Button {...rowActionKind('audit')} onClick={() => handleConfirm(detailRecord)}>
              {t('common.confirm')}
            </Button>
          ) : undefined
        }
      />
    </ListPageTemplate>
  );
};

export default FinanceRefundVoucherPage;
