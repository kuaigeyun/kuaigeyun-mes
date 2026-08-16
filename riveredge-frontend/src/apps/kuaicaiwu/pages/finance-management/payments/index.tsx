/**
 * 付款单列表页
 *
 * 记录向供应商支付的款项，可用于核销应付单。
 */
import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Typography, Spin, Alert, Table, Empty, Form } from 'antd';
import { ModalForm, ProForm, ProFormDatePicker, ProFormMoney, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { PlusOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { DetailDrawerActions, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { FinanceVoucherDetailDrawer } from '../shared/FinanceVoucherDetailDrawer';
import { financeColFull, financeColHalf, financeFormGridProps } from '../../../utils/financeFormLayout';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import {
  UniPullQueryModal,
  filterByPullScope,
  paginatePullRows,
  renderPullQueryReviewStatus,
  UNI_PULL_QUERY_MAX_FETCH_LIMIT,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import dayjs from 'dayjs';
import { getFinanceVoucherLifecycle } from '../../../utils/financeLifecycle';
import {
  paymentService,
  type PaymentPullCandidate,
  type PaymentPullPreview,
  type PaymentVoucher,
  type PaymentListParams,
} from '../../../services/finance/payment';
import { buildKuaicaiwuPullCreateMenuItems, getKuaicaiwuDocumentAction } from '../../../constants/documentActionRegistry';
import {
  buildVoucherStatusEnum,
  formatPaymentMethod,
  getPaymentMethodOptions,
  getPaymentSettlementTypeOptions,
  assertBankAccountForPaymentMethod,
  formatBankAccountOptionLabel,
  BANK_TRANSFER_PAYMENT_METHOD,
  isAcceptanceBillPaymentMethod,
} from '../../../utils/financeSharedOptions';
import {
  LedgerAccountFormFields,
  resolveFinanceVoucherReferenceNote,
} from '../../../components/LedgerAccountFormFields';
import { linkAcceptanceNoteAfterVoucherCreate } from '../../../components/AcceptanceBillLinkFields';
import { financeNoteService, type FinanceNote } from '../../../services/finance/note';
import DocumentAttachmentsField from '../../../../kuaizhizao/components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../../kuaizhizao/utils/documentAttachments';
import { bankAccountService, type BankAccount } from '../../../services/finance/bank-account';
import { getStatusDisplay } from '../../../../kuaizhizao/constants/documentStatus';
import { paymentCapabilityReasonMessage } from '../../../utils/paymentCapabilityMessages';
import { formatDateTime } from '../../../../../utils/format';
import {
  FINANCE_DOC_PINNED_STATUS_FIELD,
  financeDocCodePartnerSearchColumns,
  financeDocCreatedUpdatedColumns,
  resolvePaymentListParams,
} from '../../../utils/financeListCore';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { getAntdModal } from '../../../../../utils/antdAppApis';
type PullPayableCandidate = PaymentPullCandidate;

const P = 'app.kuaicaiwu.payment';
const PAYMENT_RESOURCE = 'kuaicaiwu:payment';

const PaymentsPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [pullPreviewOpen, setPullPreviewOpen] = useState(false);
  const [pullPreviewLoading, setPullPreviewLoading] = useState(false);
  const [pullPreviewData, setPullPreviewData] = useState<PaymentPullPreview | null>(null);
  const [pullPreviewSourceId, setPullPreviewSourceId] = useState<number | null>(null);
  const [pullForm] = Form.useForm();
  const pullFromPayableCloseRef = useRef<(() => void) | null>(null);
  const [pullSubmitting, setPullSubmitting] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<{ label: string; value: number }[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailRecord, setDetailRecord] = useState<PaymentVoucher | null>(null);
  const [linkedNote, setLinkedNote] = useState<FinanceNote | null>(null);
  const detailRetryIdRef = useRef<number | null>(null);
  const { message: messageApi } = App.useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const pullFromPayableAction = getKuaicaiwuDocumentAction('payment.pull_from_payable');
  const paymentPerms = useResourcePermissions(PAYMENT_RESOURCE);

  const paymentMethodOptions = useMemo(() => getPaymentMethodOptions(t), [t]);
  const paymentSettlementTypeOptions = useMemo(() => getPaymentSettlementTypeOptions(t), [t]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiRequest<unknown>('/apps/master-data/supply-chain/suppliers', { params: { limit: 1000, is_active: true } });
        const list = Array.isArray(res) ? res : (res as any)?.data ?? (res as any)?.items ?? [];
        setSupplierOptions((Array.isArray(list) ? list : []).map((s: any) => ({
          label: s.name || s.supplier_name || s.code || String(s.id),
          value: s.id,
        })));
      } catch {
        setSupplierOptions([]);
      }
    };
    load();
    bankAccountService.list({ limit: 200, is_active: true }).then((res) => setBankAccounts(res.data)).catch(() => setBankAccounts([]));
  }, []);

  const resolveBankLabel = (id?: number) => {
    if (!id) return '—';
    const acc = bankAccounts.find((a) => a.id === id);
    return acc ? formatBankAccountOptionLabel(acc) : `#${id}`;
  };

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    setLinkedNote(null);
    try {
      const record = await paymentService.getPayment(id);
      setDetailRecord(record);
      if (isAcceptanceBillPaymentMethod(record.payment_method)) {
        const noteRes = await financeNoteService.list('payable', { payment_id: id, limit: 1 });
        setLinkedNote(noteRes.data?.[0] ?? null);
      }
    } catch (error) {
      setDetailRecord(null);
      setLinkedNote(null);
      setDetailError(getApiErrorMessage(error, t(`${P}.loadDetailFailed`)));
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  const openDetail = useCallback((record: PaymentVoucher) => {
    detailRetryIdRef.current = record.id;
    setDetailOpen(true);
    setDetailRecord(null);
    setDetailError(null);
    void loadDetail(record.id);
  }, [loadDetail]);

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailRecord(null);
    setLinkedNote(null);
    setDetailError(null);
  };

  const refreshOpenDetail = () => {
    const id = detailRetryIdRef.current;
    if (detailOpen && id != null) void loadDetail(id);
  };

  const handleCreate = async (values: any) => {
    try {
      assertBankAccountForPaymentMethod(values.payment_method, values.bank_account_id, t);
    } catch (e: unknown) {
      messageApi.warning((e as Error).message);
      return false;
    }
    const data = {
      supplier_id: values.supplier_id,
      supplier_name: supplierOptions.find(o => o.value === values.supplier_id)?.label || '',
      total_amount: values.total_amount,
      payment_date: formatDateTime(values.payment_date || dayjs(), 'YYYY-MM-DD'),
      payment_method: values.payment_method,
      bank_account_id: values.bank_account_id,
      bank_account: resolveFinanceVoucherReferenceNote(
        bankAccounts,
        values.payment_method,
        values.bank_account_id,
        values.bank_account,
      ),
      settlement_type: values.settlement_type || 'normal',
      notes: values.notes,
      attachments: normalizeDocumentAttachments(values.attachments),
    };
    try {
      const created = await paymentService.create(data);
      try {
        await linkAcceptanceNoteAfterVoucherCreate(
          'payable',
          values.note_id,
          created.id,
          'payment',
        );
      } catch (linkError) {
        messageApi.warning(getApiErrorMessage(linkError, t('app.kuaicaiwu.notes.linkFailed')));
      }
      messageApi.success(t(`${P}.createSuccess`));
      setCreateModalVisible(false);
      actionRef.current?.reload();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.createFailed')));
      return false;
    }
    return true;
  };

  const resetPullPreview = () => {
    setPullPreviewOpen(false);
    setPullPreviewSourceId(null);
    setPullPreviewData(null);
    pullForm.resetFields();
  };

  const openPullPreview = async (payableId: number) => {
    setPullPreviewOpen(true);
    setPullPreviewLoading(true);
    setPullPreviewData(null);
    setPullPreviewSourceId(payableId);
    try {
      const data = await paymentService.previewPullFromPayable(payableId);
      setPullPreviewData(data);
      const maxPush = Number(data.items?.[0]?.max_push_quantity ?? 0);
      pullForm.setFieldsValue({
        source_code: data.source_code,
        supplier_name: data.supplier_name,
        total_amount: maxPush > 0 ? maxPush : undefined,
        payment_date: dayjs(),
        payment_method: BANK_TRANSFER_PAYMENT_METHOD,
        settlement_type: 'normal',
        notes: t('app.kuaicaiwu.common.createdFromSourceNote', {
          source: pullFromPayableAction.sourceLabel,
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

  const isPullPaymentSelectable = useCallback(
    (record: PullPayableCandidate) => record.capabilities?.pull_payment?.allowed !== false,
    [],
  );

  const pullQueryScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const pullFromPayableQuery = useUniPullQuery<PullPayableCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions: pullQueryScopeOptions,
    defaultScope: 'pullable',
    isRowDisabled: (record) => !isPullPaymentSelectable(record),
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const res = await paymentService.listPayablePullCandidates({
          skip: 0,
          limit: UNI_PULL_QUERY_MAX_FETCH_LIMIT,
          keyword: keyword.trim() || undefined,
        });
        const rows = res.data || [];
        const filtered = filterByPullScope(rows, scope, isPullPaymentSelectable);
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
      await openPullPreview(selected.id);
    },
  });
  pullFromPayableCloseRef.current = pullFromPayableQuery.closeModal;

  useEffect(() => {
    const pullPayableId = (location.state as { pullPayableId?: number } | null)?.pullPayableId;
    if (!pullPayableId) return;
    void openPullPreview(pullPayableId);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  const handlePullCreateSubmit = async (values: any) => {
    if (!pullPreviewData || !pullPreviewSourceId) return false;
    if (pullPreviewData.has_blocking_issues) return false;
    try {
      assertBankAccountForPaymentMethod(values.payment_method, values.bank_account_id, t);
    } catch (e: unknown) {
      messageApi.warning((e as Error).message);
      return false;
    }
    const maxPush = Number(pullPreviewData.items?.[0]?.max_push_quantity ?? 0);
    const totalAmount = Number(values.total_amount) || 0;
    if (totalAmount <= 0) {
      messageApi.warning(t(`${P}.amountMustPositive`));
      return false;
    }
    if (totalAmount > maxPush) {
      messageApi.warning(t(`${P}.pullExceedMax`, { max: maxPush.toFixed(2) }));
      return false;
    }
    setPullSubmitting(true);
    try {
      const created = await paymentService.create({
        supplier_id: Number(pullPreviewData.supplier_id || 0),
        supplier_name: pullPreviewData.supplier_name || '',
        source_type: 'payable',
        source_id: pullPreviewSourceId,
        total_amount: totalAmount,
        payment_date: formatDateTime(values.payment_date || dayjs(), 'YYYY-MM-DD'),
        payment_method: values.payment_method || '银行转账',
        bank_account_id: values.bank_account_id,
        bank_account: resolveFinanceVoucherReferenceNote(
          bankAccounts,
          values.payment_method,
          values.bank_account_id,
          values.bank_account,
        ),
        settlement_type: values.settlement_type || 'normal',
        notes:
          String(values.notes ?? '').trim() ||
          t('app.kuaicaiwu.common.createdFromSourceNote', {
            source: pullFromPayableAction.sourceLabel,
            code: pullPreviewData.source_code,
          }),
        attachments: normalizeDocumentAttachments(values.attachments),
      });
      try {
        await linkAcceptanceNoteAfterVoucherCreate(
          'payable',
          values.note_id,
          created.id,
          'payment',
        );
      } catch (linkError) {
        messageApi.warning(getApiErrorMessage(linkError, t('app.kuaicaiwu.notes.linkFailed')));
      }
      messageApi.success(t(`${P}.pullCreateSuccess`, { target: pullFromPayableAction.targetLabel }));
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

  const handleConfirm = async (record: PaymentVoucher) => {
    getAntdModal().confirm({
      title: t(`${P}.confirmTitle`),
      content: t(`${P}.confirmContent`, { code: record.payment_code }),
      onOk: async () => {
        try {
          await paymentService.confirmPayment(record.id);
          messageApi.success(t(`${P}.confirmSuccess`));
          actionRef.current?.reload();
          refreshOpenDetail();
        } catch (e: any) {
          messageApi.error(e?.message || t('common.operationFailed'));
        }
      },
    });
  };

  const handleCancelVoucher = async (record: PaymentVoucher) => {
    getAntdModal().confirm({
      title: t(`${P}.voidTitle`),
      content: t(`${P}.voidContent`, { code: record.payment_code }),
      onOk: async () => {
        try {
          await paymentService.cancelPayment(record.id);
          messageApi.success(t(`${P}.voidSuccess`));
          actionRef.current?.reload();
          refreshOpenDetail();
        } catch (e: any) {
          messageApi.error(e?.message || t('common.operationFailed'));
        }
      },
    });
  };

  const handleBatchConfirm = async (keys: React.Key[]) => {
    try {
      for (const key of keys) {
        await paymentService.confirmPayment(Number(key));
      }
      messageApi.success(t(`${P}.batchConfirmed`, { count: keys.length }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaicaiwu.common.batchConfirmFailed'));
    }
  };

  const handleBatchCancel = async (keys: React.Key[]) => {
    try {
      for (const key of keys) {
        await paymentService.cancelPayment(Number(key));
      }
      messageApi.success(t(`${P}.batchVoided`, { count: keys.length }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaicaiwu.common.batchVoidFailed'));
    }
  };

  const pullTableColumns = useMemo(
    () => [
      { title: t(`${P}.pullCol.payableCode`), dataIndex: 'code', width: 220, ellipsis: true },
      { title: t('app.kuaicaiwu.common.supplier'), dataIndex: 'supplier_name', width: 200, ellipsis: true },
      {
        title: t(`${P}.pullCol.docStatus`),
        dataIndex: 'source_status',
        width: 120,
        align: 'center' as const,
        render: (v: unknown) => {
          const { text, color } = getStatusDisplay(v);
          return text === '-' ? '-' : <MarkerTag color={color}>{text}</MarkerTag>;
        },
      },
      {
        title: t('app.kuaicaiwu.common.reviewStatus'),
        dataIndex: 'review_status',
        width: 120,
        align: 'center' as const,
        render: (v) => renderPullQueryReviewStatus(t, v),
      },
      {
        title: t('app.kuaicaiwu.common.dueDate'),
        dataIndex: 'source_date',
        width: 120,
        render: (v: unknown) => (v ? formatDateTime(String(v), 'YYYY-MM-DD') : '-'),
      },
      {
        title: t('app.kuaicaiwu.payable.col.remainingAmount'),
        dataIndex: 'remaining_amount',
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

  const batchMenuItems = useMemo(() => [
    {
      key: 'batch-confirm',
      label: t('app.kuaicaiwu.common.batchConfirm'),
      requireConfirm: true,
      confirmTitle: (count: number) => t(`${P}.batchConfirmTitle`, { count }),
      confirmDescription: t(`${P}.batchConfirmDesc`),
      onClick: handleBatchConfirm,
    },
    {
      key: 'batch-cancel',
      label: t('app.kuaicaiwu.common.batchVoid'),
      requireConfirm: true,
      confirmTitle: (count: number) => t(`${P}.batchVoidTitle`, { count }),
      confirmDescription: t(`${P}.batchVoidDesc`),
      onClick: handleBatchCancel,
    },
  ], [t]);

  const columns: ProColumns<PaymentVoucher>[] = useMemo(() => [
    ...financeDocCodePartnerSearchColumns({
      docCodeLabel: t(`${P}.col.code`),
      docCodeField: 'payment_code',
      partnerLabel: t('app.kuaicaiwu.common.supplier'),
      partnerIdField: 'supplier_id',
      partnerNameField: 'supplier_name',
      partnerOptions: supplierOptions,
    }),
    {
      title: t(`${P}.col.code`),
      key: 'finance_doc_partner_stacked',
      dataIndex: 'payment_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      hideInSearch: true,
      sorter: true,
      render: (_, r) => (
        <UniTableStackedPrimaryCell
          primary={String(r.supplier_name ?? '')}
          secondary={String(r.payment_code ?? '')}
          onSecondaryClick={() => openDetail(r)}
        />
      ),
    },
    {
      title: t('app.kuaicaiwu.common.supplier'),
      dataIndex: 'supplier_name',
      hideInTable: true,
    },
    {
      title: t(`${P}.col.totalAmount`),
      dataIndex: 'total_amount',
      valueType: 'money',
      align: 'right',
      width: 130,
      minWidth: 130,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t(`${P}.col.settledAmount`),
      dataIndex: 'settled_amount',
      valueType: 'money',
      align: 'right',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t(`${P}.col.unsettledAmount`),
      dataIndex: 'unsettled_amount',
      align: 'right',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      sorter: true,
      render: (_, record) => (
        <span style={{ color: record.unsettled_amount > 0 ? '#1677ff' : 'inherit', fontWeight: 'bold' }}>
          ¥{Number(record.unsettled_amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      title: t(`${P}.col.paymentDate`),
      dataIndex: 'payment_date',
      valueType: 'date',
      width: 110,
      minWidth: 110,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t(`${P}.col.paymentDate`),
      dataIndex: 'payment_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      order: 20,
      formItemProps: formDateRangeFormItemProps,
    },
    {
      title: t(`${P}.col.paymentMethod`),
      dataIndex: 'payment_method',
      width: 110,
      minWidth: 110,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      sorter: true,
      render: (_, record) => formatPaymentMethod(record.payment_method, t),
    },
    {
      title: t('app.kuaicaiwu.common.referenceNumber'),
      dataIndex: 'bank_account',
      width: 140,
      minWidth: 140,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      ellipsis: true,
      render: (_, record) => record.bank_account || '—',
    },
    {
      title: t(`${P}.settlementType`, '结算类型'),
      dataIndex: 'settlement_type',
      hideInTable: true,
      order: 15,
      valueType: 'select',
      fieldProps: {
        options: paymentSettlementTypeOptions,
        allowClear: true,
      },
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      hideInTable: true,
      order: 22,
      valueEnum: buildVoucherStatusEnum(t),
    },
    ...financeDocCreatedUpdatedColumns<PaymentVoucher>(t),
    {
      title: t('app.kuaicaiwu.common.lifecycle'),
      key: 'lifecycle',
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const lc = getFinanceVoucherLifecycle(record as unknown as Record<string, unknown>, t);
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
            record.status === 'Draft' && paymentPerms.canAction?.('audit') ? (
              <Button {...rowActionKind('audit')} key="cf" onClick={() => handleConfirm(record)}>
                {t('app.kuaicaiwu.common.confirm')}
              </Button>
            ) : null,
            record.status === 'Confirmed' && Number(record.unsettled_amount ?? 0) > 0 ? (
              <Button
                {...rowActionKind('submit')}
                key="st"
                onClick={() => {
                  const qs = new URLSearchParams({ tab: 'payable' });
                  if (record.supplier_id != null) qs.set('supplierId', String(record.supplier_id));
                  if (record.id != null) qs.set('paymentId', String(record.id));
                  navigate(`/apps/kuaicaiwu/finance-management/settlement?${qs.toString()}`);
                }}
              >
                {t('app.kuaicaiwu.common.settle')}
              </Button>
            ) : null,
            record.status !== 'Cancelled' && record.settled_amount === 0 && paymentPerms.canAction?.('revoke') ? (
              <Button {...rowActionKind('revoke')} key="ca" onClick={() => handleCancelVoucher(record)}>
                {t('app.kuaicaiwu.common.void')}
              </Button>
            ) : null,
          ].filter(Boolean) as React.ReactNode[],
    },
  ], [t, navigate, supplierOptions, paymentSettlementTypeOptions, paymentPerms, openDetail]);

  return (
    <ListPageTemplate>
      <UniTable<PaymentVoucher>
        headerTitle={t(`${P}.pageTitle`)}
        actionRef={actionRef}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        rowKey="id"
        columnPersistenceId="apps.kuaicaiwu.pages.finance-management.payments.list-v1"
        showAdvancedSearch
        search={{ labelWidth: 120 }}
        showCreateButton={false}
        createButtonText={t(`${P}.createTitle`)}
        onCreate={() => setCreateModalVisible(true)}
        toolBarActionsAfterBatch={[
          <UniBatchMenuButton
            key="payment-batch-actions"
            selectedRowKeys={selectedRowKeys}
            buttonText={t('components.uniBatch.batchActions')}
            menuItems={batchMenuItems}
          />,
        ]}
        toolBarRender={() => [
          <UniPullCreateToolbar
            compactKey="create-payment-with-pull"
            createIcon={<PlusOutlined />}
            createLabel={t(`${P}.createTitle`)}
            onCreate={() => setCreateModalVisible(true)}
            menuItems={buildKuaicaiwuPullCreateMenuItems([
              {
                key: 'pull-from-payable',
                actionKey: 'payment.pull_from_payable',
                onClick: pullFromPayableQuery.openModal,
              },
            ])}
          />,
        ]}
        request={async (params, sort, _filter, searchFormValues) => {
          const listParams = resolvePaymentListParams(searchFormValues, sort);
          lastListParamsRef.current = listParams;
          const apiParams: PaymentListParams = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            ...listParams,
          };
          const res = await paymentService.listPayments(apiParams);
          return {
            data: res?.items || [],
            total: res?.total || 0,
            success: true,
          };
        }}
        skipFuzzyPinyinClientFilter
        pinnedTabsField={FINANCE_DOC_PINNED_STATUS_FIELD}
        columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
      />

      <UniPullQueryModal<PullPayableCandidate>
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
        selectedRows={pullFromPayableQuery.selectedRows}
        onSelectedRowKeysChange={pullFromPayableQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromPayableQuery.isRowDisabled}
        searchDraft={pullFromPayableQuery.searchDraft}
        onSearchDraftChange={pullFromPayableQuery.setSearchDraft}
        onSearchApply={pullFromPayableQuery.handleSearchApply}
        onSearchClear={pullFromPayableQuery.handleSearchClear}
        appliedKeyword={pullFromPayableQuery.appliedKeyword}
        searchPlaceholder={t(`${P}.pullSearchPlaceholder`)}
        page={pullFromPayableQuery.page}
        pageSize={pullFromPayableQuery.pageSize}
        total={pullFromPayableQuery.total}
        onPageChange={pullFromPayableQuery.handlePageChange}
        scopeOptions={pullFromPayableQuery.scopeOptions}
        scope={pullFromPayableQuery.scope}
        onScopeChange={pullFromPayableQuery.handleScopeChange}
        okText={t('components.uniLifecycle.nextStep')}
      />

      <Modal
        title={pullFromPayableAction.label}
        open={pullPreviewOpen}
        destroyOnClose
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        onCancel={resetPullPreview}
        okText={pullFromPayableAction.targetLabel}
        cancelText={t('common.cancel')}
        confirmLoading={pullSubmitting}
        onOk={() => void pullForm.submit()}
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
                message={paymentCapabilityReasonMessage(pullPreviewData.blocking_reason, t)}
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
                  { title: t(`${P}.pullCol.payableCode`), dataIndex: 'source_code', width: 140, ellipsis: true },
                  { title: t('app.kuaicaiwu.common.supplier'), dataIndex: 'supplier_name', width: 160, ellipsis: true },
                  {
                    title: t(`${P}.pull.col.docAmount`),
                    dataIndex: 'quantity',
                    width: 120,
                    align: 'right',
                    render: (v: number) => formatPullMoney(v),
                  },
                  {
                    title: t(`${P}.pull.col.paidAmount`),
                    dataIndex: 'pushed_quantity',
                    width: 120,
                    align: 'right',
                    render: (v: number) => formatPullMoney(v),
                  },
                  {
                    title: t(`${P}.pull.col.payableAmount`),
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
                key={`pull-payment-${pullPreviewSourceId}`}
                form={pullForm}
                submitter={false}
                onFinish={handlePullCreateSubmit}
                layout="vertical"
                {...financeFormGridProps}
              >
                <ProFormText name="source_code" label={t(`${P}.sourcePayable`)} readonly colProps={financeColHalf} />
                <ProFormText name="supplier_name" label={t('app.kuaicaiwu.common.supplier')} readonly colProps={financeColHalf} />
                <ProFormMoney
                  name="total_amount"
                  label={t(`${P}.col.amount`)}
                  min={0.01}
                  rules={[{ required: true }]}
                  colProps={financeColHalf}
                />
                <ProFormDatePicker
                  name="payment_date"
                  label={t(`${P}.col.paymentDate`)}
                  rules={[{ required: true }]}
                  fieldProps={{ style: { width: '100%' } }}
                  colProps={financeColHalf}
                />
                <ProFormSelect
                  name="payment_method"
                  label={t(`${P}.col.paymentMethod`)}
                  options={paymentMethodOptions}
                  rules={[{ required: true, message: t(`${P}.selectPaymentMethod`) }]}
                  colProps={financeColHalf}
                />
                <ProFormSelect
                  name="settlement_type"
                  label={t(`${P}.settlementType.label`)}
                  options={paymentSettlementTypeOptions}
                  initialValue="normal"
                  colProps={financeColHalf}
                />
                <LedgerAccountFormFields
                  accounts={bankAccounts}
                  accountLabel={t(`${P}.outBankAccount`)}
                  noteLabel={t(`${P}.outAccountNote`)}
                  acceptanceNoteDirection="payable"
                  partnerFieldName="supplier_id"
                />
                <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} fieldProps={{ rows: 3 }} colProps={financeColFull} />
                <DocumentAttachmentsField category="payment_attachments" />
              </ProForm>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ModalForm
        title={t(`${P}.createTitle`)}
        open={createModalVisible}
        onOpenChange={setCreateModalVisible}
        onFinish={handleCreate}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        {...financeFormGridProps}
      >
        <ProFormSelect
          name="supplier_id"
          label={t('app.kuaicaiwu.common.supplier')}
          options={supplierOptions}
          rules={[{ required: true, message: t('app.kuaicaiwu.common.selectSupplier') }]}
          placeholder={t('app.kuaicaiwu.common.selectSupplier')}
          showSearch
          colProps={financeColHalf}
        />
        <ProFormMoney
          name="total_amount"
          label={t(`${P}.col.amount`)}
          min={0.01}
          rules={[{ required: true }]}
          colProps={financeColHalf}
        />
        <ProFormDatePicker
          name="payment_date"
          label={t(`${P}.col.paymentDate`)}
          rules={[{ required: true }]}
          initialValue={dayjs()}
          fieldProps={{ style: { width: '100%' } }}
          colProps={financeColHalf}
        />
        <ProFormSelect
          name="payment_method"
          label={t(`${P}.col.paymentMethod`)}
          options={paymentMethodOptions}
          rules={[{ required: true, message: t(`${P}.selectPaymentMethod`) }]}
          placeholder={t(`${P}.selectPaymentMethod`)}
          colProps={financeColHalf}
        />
        <ProFormSelect
          name="settlement_type"
          label={t(`${P}.settlementType.label`)}
          initialValue="normal"
          options={paymentSettlementTypeOptions}
          colProps={financeColHalf}
        />
        <LedgerAccountFormFields
          accounts={bankAccounts}
          accountLabel={t(`${P}.outBankAccount`)}
          noteLabel={t(`${P}.outAccountNote`)}
          noteColProps={financeColFull}
          acceptanceNoteDirection="payable"
          partnerFieldName="supplier_id"
        />
        <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} colProps={financeColFull} />
        <DocumentAttachmentsField category="payment_attachments" />
      </ModalForm>

      <FinanceVoucherDetailDrawer
        kind="payment"
        open={detailOpen}
        onClose={closeDetail}
        record={detailRecord}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const id = detailRetryIdRef.current;
          if (id != null) void loadDetail(id);
        }}
        bankAccountLabel={resolveBankLabel(detailRecord?.bank_account_id)}
        linkedNote={linkedNote}
        linkedNotePath="/apps/kuaicaiwu/finance-management/notes-payable"
        extra={
          detailRecord ? (
            <DetailDrawerActions
              items={[
                {
                  key: 'confirm',
                  visible: detailRecord.status === 'Draft' && Boolean(paymentPerms.canAction?.('audit')),
                  render: (
                    <Button {...rowActionKind('audit')} onClick={() => void handleConfirm(detailRecord)}>
                      {t('app.kuaicaiwu.common.confirm')}
                    </Button>
                  ),
                },
                {
                  key: 'settle',
                  visible: detailRecord.status === 'Confirmed' && Number(detailRecord.unsettled_amount ?? 0) > 0,
                  render: (
                    <Button
                      {...rowActionKind('submit')}
                      onClick={() => {
                        const qs = new URLSearchParams({ tab: 'payable' });
                        if (detailRecord.supplier_id != null) qs.set('supplierId', String(detailRecord.supplier_id));
                        if (detailRecord.id != null) qs.set('paymentId', String(detailRecord.id));
                        navigate(`/apps/kuaicaiwu/finance-management/settlement?${qs.toString()}`);
                      }}
                    >
                      {t('app.kuaicaiwu.common.settle')}
                    </Button>
                  ),
                },
                {
                  key: 'void',
                  visible:
                    detailRecord.status !== 'Cancelled'
                    && detailRecord.settled_amount === 0
                    && Boolean(paymentPerms.canAction?.('revoke')),
                  render: (
                    <Button {...rowActionKind('revoke')} onClick={() => void handleCancelVoucher(detailRecord)}>
                      {t('app.kuaicaiwu.common.void')}
                    </Button>
                  ),
                },
              ]}
            />
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default PaymentsPage;
