/**
 * 付款单列表页
 *
 * 记录向供应商支付的款项，可用于核销应付单。
 */
import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Typography, Tag, Drawer, Descriptions, Spin } from 'antd';
import { ModalForm, ProFormDatePicker, ProFormMoney, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { PlusOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import dayjs from 'dayjs';
import { getFinanceVoucherLifecycle } from '../../../utils/financeLifecycle';
import { payableService } from '../../../services/finance/payable';
import { bankAccountService, type BankAccount } from '../../../services/finance/bank-account';
import { paymentService } from '../../../services/finance/payment';
import { buildKuaicaiwuPullCreateMenuItems, getKuaicaiwuDocumentAction } from '../../../constants/documentActionRegistry';
import {
  buildVoucherStatusEnum,
  formatPaymentMethod,
  formatPaymentSettlementType,
  getPaymentMethodOptions,
  getPaymentSettlementTypeOptions,
} from '../../../utils/financeSharedOptions';
import DocumentAttachmentsField from '../../../../kuaizhizao/components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../../kuaizhizao/utils/documentAttachments';
import { getStatusDisplay } from '../../../../kuaizhizao/constants/documentStatus';
import { formatDateTime } from '../../../../../utils/format';

interface PaymentVoucher {
  id: number;
  payment_code: string;
  supplier_id: number;
  supplier_name: string;
  total_amount: number;
  settled_amount: number;
  unsettled_amount: number;
  payment_date: string;
  payment_method: string;
  bank_account?: string;
  bank_account_id?: number;
  settlement_type?: string;
  status: string;
  notes?: string;
  created_at: string;
}

type PullPayableCandidate = {
  id: number;
  payable_code: string;
  supplier_id: number;
  supplier_name: string;
  due_date?: string;
  review_status?: string;
  status?: string;
  remaining_amount: number;
};

const P = 'app.kuaicaiwu.payment';

const PaymentsPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [pullSubmitting, setPullSubmitting] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [pullFormVisible, setPullFormVisible] = useState(false);
  const [pullSelectedPayable, setPullSelectedPayable] = useState<PullPayableCandidate | null>(null);
  const [supplierOptions, setSupplierOptions] = useState<{ label: string; value: number }[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRecord, setDetailRecord] = useState<PaymentVoucher | null>(null);
  const { message: messageApi } = App.useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pullFromPayableAction = getKuaicaiwuDocumentAction('payment.pull_from_payable');

  const paymentMethodOptions = useMemo(() => getPaymentMethodOptions(t), [t]);
  const paymentSettlementTypeOptions = useMemo(() => getPaymentSettlementTypeOptions(t), [t]);

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
    bankAccountService.list({ limit: 200, is_active: true }).then(setBankAccounts).catch(() => setBankAccounts([]));
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

  const openDetail = async (record: PaymentVoucher) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const detail = await paymentService.getPayment(record.id);
      setDetailRecord(detail);
    } catch (error: any) {
      messageApi.error(error.message || t(`${P}.loadDetailFailed`));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    const bank = bankAccountOptions.find((o) => o.value === values.bank_account_id);
    const data = {
      supplier_id: values.supplier_id,
      supplier_name: supplierOptions.find(o => o.value === values.supplier_id)?.label || '',
      total_amount: values.total_amount,
      payment_date: formatDateTime(values.payment_date || dayjs(), 'YYYY-MM-DD'),
      payment_method: values.payment_method,
      bank_account_id: values.bank_account_id,
      bank_account: bank?.account_number || values.bank_account,
      settlement_type: values.settlement_type || 'normal',
      notes: values.notes,
      attachments: normalizeDocumentAttachments(values.attachments),
    };
    await apiRequest('/apps/kuaicaiwu/payments', { method: 'POST', data });
    messageApi.success(t(`${P}.createSuccess`));
    setCreateModalVisible(false);
    actionRef.current?.reload();
  };

  const loadPullPayableCandidates = async (
    keyword: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: PullPayableCandidate[]; total: number }> => {
    const kw = keyword.trim().toLowerCase();
    const res = await payableService.listPayables({ skip: 0, limit: 200, pending_settlement: true });
    const rows = (res?.items || [])
      .map((r: any) => ({
        id: Number(r.id),
        payable_code: String(r.payable_code || ''),
        supplier_id: Number(r.supplier_id),
        supplier_name: String(r.supplier_name || ''),
        due_date: r.due_date,
        review_status: r.review_status,
        status: r.status,
        remaining_amount: Number(r.remaining_amount || 0),
      }))
      .filter((r: PullPayableCandidate) => {
        if (!kw) return true;
        return `${r.payable_code} ${r.supplier_name}`.toLowerCase().includes(kw);
      });
    const start = (page - 1) * pageSize;
    return { data: rows.slice(start, start + pageSize), total: rows.length };
  };

  const openPullFormFromRows = (keys: React.Key[], rows: PullPayableCandidate[], closeModal: () => void) => {
    const selected = rows.find((x) => String(x.id) === String(keys[0]));
    if (!selected) {
      messageApi.warning(t('app.kuaicaiwu.common.selectSource', { source: pullFromPayableAction.sourceLabel }));
      return;
    }
    if (!selected) return;
    if (selected.remaining_amount <= 0) {
      messageApi.warning(t('app.kuaicaiwu.common.sourceNoRemaining', {
        source: pullFromPayableAction.sourceLabel,
        target: pullFromPayableAction.targetLabel,
      }));
      return;
    }
    setPullSelectedPayable(selected);
    closeModal();
    setPullFormVisible(true);
  };

  const pullFromPayableQuery = useUniPullQuery<PullPayableCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        return await loadPullPayableCandidates(keyword, page, pageSize);
      } catch (e: any) {
        messageApi.error(e?.response?.data?.detail || e?.message || t(`${P}.loadPayableFailed`));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (record) => Number(record.remaining_amount || 0) <= 0,
    onConfirm: async (keys, rows) => {
      openPullFormFromRows(keys, rows, pullFromPayableQuery.closeModal);
    },
  });

  const handlePullCreateSubmit = async (values: any) => {
    if (!pullSelectedPayable) return false;
    const totalAmount = Number(values.total_amount) || 0;
    if (totalAmount <= 0) {
      messageApi.warning(t(`${P}.amountMustPositive`));
      return false;
    }
    setPullSubmitting(true);
    try {
      await apiRequest('/apps/kuaicaiwu/payments', {
        method: 'POST',
        data: {
          supplier_id: pullSelectedPayable.supplier_id,
          supplier_name: pullSelectedPayable.supplier_name,
          total_amount: totalAmount,
          payment_date: formatDateTime(values.payment_date || dayjs(), 'YYYY-MM-DD'),
          payment_method: values.payment_method || '银行转账',
          bank_account_id: values.bank_account_id,
          bank_account: bankAccountOptions.find((o) => o.value === values.bank_account_id)?.account_number || values.bank_account,
          settlement_type: values.settlement_type || 'normal',
          notes: String(values.notes ?? '').trim() || t('app.kuaicaiwu.common.createdFromSourceNote', {
            source: pullFromPayableAction.sourceLabel,
            code: pullSelectedPayable.payable_code,
          }),
          attachments: normalizeDocumentAttachments(values.attachments),
        },
      });
      messageApi.success(t('app.kuaicaiwu.common.createdFromSource', {
        source: pullFromPayableAction.sourceLabel,
        target: pullFromPayableAction.targetLabel,
      }));
      setPullFormVisible(false);
      setPullSelectedPayable(null);
      actionRef.current?.reload();
      return true;
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail || e?.message || t('common.createFailed'));
      return false;
    } finally {
      setPullSubmitting(false);
    }
  };

  const handleConfirm = async (record: PaymentVoucher) => {
    Modal.confirm({
      title: t(`${P}.confirmTitle`),
      content: t(`${P}.confirmContent`, { code: record.payment_code }),
      onOk: async () => {
        try {
          await apiRequest(`/apps/kuaicaiwu/payments/${record.id}/confirm`, { method: 'POST' });
          messageApi.success(t(`${P}.confirmSuccess`));
          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.message || t('common.operationFailed'));
        }
      },
    });
  };

  const handleCancelVoucher = async (record: PaymentVoucher) => {
    Modal.confirm({
      title: t(`${P}.voidTitle`),
      content: t(`${P}.voidContent`, { code: record.payment_code }),
      onOk: async () => {
        try {
          await apiRequest(`/apps/kuaicaiwu/payments/${record.id}/cancel`, { method: 'POST' });
          messageApi.success(t(`${P}.voidSuccess`));
          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.message || t('common.operationFailed'));
        }
      },
    });
  };

  const handleBatchConfirm = async (keys: React.Key[]) => {
    try {
      for (const key of keys) {
        await apiRequest(`/apps/kuaicaiwu/payments/${key}/confirm`, { method: 'POST' });
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
        await apiRequest(`/apps/kuaicaiwu/payments/${key}/cancel`, { method: 'POST' });
      }
      messageApi.success(t(`${P}.batchVoided`, { count: keys.length }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaicaiwu.common.batchVoidFailed'));
    }
  };

  const pullTableColumns = useMemo(() => [
    { title: t(`${P}.pullCol.payableCode`), dataIndex: 'payable_code', width: 220, ellipsis: true },
    { title: t('app.kuaicaiwu.common.supplier'), dataIndex: 'supplier_name', width: 220, ellipsis: true },
    {
      title: t(`${P}.pullCol.docStatus`),
      dataIndex: 'status',
      width: 120,
      align: 'center' as const,
      render: (v: string) => {
        const { text, color } = getStatusDisplay(v);
        return text === '-' ? '-' : <Tag color={color}>{text}</Tag>;
      },
    },
    { title: t('app.kuaicaiwu.common.reviewStatus'), dataIndex: 'review_status', width: 120, align: 'center' as const },
    {
      title: t('app.kuaicaiwu.common.dueDate'),
      dataIndex: 'due_date',
      width: 120,
      render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-'),
    },
    {
      title: t('app.kuaicaiwu.payable.col.remainingAmount'),
      dataIndex: 'remaining_amount',
      width: 140,
      align: 'right' as const,
      render: (v: number) => `¥${Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
    },
    {
      title: t('app.kuaicaiwu.receipt.pullCol.canCreate'),
      key: 'can_create',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, r: PullPayableCandidate) => (
        Number(r.remaining_amount || 0) > 0
          ? <Tag color="success">{t('app.kuaicaiwu.receipt.pullTag.canCreate')}</Tag>
          : <Tag>{t('app.kuaicaiwu.receipt.pullTag.cannotCreate')}</Tag>
      ),
    },
  ], [t]);

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
    {
      title: t(`${P}.col.code`),
      dataIndex: 'payment_code',
      width: 168,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.payment_code ?? '') }} ellipsis>
          {r.payment_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t('app.kuaicaiwu.common.supplier'),
      dataIndex: 'supplier_name',
      width: 200,
    },
    {
      title: t(`${P}.col.totalAmount`),
      dataIndex: 'total_amount',
      valueType: 'money',
      align: 'right',
      width: 130,
    },
    {
      title: t(`${P}.col.settledAmount`),
      dataIndex: 'settled_amount',
      valueType: 'money',
      align: 'right',
      width: 120,
    },
    {
      title: t(`${P}.col.unsettledAmount`),
      dataIndex: 'unsettled_amount',
      align: 'right',
      width: 120,
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
    },
    {
      title: t(`${P}.col.paymentMethod`),
      dataIndex: 'payment_method',
      width: 110,
      render: (_, record) => formatPaymentMethod(record.payment_method, t),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      hideInTable: true,
      valueEnum: buildVoucherStatusEnum(t),
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
              <Button {...rowActionKind('revoke')} key="ca" onClick={() => handleCancelVoucher(record)}>
                {t('app.kuaicaiwu.common.void')}
              </Button>
            ) : null,
          ].filter(Boolean) as React.ReactNode[],
    },
  ], [t, navigate]);

  return (
    <ListPageTemplate>
      <UniTable<PaymentVoucher>
        headerTitle={t(`${P}.pageTitle`)}
        actionRef={actionRef}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        rowKey="id"
        columnPersistenceId="apps.kuaicaiwu.pages.finance-management.payments"
        scroll={{ x: 1680 }}
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
        request={async (params) => {
          const { current, pageSize, ...rest } = params;
          const res = await apiRequest<any>('/apps/kuaicaiwu/payments', {
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
        okText={t('components.uniLifecycle.nextStep')}
      />

      <ModalForm
        title={t(`${P}.fillInfoTitle`)}
        open={pullFormVisible}
        onOpenChange={(open) => {
          if (pullSubmitting) return;
          setPullFormVisible(open);
          if (!open) {
            setPullSelectedPayable(null);
          }
        }}
        onFinish={handlePullCreateSubmit}
        width={480}
        modalProps={{ destroyOnHidden: true }}
        submitter={{ submitButtonProps: { loading: pullSubmitting } }}
        initialValues={
          pullSelectedPayable
            ? {
                payable_code: pullSelectedPayable.payable_code,
                supplier_name: pullSelectedPayable.supplier_name,
                total_amount: pullSelectedPayable.remaining_amount,
                payment_date: dayjs(),
                payment_method: '银行转账',
                notes: t('app.kuaicaiwu.common.createdFromSourceNote', {
                  source: pullFromPayableAction.sourceLabel,
                  code: pullSelectedPayable.payable_code,
                }),
              }
            : undefined
        }
      >
        <ProFormText name="payable_code" label={t(`${P}.sourcePayable`)} readonly />
        <ProFormText name="supplier_name" label={t('app.kuaicaiwu.common.supplier')} readonly />
        <ProFormMoney
          name="total_amount"
          label={t(`${P}.col.amount`)}
          min={0.01}
          rules={[{ required: true }]}
          fieldProps={{ max: pullSelectedPayable?.remaining_amount }}
        />
        <ProFormDatePicker name="payment_date" label={t(`${P}.col.paymentDate`)} rules={[{ required: true }]} fieldProps={{ style: { width: '100%' } }} />
        <ProFormSelect
          name="payment_method"
          label={t(`${P}.col.paymentMethod`)}
          options={paymentMethodOptions}
          rules={[{ required: true, message: t(`${P}.selectPaymentMethod`) }]}
        />
        <ProFormSelect
          name="settlement_type"
          label={t(`${P}.settlementType.label`)}
          initialValue="normal"
          options={paymentSettlementTypeOptions}
        />
        <ProFormSelect
          name="bank_account_id"
          label={t(`${P}.outBankAccount`)}
          options={bankAccountOptions}
          placeholder={t('app.kuaicaiwu.receipt.bankAccountPlaceholder')}
          showSearch
          allowClear
        />
        <ProFormText name="bank_account" label={t(`${P}.outAccountNote`)} placeholder={t('app.kuaicaiwu.receipt.bankAccountNotePlaceholder')} />
        <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} />
        <DocumentAttachmentsField category="payment_attachments" />
      </ModalForm>

      <ModalForm
        title={t(`${P}.createTitle`)}
        open={createModalVisible}
        onOpenChange={setCreateModalVisible}
        onFinish={handleCreate}
        width={480}
      >
        <ProFormSelect
          name="supplier_id"
          label={t('app.kuaicaiwu.common.supplier')}
          options={supplierOptions}
          rules={[{ required: true, message: t('app.kuaicaiwu.common.selectSupplier') }]}
          placeholder={t('app.kuaicaiwu.common.selectSupplier')}
          showSearch
        />
        <ProFormMoney name="total_amount" label={t(`${P}.col.amount`)} min={0.01} rules={[{ required: true }]} />
        <ProFormDatePicker name="payment_date" label={t(`${P}.col.paymentDate`)} rules={[{ required: true }]} initialValue={dayjs()} fieldProps={{ style: { width: '100%' } }} />
        <ProFormSelect
          name="payment_method"
          label={t(`${P}.col.paymentMethod`)}
          options={paymentMethodOptions}
          rules={[{ required: true, message: t(`${P}.selectPaymentMethod`) }]}
          placeholder={t(`${P}.selectPaymentMethod`)}
        />
        <ProFormSelect
          name="settlement_type"
          label={t(`${P}.settlementType.label`)}
          initialValue="normal"
          options={paymentSettlementTypeOptions}
        />
        <ProFormSelect
          name="bank_account_id"
          label={t(`${P}.outBankAccount`)}
          options={bankAccountOptions}
          placeholder={t('app.kuaicaiwu.receipt.bankAccountPlaceholder')}
          showSearch
          allowClear
        />
        <ProFormText name="bank_account" label={t(`${P}.outAccountNote`)} placeholder={t('app.kuaicaiwu.receipt.bankAccountNotePlaceholder')} />
        <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} />
        <DocumentAttachmentsField category="payment_attachments" />
      </ModalForm>

      <Drawer
        title={detailRecord
          ? t(`${P}.detailDrawerTitle`, { code: detailRecord.payment_code })
          : t(`${P}.detailTitle`)}
        open={detailOpen}
        size={520}
        onClose={() => { setDetailOpen(false); setDetailRecord(null); }}
        destroyOnHidden
      >
        <Spin spinning={detailLoading}>
          {detailRecord ? (
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label={t('app.kuaicaiwu.receipt.detail.code')}>{detailRecord.payment_code}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaicaiwu.common.supplier')}>{detailRecord.supplier_name}</Descriptions.Item>
              <Descriptions.Item label={t('common.status')}>{formatVoucherStatus(detailRecord.status)}</Descriptions.Item>
              <Descriptions.Item label={t(`${P}.col.paymentDate`)}>{detailRecord.payment_date}</Descriptions.Item>
              <Descriptions.Item label={t(`${P}.col.paymentMethod`)}>{formatPaymentMethod(detailRecord.payment_method, t)}</Descriptions.Item>
              <Descriptions.Item label={t(`${P}.settlementType.label`)}>
                {formatPaymentSettlementType(detailRecord.settlement_type, t)}
              </Descriptions.Item>
              <Descriptions.Item label={t(`${P}.col.amount`)}>¥{Number(detailRecord.total_amount).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaicaiwu.receipt.detail.settled')}>¥{Number(detailRecord.settled_amount).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaicaiwu.receipt.detail.unsettled')}>¥{Number(detailRecord.unsettled_amount).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaicaiwu.receipt.detail.bankAccount')}>{resolveBankLabel(detailRecord.bank_account_id)}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaicaiwu.receipt.detail.accountNote')}>{detailRecord.bank_account || '—'}</Descriptions.Item>
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

export default PaymentsPage;
