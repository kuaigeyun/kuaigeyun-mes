/**
 * 收款单列表页
 *
 * 记录从客户收取的款项，可用于核销应收单。
 */
import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Typography, Tag, Drawer, Descriptions, Spin, Alert, Table, Empty } from 'antd';
import { ModalForm, ProFormDatePicker, ProFormMoney, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import dayjs from 'dayjs';
import { getFinanceVoucherLifecycle } from '../../../utils/financeLifecycle';
import {
  receiptService,
  type ReceiptPullCandidate,
  type ReceiptPullPreview,
  type ReceiptVoucher,
  type ReceiptListParams,
} from '../../../services/finance/receipt';
import { bankAccountService, type BankAccount } from '../../../services/finance/bank-account';
import { buildKuaicaiwuPullCreateMenuItems, getKuaicaiwuDocumentAction } from '../../../constants/documentActionRegistry';
import {
  buildVoucherStatusEnum,
  formatPaymentMethod,
  formatReceiptSettlementType,
  getPaymentMethodOptions,
  getReceiptSettlementTypeOptions,
} from '../../../utils/financeSharedOptions';
import DocumentAttachmentsField from '../../../../kuaizhizao/components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../../kuaizhizao/utils/documentAttachments';
import { getStatusDisplay } from '../../../../kuaizhizao/constants/documentStatus';
import { receiptCapabilityReasonMessage } from '../../../utils/receiptCapabilityMessages';
import { formatDateTime } from '../../../../../utils/format';
import {
  FINANCE_DOC_PINNED_STATUS_FIELD,
  financeDocCodePartnerSearchColumns,
  financeDocCreatedUpdatedColumns,
  resolveReceiptListParams,
} from '../../../utils/financeListCore';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';

type PullReceivableCandidate = ReceiptPullCandidate;

const R = 'app.kuaicaiwu.receipt';

const ReceiptsPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [pullPreviewOpen, setPullPreviewOpen] = useState(false);
  const [pullPreviewLoading, setPullPreviewLoading] = useState(false);
  const [pullPreviewData, setPullPreviewData] = useState<ReceiptPullPreview | null>(null);
  const [pullPreviewSourceId, setPullPreviewSourceId] = useState<number | null>(null);
  const pullFormRef = useRef<any>(null);
  const pullFromReceivableCloseRef = useRef<(() => void) | null>(null);
  const [pullSubmitting, setPullSubmitting] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [customerOptions, setCustomerOptions] = useState<{ label: string; value: number }[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRecord, setDetailRecord] = useState<ReceiptVoucher | null>(null);
  const { message: messageApi } = App.useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pullFromReceivableAction = getKuaicaiwuDocumentAction('receipt.pull_from_receivable');

  const paymentMethodOptions = useMemo(() => getPaymentMethodOptions(t), [t]);
  const receiptSettlementTypeOptions = useMemo(() => getReceiptSettlementTypeOptions(t), [t]);

  const formatVoucherStatus = useCallback(
    (status: string) => {
      const enumMap = buildVoucherStatusEnum(t);
      return (enumMap as Record<string, { text: string }>)[status]?.text ?? status;
    },
    [t],
  );

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
    bankAccountService.list({ limit: 200, is_active: true }).then((res) => setBankAccounts(res.data)).catch(() => setBankAccounts([]));
  }, []);

  const bankAccountOptions = bankAccounts.map((a) => ({
    label: `${a.account_name} (${a.account_number})`,
    value: a.id,
    account_number: a.account_number,
  }));

  const resolveBankLabel = (id?: number) => {
    if (!id) return '—';
    const acc = bankAccounts.find((a) => a.id === id);
    return acc ? `${acc.account_name} (${acc.account_number})` : `#${id}`;
  };

  const openDetail = async (record: ReceiptVoucher) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const detail = await receiptService.getReceipt(record.id);
      setDetailRecord(detail);
    } catch (error: any) {
      messageApi.error(error.message || t(`${R}.loadDetailFailed`));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    const bank = bankAccountOptions.find((o) => o.value === values.bank_account_id);
    const data = {
      customer_id: values.customer_id,
      customer_name: customerOptions.find(o => o.value === values.customer_id)?.label || '',
      total_amount: values.total_amount,
      receipt_date: formatDateTime(values.receipt_date || dayjs(), 'YYYY-MM-DD'),
      payment_method: values.payment_method,
      bank_account_id: values.bank_account_id,
      bank_account: bank?.account_number || values.bank_account,
      settlement_type: values.settlement_type || 'normal',
      notes: values.notes,
      attachments: normalizeDocumentAttachments(values.attachments),
    };
    await apiRequest('/apps/kuaicaiwu/receipts', { method: 'POST', data });
    messageApi.success(t(`${R}.createSuccess`));
    setCreateModalVisible(false);
    actionRef.current?.reload();
  };

  const resetPullPreview = () => {
    setPullPreviewOpen(false);
    setPullPreviewSourceId(null);
    setPullPreviewData(null);
    pullFormRef.current?.resetFields();
  };

  const openPullPreview = async (receivableId: number) => {
    setPullPreviewOpen(true);
    setPullPreviewLoading(true);
    setPullPreviewData(null);
    setPullPreviewSourceId(receivableId);
    try {
      const data = await receiptService.previewPullFromReceivable(receivableId);
      setPullPreviewData(data);
      const maxPush = Number(data.items?.[0]?.max_push_quantity ?? 0);
      pullFormRef.current?.setFieldsValue({
        source_code: data.source_code,
        customer_name: data.customer_name,
        total_amount: maxPush > 0 ? maxPush : undefined,
        receipt_date: dayjs(),
        payment_method: '银行转账',
        settlement_type: 'normal',
        notes: t('app.kuaicaiwu.common.createdFromSourceNote', {
          source: pullFromReceivableAction.sourceLabel,
          code: data.source_code,
        }),
      });
    } catch (e: any) {
      messageApi.error(
        e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || t(`${R}.loadSourceFailed`),
      );
      resetPullPreview();
    } finally {
      setPullPreviewLoading(false);
    }
  };

  const pullFromReceivableQuery = useUniPullQuery<PullReceivableCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    isRowDisabled: (record) => record.capabilities?.pull_receipt?.allowed === false,
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const res = await receiptService.listReceivablePullCandidates({
          skip: (page - 1) * pageSize,
          limit: pageSize,
          keyword: keyword.trim() || undefined,
        });
        return { data: res.data || [], total: res.total ?? 0 };
      } catch (e: any) {
        messageApi.error(
          e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || t(`${R}.loadSourceFailed`),
        );
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys, rows) => {
      const selected = rows.find((x) => String(x.id) === String(keys[0]));
      if (!selected?.id) {
        messageApi.warning(t(`${R}.selectSource`, { label: pullFromReceivableAction.sourceLabel }));
        return;
      }
      pullFromReceivableCloseRef.current?.();
      await openPullPreview(selected.id);
    },
  });
  pullFromReceivableCloseRef.current = pullFromReceivableQuery.closeModal;

  const handlePullCreateSubmit = async (values: any) => {
    if (!pullPreviewData || !pullPreviewSourceId) return false;
    if (pullPreviewData.has_blocking_issues) return false;
    const maxPush = Number(pullPreviewData.items?.[0]?.max_push_quantity ?? 0);
    const totalAmount = Number(values.total_amount) || 0;
    if (totalAmount <= 0) {
      messageApi.warning(t(`${R}.amountRequired`));
      return false;
    }
    if (totalAmount > maxPush) {
      messageApi.warning(t(`${R}.pullExceedMax`, { max: maxPush.toFixed(2) }));
      return false;
    }
    const bank = bankAccountOptions.find((o) => o.value === values.bank_account_id);
    setPullSubmitting(true);
    try {
      await receiptService.create({
        customer_id: Number(pullPreviewData.customer_id || 0),
        customer_name: pullPreviewData.customer_name || '',
        source_type: 'receivable',
        source_id: pullPreviewSourceId,
        total_amount: totalAmount,
        receipt_date: formatDateTime(values.receipt_date || dayjs(), 'YYYY-MM-DD'),
        payment_method: values.payment_method,
        bank_account_id: values.bank_account_id,
        bank_account: bank?.account_number || values.bank_account,
        settlement_type: values.settlement_type || 'normal',
        notes:
          String(values.notes ?? '').trim() ||
          t('app.kuaicaiwu.common.createdFromSourceNote', {
            source: pullFromReceivableAction.sourceLabel,
            code: pullPreviewData.source_code,
          }),
        attachments: normalizeDocumentAttachments(values.attachments),
      });
      messageApi.success(t(`${R}.pullCreateSuccess`, { target: pullFromReceivableAction.targetLabel }));
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

  const handleConfirm = async (record: ReceiptVoucher) => {
    Modal.confirm({
      title: t(`${R}.confirmTitle`),
      content: t(`${R}.confirmContent`, { code: record.receipt_code }),
      onOk: async () => {
        try {
          await apiRequest(`/apps/kuaicaiwu/receipts/${record.id}/confirm`, { method: 'POST' });
          messageApi.success(t(`${R}.confirmSuccess`));
          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.message || t('common.operationFailed'));
        }
      },
    });
  };

  const handleCancel = async (record: ReceiptVoucher) => {
    Modal.confirm({
      title: t(`${R}.voidTitle`),
      content: t(`${R}.voidContent`, { code: record.receipt_code }),
      onOk: async () => {
        try {
          await receiptService.cancelReceipt(record.id);
          messageApi.success(t(`${R}.voidSuccess`));
          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.message || t('common.operationFailed'));
        }
      },
    });
  };

  const handleDelete = async (record: ReceiptVoucher) => {
    Modal.confirm({
      title: t(`${R}.deleteTitle`),
      content: t(`${R}.deleteContent`, { code: record.receipt_code }),
      okType: 'danger',
      onOk: async () => {
        try {
          await receiptService.deleteReceipt(record.id);
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
      for (const key of keys) {
        await receiptService.deleteReceipt(Number(key));
      }
      messageApi.success(t(`${R}.batchDeleted`, { count: keys.length }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.deleteFailed'));
    }
  };

  const handleBatchConfirm = async (keys: React.Key[]) => {
    try {
      for (const key of keys) {
        await apiRequest(`/apps/kuaicaiwu/receipts/${key}/confirm`, { method: 'POST' });
      }
      messageApi.success(t(`${R}.batchConfirmed`, { count: keys.length }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaicaiwu.common.batchConfirmFailed'));
    }
  };

  const handleBatchCancel = async (keys: React.Key[]) => {
    try {
      for (const key of keys) {
        await receiptService.cancelReceipt(Number(key));
      }
      messageApi.success(t(`${R}.batchVoided`, { count: keys.length }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaicaiwu.common.batchVoidFailed'));
    }
  };

  const pullTableColumns = useMemo(
    () => [
      { title: t(`${R}.pullCol.receivableCode`), dataIndex: 'code', width: 220, ellipsis: true },
      { title: t('app.kuaicaiwu.common.customer'), dataIndex: 'customer_name', width: 200, ellipsis: true },
      {
        title: t('app.kuaicaiwu.common.businessStatus'),
        dataIndex: 'source_status',
        width: 120,
        align: 'center' as const,
        render: (v: unknown) => {
          const { text, color } = getStatusDisplay(v);
          return text === '-' ? '-' : <Tag color={color}>{text}</Tag>;
        },
      },
      {
        title: t('app.kuaicaiwu.common.reviewStatus'),
        dataIndex: 'review_status',
        width: 120,
        align: 'center' as const,
      },
      {
        title: t('app.kuaicaiwu.common.dueDate'),
        dataIndex: 'source_date',
        width: 120,
        render: (v: unknown) => (v ? formatDateTime(String(v), 'YYYY-MM-DD') : '-'),
      },
      {
        title: t('app.kuaicaiwu.receivable.col.remainingAmount'),
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
      confirmTitle: (count: number) => t(`${R}.batchConfirmTitle`, { count }),
      confirmDescription: t(`${R}.batchConfirmDesc`),
      onClick: handleBatchConfirm,
    },
    {
      key: 'batch-cancel',
      label: t('app.kuaicaiwu.common.batchVoid'),
      requireConfirm: true,
      confirmTitle: (count: number) => t(`${R}.batchVoidTitle`, { count }),
      confirmDescription: t(`${R}.batchVoidDesc`),
      onClick: handleBatchCancel,
    },
  ], [t]);

  const columns: ProColumns<ReceiptVoucher>[] = useMemo(() => [
    ...financeDocCodePartnerSearchColumns({
      docCodeLabel: t(`${R}.col.code`),
      docCodeField: 'receipt_code',
      partnerLabel: t('app.kuaicaiwu.common.customer'),
      partnerIdField: 'customer_id',
      partnerNameField: 'customer_name',
      partnerOptions: customerOptions,
    }),
    {
      title: t(`${R}.col.code`),
      dataIndex: 'receipt_code',
      width: 168,
      fixed: 'left',
      hideInSearch: true,
      sorter: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.receipt_code ?? '') }} ellipsis>
          {r.receipt_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t('app.kuaicaiwu.common.customer'),
      dataIndex: 'customer_name',
      width: 200,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t(`${R}.col.totalAmount`),
      dataIndex: 'total_amount',
      valueType: 'money',
      align: 'right',
      width: 130,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t(`${R}.col.settledAmount`),
      dataIndex: 'settled_amount',
      valueType: 'money',
      align: 'right',
      width: 120,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t(`${R}.col.unsettledAmount`),
      dataIndex: 'unsettled_amount',
      align: 'right',
      width: 120,
      hideInSearch: true,
      sorter: true,
      render: (_, record) => (
        <span style={{ color: record.unsettled_amount > 0 ? '#1677ff' : 'inherit', fontWeight: 'bold' }}>
          ¥{Number(record.unsettled_amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      title: t(`${R}.col.receiptDate`),
      dataIndex: 'receipt_date',
      valueType: 'date',
      width: 110,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t(`${R}.col.receiptDate`),
      dataIndex: 'receipt_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      order: 20,
      formItemProps: formDateRangeFormItemProps,
    },
    {
      title: t(`${R}.col.paymentMethod`),
      dataIndex: 'payment_method',
      width: 110,
      hideInSearch: true,
      sorter: true,
      render: (_, record) => formatPaymentMethod(record.payment_method, t),
    },
    {
      title: t(`${R}.settlementType`, '结算类型'),
      dataIndex: 'settlement_type',
      hideInTable: true,
      order: 15,
      valueType: 'select',
      fieldProps: {
        options: receiptSettlementTypeOptions,
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
    ...financeDocCreatedUpdatedColumns<ReceiptVoucher>(t),
    {
      title: t('app.kuaicaiwu.common.lifecycle'),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      width: 120,
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
      valueType: 'option',
      fixed: 'right',
      width: 220,
      render: (_, record) => [
            <Button {...rowActionKind('read')} key="det" onClick={() => openDetail(record)}>
              {t('common.detail')}
            </Button>,
            record.status === 'Draft' ? (
              <Button {...rowActionKind('audit')} key="cf" onClick={() => handleConfirm(record)}>
                {t('app.kuaicaiwu.common.confirm')}
              </Button>
            ) : null,
            record.status === 'Confirmed' ? (
              <Button {...rowActionKind('submit')} key="st" onClick={() => navigate(`/apps/kuaicaiwu/finance-management/settlement`)}>
                {t('app.kuaicaiwu.common.settle')}
              </Button>
            ) : null,
            record.status !== 'Cancelled' && record.settled_amount === 0 ? (
              <Button {...rowActionKind('revoke')} key="ca" onClick={() => handleCancel(record)}>
                {t('app.kuaicaiwu.common.void')}
              </Button>
            ) : null,
            record.status !== 'Confirmed' ? (
              <Button {...rowActionKind('delete')} key="del" onClick={() => handleDelete(record)}>
                {t('common.delete')}
              </Button>
            ) : null,
          ].filter(Boolean) as React.ReactNode[],
    },
  ], [t, navigate, customerOptions, receiptSettlementTypeOptions]);

  return (
    <ListPageTemplate>
      <UniTable<ReceiptVoucher>
        headerTitle={t(`${R}.pageTitle`)}
        actionRef={actionRef}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        rowKey="id"
        columnPersistenceId="apps.kuaicaiwu.pages.finance-management.receipts"
        scroll={{ x: 1680 }}
        showAdvancedSearch
        search={{ labelWidth: 120 }}
        showCreateButton={false}
        createButtonText={t(`${R}.createTitle`)}
        onCreate={() => setCreateModalVisible(true)}
        showDeleteButton
        deleteButtonText={t('common.batchDelete')}
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('app.kuaicaiwu.common.confirmBatchDelete')}
        deleteConfirmDescription={(count) => t(`${R}.deleteConfirm`, { count })}
        toolBarActionsAfterDelete={[
          <UniBatchMenuButton
            key="receipt-batch-actions"
            selectedRowKeys={selectedRowKeys}
            buttonText={t('components.uniBatch.batchActions')}
            menuItems={batchMenuItems}
          />,
        ]}
        toolBarRender={() => [
          <UniPullCreateToolbar
            compactKey="create-receipt-with-pull"
            createIcon={<PlusOutlined />}
            createLabel={t(`${R}.createTitle`)}
            onCreate={() => setCreateModalVisible(true)}
            menuItems={buildKuaicaiwuPullCreateMenuItems([
              {
                key: 'pull-from-receivable',
                actionKey: 'receipt.pull_from_receivable',
                onClick: pullFromReceivableQuery.openModal,
              },
            ])}
          />,
        ]}
        request={async (params, sort, _filter, searchFormValues) => {
          const listParams = resolveReceiptListParams(searchFormValues, sort);
          lastListParamsRef.current = listParams;
          const apiParams: ReceiptListParams = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            ...listParams,
          };
          const res = await receiptService.listReceipts(apiParams);
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

      <UniPullQueryModal<PullReceivableCandidate>
        open={pullFromReceivableQuery.open}
        title={pullFromReceivableAction.label}
        onCancel={pullFromReceivableQuery.closeModal}
        onOk={() => {
          void pullFromReceivableQuery.handleConfirm();
        }}
        rowKey="id"
        columns={pullTableColumns}
        dataSource={pullFromReceivableQuery.dataSource}
        loading={pullFromReceivableQuery.loading}
        confirmLoading={pullFromReceivableQuery.confirmLoading}
        selectionType={pullFromReceivableQuery.selectionType}
        selectedRowKeys={pullFromReceivableQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromReceivableQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromReceivableQuery.isRowDisabled}
        searchDraft={pullFromReceivableQuery.searchDraft}
        onSearchDraftChange={pullFromReceivableQuery.setSearchDraft}
        onSearchApply={pullFromReceivableQuery.handleSearchApply}
        onSearchClear={pullFromReceivableQuery.handleSearchClear}
        appliedKeyword={pullFromReceivableQuery.appliedKeyword}
        searchPlaceholder={t(`${R}.pullSearchPlaceholder`)}
        page={pullFromReceivableQuery.page}
        pageSize={pullFromReceivableQuery.pageSize}
        total={pullFromReceivableQuery.total}
        onPageChange={pullFromReceivableQuery.handlePageChange}
        okText={t('components.uniLifecycle.nextStep')}
      />

      <Modal
        title={pullFromReceivableAction.label}
        open={pullPreviewOpen}
        destroyOnClose
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        onCancel={resetPullPreview}
        okText={pullFromReceivableAction.targetLabel}
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
                message={receiptCapabilityReasonMessage(pullPreviewData.blocking_reason, t)}
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
                  { title: t(`${R}.pullCol.receivableCode`), dataIndex: 'source_code', width: 140, ellipsis: true },
                  { title: t('app.kuaicaiwu.common.customer'), dataIndex: 'customer_name', width: 160, ellipsis: true },
                  {
                    title: t(`${R}.pull.col.docAmount`),
                    dataIndex: 'quantity',
                    width: 120,
                    align: 'right',
                    render: (v: number) => formatPullMoney(v),
                  },
                  {
                    title: t(`${R}.pull.col.receivedAmount`),
                    dataIndex: 'pushed_quantity',
                    width: 120,
                    align: 'right',
                    render: (v: number) => formatPullMoney(v),
                  },
                  {
                    title: t(`${R}.pull.col.receivableAmount`),
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
                <ProFormText name="source_code" label={t(`${R}.pullCol.receivableCode`)} readonly />
                <ProFormText name="customer_name" label={t('app.kuaicaiwu.common.customer')} readonly />
                <ProFormMoney
                  name="total_amount"
                  label={t(`${R}.col.amount`)}
                  min={0.01}
                  rules={[{ required: true, message: t(`${R}.col.amount`) }]}
                />
                <ProFormDatePicker
                  name="receipt_date"
                  label={t(`${R}.col.receiptDate`)}
                  rules={[{ required: true }]}
                  fieldProps={{ style: { width: '100%' } }}
                />
                <ProFormSelect
                  name="payment_method"
                  label={t(`${R}.col.paymentMethod`)}
                  options={paymentMethodOptions}
                  rules={[{ required: true, message: t(`${R}.selectPaymentMethod`) }]}
                />
                <ProFormSelect
                  name="settlement_type"
                  label={t(`${R}.settlementType.label`)}
                  options={receiptSettlementTypeOptions}
                  initialValue="normal"
                />
                <ProFormSelect
                  name="bank_account_id"
                  label={t(`${R}.bankAccount`)}
                  options={bankAccountOptions}
                  placeholder={t(`${R}.bankAccountPlaceholder`)}
                  showSearch
                  allowClear
                />
                <ProFormText
                  name="bank_account"
                  label={t(`${R}.bankAccountNote`)}
                  placeholder={t(`${R}.bankAccountNotePlaceholder`)}
                />
                <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} fieldProps={{ rows: 3 }} />
                <DocumentAttachmentsField category="receipt_attachments" />
              </ModalForm>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ModalForm
        title={t(`${R}.createTitle`)}
        open={createModalVisible}
        onOpenChange={setCreateModalVisible}
        onFinish={handleCreate}
        width={480}
      >
        <ProFormSelect
          name="customer_id"
          label={t('app.kuaicaiwu.common.customer')}
          options={customerOptions}
          rules={[{ required: true, message: t('app.kuaicaiwu.common.selectCustomer') }]}
          placeholder={t('app.kuaicaiwu.common.selectCustomer')}
          showSearch
        />
        <ProFormMoney name="total_amount" label={t(`${R}.col.amount`)} min={0.01} rules={[{ required: true }]} />
        <ProFormDatePicker name="receipt_date" label={t(`${R}.col.receiptDate`)} rules={[{ required: true }]} initialValue={dayjs()} fieldProps={{ style: { width: '100%' } }} />
        <ProFormSelect
          name="payment_method"
          label={t(`${R}.col.paymentMethod`)}
          options={paymentMethodOptions}
          rules={[{ required: true, message: t(`${R}.selectPaymentMethod`) }]}
          placeholder={t(`${R}.selectPaymentMethod`)}
        />
        <ProFormSelect
          name="settlement_type"
          label={t(`${R}.settlementType.label`)}
          initialValue="normal"
          options={receiptSettlementTypeOptions}
        />
        <ProFormSelect
          name="bank_account_id"
          label={t(`${R}.bankAccount`)}
          options={bankAccountOptions}
          placeholder={t(`${R}.bankAccountPlaceholder`)}
          showSearch
          allowClear
        />
        <ProFormText name="bank_account" label={t(`${R}.bankAccountNote`)} placeholder={t(`${R}.bankAccountNotePlaceholder`)} />
        <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} />
        <DocumentAttachmentsField category="receipt_attachments" />
      </ModalForm>

      <Drawer
        title={detailRecord
          ? t(`${R}.detailDrawerTitle`, { code: detailRecord.receipt_code })
          : t(`${R}.detailTitle`)}
        open={detailOpen}
        size={520}
        onClose={() => { setDetailOpen(false); setDetailRecord(null); }}
        destroyOnHidden
      >
        <Spin spinning={detailLoading}>
          {detailRecord ? (
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label={t(`${R}.detail.code`)}>{detailRecord.receipt_code}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaicaiwu.common.customer')}>{detailRecord.customer_name}</Descriptions.Item>
              <Descriptions.Item label={t('common.status')}>{formatVoucherStatus(detailRecord.status)}</Descriptions.Item>
              <Descriptions.Item label={t(`${R}.col.receiptDate`)}>{detailRecord.receipt_date}</Descriptions.Item>
              <Descriptions.Item label={t(`${R}.col.paymentMethod`)}>{formatPaymentMethod(detailRecord.payment_method, t)}</Descriptions.Item>
              <Descriptions.Item label={t(`${R}.settlementType.label`)}>
                {formatReceiptSettlementType(detailRecord.settlement_type, t)}
              </Descriptions.Item>
              <Descriptions.Item label={t(`${R}.col.amount`)}>¥{Number(detailRecord.total_amount).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label={t(`${R}.detail.settled`)}>¥{Number(detailRecord.settled_amount).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label={t(`${R}.detail.unsettled`)}>¥{Number(detailRecord.unsettled_amount).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label={t(`${R}.detail.bankAccount`)}>{resolveBankLabel(detailRecord.bank_account_id)}</Descriptions.Item>
              <Descriptions.Item label={t(`${R}.detail.accountNote`)}>{detailRecord.bank_account || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaicaiwu.common.notes')}>{detailRecord.notes || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('common.createdAt')}>
                {detailRecord.created_at ? formatDateTime(detailRecord.created_at, 'YYYY-MM-DD HH:mm') : '—'}
              </Descriptions.Item>
            </Descriptions>
          ) : null}
        </Spin>
      </Drawer>
    </ListPageTemplate>
  );
};

export default ReceiptsPage;
