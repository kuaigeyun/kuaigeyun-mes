/**
 * 收款单列表页
 *
 * 记录从客户收取的款项，可用于核销应收单。
 */
import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Typography, Tag, Drawer, Descriptions, Spin } from 'antd';
import { ModalForm, ProFormDatePicker, ProFormMoney, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { EyeOutlined, PlusOutlined } from '@ant-design/icons';
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
import { receivableService } from '../../../services/finance/receivable';
import { receiptService } from '../../../services/finance/receipt';
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
import { formatDateTime } from '../../../../../utils/format';

interface ReceiptVoucher {
  id: number;
  receipt_code: string;
  customer_id: number;
  customer_name: string;
  total_amount: number;
  settled_amount: number;
  unsettled_amount: number;
  receipt_date: string;
  payment_method: string;
  bank_account?: string;
  bank_account_id?: number;
  settlement_type?: string;
  status: string;
  notes?: string;
  created_at: string;
}

type PullReceivableCandidate = {
  id: number;
  receivable_code: string;
  customer_id: number;
  customer_name: string;
  due_date?: string;
  review_status?: string;
  status?: string;
  remaining_amount: number;
};

const R = 'app.kuaicaiwu.receipt';

const ReceiptsPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [createModalVisible, setCreateModalVisible] = useState(false);
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

  const loadPullReceivableCandidates = async (
    keyword: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: PullReceivableCandidate[]; total: number }> => {
    const kw = keyword.trim().toLowerCase();
    const res = await receivableService.listReceivables({ skip: 0, limit: 200 });
    const rows = (res?.items || [])
      .filter((r: any) => Number(r?.remaining_amount || 0) > 0)
      .map((r: any) => ({
        id: Number(r.id),
        receivable_code: String(r.receivable_code || ''),
        customer_id: Number(r.customer_id),
        customer_name: String(r.customer_name || ''),
        due_date: r.due_date,
        review_status: r.review_status,
        status: r.status,
        remaining_amount: Number(r.remaining_amount || 0),
      }))
      .filter((r: PullReceivableCandidate) => {
        if (!kw) return true;
        return `${r.receivable_code} ${r.customer_name}`.toLowerCase().includes(kw);
      });
    const start = (page - 1) * pageSize;
    return { data: rows.slice(start, start + pageSize), total: rows.length };
  };

  const pullFromReceivableQuery = useUniPullQuery<PullReceivableCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        return await loadPullReceivableCandidates(keyword, page, pageSize);
      } catch {
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (record) => Number(record.remaining_amount || 0) <= 0,
    onConfirm: async (keys, rows) => {
      const selected = rows.find((x) => String(x.id) === String(keys[0]));
      if (!selected) {
        messageApi.warning(t('app.kuaicaiwu.common.selectSource', { source: pullFromReceivableAction.sourceLabel }));
        return;
      }
    if (selected.remaining_amount <= 0) {
      messageApi.warning(t('app.kuaicaiwu.common.sourceNoRemaining', {
        source: pullFromReceivableAction.sourceLabel,
        target: pullFromReceivableAction.targetLabel,
      }));
      return;
    }
      setPullSubmitting(true);
      try {
        await apiRequest('/apps/kuaicaiwu/receipts', {
          method: 'POST',
          data: {
            customer_id: selected.customer_id,
            customer_name: selected.customer_name,
            total_amount: selected.remaining_amount,
            receipt_date: formatDateTime(dayjs(), 'YYYY-MM-DD'),
            payment_method: '银行转账',
            notes: t('app.kuaicaiwu.common.createdFromSourceNote', {
              source: pullFromReceivableAction.sourceLabel,
              code: selected.receivable_code,
            }),
          },
        });
        messageApi.success(t('app.kuaicaiwu.common.createdFromSource', {
          source: pullFromReceivableAction.sourceLabel,
          target: pullFromReceivableAction.targetLabel,
        }));
        pullFromReceivableQuery.closeModal();
        actionRef.current?.reload();
      } catch (e: any) {
        messageApi.error(e?.response?.data?.detail || e?.message || t('common.createFailed'));
      } finally {
        setPullSubmitting(false);
      }
    },
  });

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

  const pullTableColumns = useMemo(() => [
    { title: t(`${R}.pullCol.receivableCode`), dataIndex: 'receivable_code', width: 220, ellipsis: true },
    { title: t('app.kuaicaiwu.common.customer'), dataIndex: 'customer_name', width: 220, ellipsis: true },
    { title: t('app.kuaicaiwu.common.businessStatus'), dataIndex: 'status', width: 120, align: 'center' as const },
    { title: t('app.kuaicaiwu.common.reviewStatus'), dataIndex: 'review_status', width: 120, align: 'center' as const },
    {
      title: t('app.kuaicaiwu.common.dueDate'),
      dataIndex: 'due_date',
      width: 120,
      render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-'),
    },
    {
      title: t('app.kuaicaiwu.receivable.col.remainingAmount'),
      dataIndex: 'remaining_amount',
      width: 140,
      align: 'right' as const,
      render: (v: number) => `¥${Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
    },
    {
      title: t(`${R}.pullCol.canCreate`),
      key: 'can_create',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, r: PullReceivableCandidate) => (
        Number(r.remaining_amount || 0) > 0
          ? <Tag color="success">{t(`${R}.pullTag.canCreate`)}</Tag>
          : <Tag>{t(`${R}.pullTag.cannotCreate`)}</Tag>
      ),
    },
  ], [t]);

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
    {
      title: t(`${R}.col.code`),
      dataIndex: 'receipt_code',
      width: 168,
      fixed: 'left',
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
    },
    {
      title: t(`${R}.col.totalAmount`),
      dataIndex: 'total_amount',
      valueType: 'money',
      align: 'right',
      width: 130,
    },
    {
      title: t(`${R}.col.settledAmount`),
      dataIndex: 'settled_amount',
      valueType: 'money',
      align: 'right',
      width: 120,
    },
    {
      title: t(`${R}.col.unsettledAmount`),
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
      title: t(`${R}.col.receiptDate`),
      dataIndex: 'receipt_date',
      valueType: 'date',
      width: 110,
    },
    {
      title: t(`${R}.col.paymentMethod`),
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
  ], [t, navigate]);

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
        request={async (params, _sort, _filter, searchFormValues) => {
          const { current, pageSize, status, customer_id, start_date, end_date } = params;
          const res = await apiRequest<any>('/apps/kuaicaiwu/receipts', {
            params: {
              skip: ((current || 1) - 1) * (pageSize || 20),
              limit: pageSize || 20,
              status: searchFormValues?.status ?? status,
              customer_id: searchFormValues?.customer_id ?? customer_id,
              start_date: searchFormValues?.start_date ?? start_date,
              end_date: searchFormValues?.end_date ?? end_date,
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
        confirmLoading={pullSubmitting || pullFromReceivableQuery.confirmLoading}
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
        okText={t('app.kuaicaiwu.common.createTarget', { target: pullFromReceivableAction.targetLabel })}
      />

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
