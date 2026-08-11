import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProFormMoney, ProFormSelect, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Tabs, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { FormModalTemplate, MultiTabListPageTemplate, MODAL_CONFIG, type StatCard } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { apiRequest } from '../../../../../services/api';
import { receiptService, type ReceiptListParams } from '../../../services/finance/receipt';
import { paymentService, type PaymentListParams } from '../../../services/finance/payment';
import { bankAccountService, type BankAccount } from '../../../services/finance/bank-account';
import { documentReconciliationService } from '../../../services/finance/document-reconciliation';
import { prepaymentService } from '../../../services/finance/prepayment';
import { receivableService } from '../../../services/finance/receivable';
import { payableService } from '../../../services/finance/payable';
import { useTranslation } from 'react-i18next';
import { formatSettlementType } from '../../../utils/financeUiLabels';
import { buildVoucherStatusEnum, assertBankAccountForPaymentMethod, getPaymentMethodOptions, BANK_TRANSFER_PAYMENT_METHOD } from '../../../utils/financeSharedOptions';
import {
  LedgerAccountFormFields,
  resolveLedgerAccountNote,
} from '../../../components/LedgerAccountFormFields';
import { formatDateTime } from '../../../../../utils/format';
import { normalizeDocumentAttachments } from '../../../../kuaizhizao/utils/documentAttachments';
import DocumentAttachmentsField from '../../../../kuaizhizao/components/DocumentAttachmentsField';
import type { TFunction } from 'i18next';
import {
  FINANCE_DOC_PINNED_STATUS_FIELD,
  financeDocCodePartnerSearchColumns,
  financeDocCreatedUpdatedColumns,
  prepaymentBalanceSearchColumns,
  resolvePaymentListParams,
  resolvePrepaymentBalanceListParams,
  resolveReceiptListParams,
} from '../../../utils/financeListCore';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';

type PrepaymentRow = Record<string, unknown>;

const P = 'app.kuaicaiwu.prepayment';
const PREPAYMENT_RESOURCE = 'kuaicaiwu:prepayment';

const prepaymentTag = (type: string | undefined, t: TFunction) => {
  const label = formatSettlementType(type, t);
  if (type === 'prepayment') {
    return <Tag color="blue">{label}</Tag>;
  }
  return <Tag>{label}</Tag>;
};

const PrepaymentsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();
  const customerBalanceRef = useRef<ActionType>();
  const supplierBalanceRef = useRef<ActionType>();
  const receiptRef = useRef<ActionType>();
  const paymentRef = useRef<ActionType>();
  const receiptLastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const paymentLastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const [activeTab, setActiveTab] = useState('receipt');
  const [receiptSubTab, setReceiptSubTab] = useState('summary');
  const [paymentSubTab, setPaymentSubTab] = useState('summary');
  const [applyReceiptVisible, setApplyReceiptVisible] = useState(false);
  const [applyPaymentVisible, setApplyPaymentVisible] = useState(false);
  const [createReceiptVisible, setCreateReceiptVisible] = useState(false);
  const [createPaymentVisible, setCreatePaymentVisible] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<PrepaymentRow | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PrepaymentRow | null>(null);
  const [receivableOptions, setReceivableOptions] = useState<{ label: string; value: number; remaining: number }[]>([]);
  const [payableOptions, setPayableOptions] = useState<{ label: string; value: number; remaining: number }[]>([]);
  const [customerOptions, setCustomerOptions] = useState<{ label: string; value: number }[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<{ label: string; value: number }[]>([]);
  const prepaymentPerms = useResourcePermissions(PREPAYMENT_RESOURCE);
  const paymentMethodOptions = useMemo(() => getPaymentMethodOptions(t), [t]);

  const { data: balances } = useQuery({
    queryKey: ['prepaymentBalances'],
    queryFn: () => documentReconciliationService.getPrepaymentBalances(),
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [customerRes, supplierRes, bankRes] = await Promise.all([
          apiRequest<unknown>('/apps/master-data/supply-chain/customers', { params: { limit: 1000, is_active: true } }),
          apiRequest<unknown>('/apps/master-data/supply-chain/suppliers', { params: { limit: 1000, is_active: true } }),
          bankAccountService.list({ skip: 0, limit: 500, is_active: true }), // API le=500
        ]);
        if (cancelled) return;
        setBankAccounts(bankRes?.data || []);
        const mapOptions = (res: unknown) => {
          const list = Array.isArray(res) ? res : (res as { data?: unknown[]; items?: unknown[] })?.data ?? (res as { items?: unknown[] })?.items ?? [];
          return (Array.isArray(list) ? list : []).map((row: { id: number; name?: string; customer_name?: string; supplier_name?: string; code?: string }) => ({
            label: row.name || row.customer_name || row.supplier_name || row.code || String(row.id),
            value: row.id,
          }));
        };
        setCustomerOptions(mapOptions(customerRes));
        setSupplierOptions(mapOptions(supplierRes));
      } catch {
        if (!cancelled) {
          setCustomerOptions([]);
          setSupplierOptions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const statCards: StatCard[] = useMemo(
    () => [
      {
        key: 'customer',
        title: t(`${P}.statCustomerTotal`),
        value: balances?.total_customer_prepayment ?? 0,
        precision: 2,
        prefix: '¥',
      },
      {
        key: 'supplier',
        title: t(`${P}.statSupplierTotal`),
        value: balances?.total_supplier_prepayment ?? 0,
        precision: 2,
        prefix: '¥',
      },
    ],
    [balances, t],
  );

  const balanceColumns: ProColumns<PrepaymentRow>[] = useMemo(() => [
    ...prepaymentBalanceSearchColumns(t(`${P}.col.partner`)),
    { title: t(`${P}.col.partner`), dataIndex: 'partner_name', ellipsis: true, hideInSearch: true, sorter: true },
    { title: t(`${P}.col.balance`), dataIndex: 'prepayment_balance', valueType: 'money', align: 'right', hideInSearch: true, sorter: true },
    {
      title: t(`${P}.col.docCount`),
      dataIndex: 'receipt_count',
      hideInSearch: true,
      sorter: true,
      render: (_, r) => r.receipt_count ?? r.payment_count,
    },
  ], [t]);

  const receiptColumns: ProColumns<PrepaymentRow>[] = useMemo(() => [
    ...financeDocCodePartnerSearchColumns({
      docCodeLabel: t(`${P}.col.receiptCode`),
      docCodeField: 'receipt_code',
      partnerLabel: t('app.kuaicaiwu.common.customer'),
      partnerIdField: 'customer_id',
      partnerNameField: 'customer_name',
      partnerOptions: customerOptions,
    }),
    {
      title: t(`${P}.col.receiptCode`),
      dataIndex: 'receipt_code',
      width: 160,
      hideInSearch: true,
      sorter: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.receipt_code ?? '') }} ellipsis>
          {String(r.receipt_code ?? '-')}
        </Typography.Text>
      ),
    },
    { title: t('app.kuaicaiwu.common.customer'), dataIndex: 'customer_name', ellipsis: true, hideInSearch: true, sorter: true },
    {
      title: t(`${P}.col.receiptDate`),
      dataIndex: 'receipt_date',
      valueType: 'date',
      width: 132,
      uniTableKeepWidth: true,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t(`${P}.col.receiptDate`),
      dataIndex: 'receipt_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      order: 20,
      formItemProps: formDateRangeFormItemProps,
    },
    { title: t(`${P}.col.receiptAmount`), dataIndex: 'total_amount', valueType: 'money', align: 'right', hideInSearch: true, sorter: true },
    { title: t(`${P}.col.unsettledBalance`), dataIndex: 'unsettled_amount', valueType: 'money', align: 'right', hideInSearch: true, sorter: true },
    {
      title: t(`${P}.col.settlementMethod`),
      dataIndex: 'settlement_type',
      width: 100,
      hideInSearch: true,
      render: (_, r) => prepaymentTag(String(r.settlement_type ?? 'normal'), t),
    },
    {
      title: t(`${P}.col.status`),
      dataIndex: 'status',
      width: 100,
      hideInSearch: true,
      sorter: true,
      valueType: 'select',
      valueEnum: buildVoucherStatusEnum(t),
    },
    ...financeDocCreatedUpdatedColumns<PrepaymentRow>(t),
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 100,
      render: (_, r) => [
        prepaymentPerms.canUpdate ? (
        <a
          key="apply"
          onClick={async () => {
            setSelectedReceipt(r);
            const res = await receivableService.listReceivables({
              skip: 0,
              limit: 200,
              customer_id: Number(r.customer_id),
              pending_settlement: true,
            });
            setReceivableOptions((res?.items || []).map((item) => ({
              label: t(`${P}.receivableOption`, {
                code: item.receivable_code,
                amount: item.remaining_amount,
              }),
              value: item.id,
              remaining: Number(item.remaining_amount),
            })));
            setApplyReceiptVisible(true);
          }}
        >
          {t(`${P}.applySettle`)}
        </a>
        ) : null,
      ],
    },
  ], [t, customerOptions, prepaymentPerms.canUpdate]);

  const paymentColumns: ProColumns<PrepaymentRow>[] = useMemo(() => [
    ...financeDocCodePartnerSearchColumns({
      docCodeLabel: t(`${P}.col.paymentCode`),
      docCodeField: 'payment_code',
      partnerLabel: t('app.kuaicaiwu.common.supplier'),
      partnerIdField: 'supplier_id',
      partnerNameField: 'supplier_name',
      partnerOptions: supplierOptions,
    }),
    {
      title: t(`${P}.col.paymentCode`),
      dataIndex: 'payment_code',
      width: 160,
      hideInSearch: true,
      sorter: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.payment_code ?? '') }} ellipsis>
          {String(r.payment_code ?? '-')}
        </Typography.Text>
      ),
    },
    { title: t('app.kuaicaiwu.common.supplier'), dataIndex: 'supplier_name', ellipsis: true, hideInSearch: true, sorter: true },
    {
      title: t(`${P}.col.paymentDate`),
      dataIndex: 'payment_date',
      valueType: 'date',
      width: 132,
      uniTableKeepWidth: true,
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
    { title: t(`${P}.col.paymentAmount`), dataIndex: 'total_amount', valueType: 'money', align: 'right', hideInSearch: true, sorter: true },
    { title: t(`${P}.col.unsettledBalance`), dataIndex: 'unsettled_amount', valueType: 'money', align: 'right', hideInSearch: true, sorter: true },
    {
      title: t(`${P}.col.settlementMethod`),
      dataIndex: 'settlement_type',
      width: 100,
      hideInSearch: true,
      render: (_, r) => prepaymentTag(String(r.settlement_type ?? 'normal'), t),
    },
    {
      title: t(`${P}.col.status`),
      dataIndex: 'status',
      width: 100,
      hideInSearch: true,
      sorter: true,
      valueType: 'select',
      valueEnum: buildVoucherStatusEnum(t),
    },
    ...financeDocCreatedUpdatedColumns<PrepaymentRow>(t),
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 100,
      render: (_, r) => [
        prepaymentPerms.canUpdate ? (
        <a
          key="apply"
          onClick={async () => {
            setSelectedPayment(r);
            const res = await payableService.listPayables({
              skip: 0,
              limit: 200,
              supplier_id: Number(r.supplier_id),
              pending_settlement: true,
            });
            setPayableOptions((res?.items || []).map((item) => ({
              label: t(`${P}.payableOption`, {
                code: item.payable_code,
                amount: item.remaining_amount,
              }),
              value: item.id,
              remaining: Number(item.remaining_amount),
            })));
            setApplyPaymentVisible(true);
          }}
        >
          {t(`${P}.applySettle`)}
        </a>
        ) : null,
      ],
    },
  ], [t, supplierOptions, prepaymentPerms.canUpdate]);

  const reloadBalanceTables = () => {
    queryClient.invalidateQueries({ queryKey: ['prepaymentBalances'] });
    customerBalanceRef.current?.reload();
    supplierBalanceRef.current?.reload();
  };

  const tabs = useMemo(() => {
    const receiptCreateBtn = prepaymentPerms.canCreate ? (
      <Button
        key="create-prepayment-receipt"
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => setCreateReceiptVisible(true)}
      >
        {t(`${P}.createPreReceipt`)}
      </Button>
    ) : null;
    const paymentCreateBtn = prepaymentPerms.canCreate ? (
      <Button
        key="create-prepayment-payment"
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => setCreatePaymentVisible(true)}
      >
        {t(`${P}.createPrePayment`)}
      </Button>
    ) : null;

    return [
      {
        key: 'receipt',
        label: t(`${P}.tabReceipt`),
        children: (
          <Tabs
            activeKey={receiptSubTab}
            onChange={setReceiptSubTab}
            destroyOnHidden={false}
            items={[
              {
                key: 'summary',
                label: t(`${P}.tabSubSummary`),
                children: (
                  <UniTable<PrepaymentRow>
                    actionRef={customerBalanceRef}
                    enableRowSelection
                    rowKey={(r) => `c-${r.partner_id}`}
                    columnPersistenceId="apps.kuaicaiwu.pages.finance-management.prepayments.customer-balance"
                    columns={balanceColumns}
                    showAdvancedSearch
                    skipFuzzyPinyinClientFilter
                    request={async (params, sort, _filter, searchFormValues) => {
                      const { current, pageSize } = params;
                      const listParams = resolvePrepaymentBalanceListParams(searchFormValues, sort);
                      try {
                        const res = await documentReconciliationService.getPrepaymentBalances({
                          partner_type: 'customer',
                          skip: ((current || 1) - 1) * (pageSize || 20),
                          limit: pageSize || 20,
                          ...listParams,
                        });
                        return {
                          data: (res?.items || []) as PrepaymentRow[],
                          total: res?.total || 0,
                          success: true,
                        };
                      } catch (error: unknown) {
                        const err = error as { message?: string };
                        messageApi.error(err?.message || t('app.kuaicaiwu.common.loadListFailed'));
                        return { data: [], total: 0, success: false };
                      }
                    }}
                    pagination={{ pageSize: 20 }}
                    toolBarRender={() => [receiptCreateBtn].filter(Boolean)}
                  />
                ),
              },
              {
                key: 'detail',
                label: t(`${P}.tabSubDetail`),
                children: (
                  <UniTable<PrepaymentRow>
                    actionRef={receiptRef}
                    enableRowSelection
                    rowKey="id"
                    columnPersistenceId="apps.kuaicaiwu.pages.finance-management.prepayments.receipts"
                    columns={receiptColumns}
                    showAdvancedSearch
                    skipFuzzyPinyinClientFilter
                    pinnedTabsField={FINANCE_DOC_PINNED_STATUS_FIELD}
                    request={async (params, sort, _filter, searchFormValues) => {
                      const { current, pageSize } = params;
                      const listParams = resolveReceiptListParams(searchFormValues, sort);
                      receiptLastListParamsRef.current = listParams;
                      const apiParams: ReceiptListParams = {
                        skip: ((current || 1) - 1) * (pageSize || 20),
                        limit: pageSize || 20,
                        settlement_type: 'prepayment',
                        unsettled_only: true,
                        ...listParams,
                      };
                      try {
                        const res = await receiptService.listReceipts(apiParams);
                        return {
                          data: (res?.items || []) as PrepaymentRow[],
                          total: res?.total || 0,
                          success: true,
                        };
                      } catch (error: unknown) {
                        const err = error as { message?: string };
                        messageApi.error(err?.message || t('app.kuaicaiwu.common.loadListFailed'));
                        return { data: [], total: 0, success: false };
                      }
                    }}
                    pagination={{ pageSize: 20 }}
                    toolBarRender={() => [receiptCreateBtn].filter(Boolean)}
                  />
                ),
              },
            ]}
          />
        ),
      },
      {
        key: 'payment',
        label: t(`${P}.tabPayment`),
        children: (
          <Tabs
            activeKey={paymentSubTab}
            onChange={setPaymentSubTab}
            destroyOnHidden={false}
            items={[
              {
                key: 'summary',
                label: t(`${P}.tabSubSummary`),
                children: (
                  <UniTable<PrepaymentRow>
                    actionRef={supplierBalanceRef}
                    enableRowSelection
                    rowKey={(r) => `s-${r.partner_id}`}
                    columnPersistenceId="apps.kuaicaiwu.pages.finance-management.prepayments.supplier-balance"
                    columns={balanceColumns}
                    showAdvancedSearch
                    skipFuzzyPinyinClientFilter
                    request={async (params, sort, _filter, searchFormValues) => {
                      const { current, pageSize } = params;
                      const listParams = resolvePrepaymentBalanceListParams(searchFormValues, sort);
                      try {
                        const res = await documentReconciliationService.getPrepaymentBalances({
                          partner_type: 'supplier',
                          skip: ((current || 1) - 1) * (pageSize || 20),
                          limit: pageSize || 20,
                          ...listParams,
                        });
                        return {
                          data: (res?.items || []) as PrepaymentRow[],
                          total: res?.total || 0,
                          success: true,
                        };
                      } catch (error: unknown) {
                        const err = error as { message?: string };
                        messageApi.error(err?.message || t('app.kuaicaiwu.common.loadListFailed'));
                        return { data: [], total: 0, success: false };
                      }
                    }}
                    pagination={{ pageSize: 20 }}
                    toolBarRender={() => [paymentCreateBtn].filter(Boolean)}
                  />
                ),
              },
              {
                key: 'detail',
                label: t(`${P}.tabSubDetail`),
                children: (
                  <UniTable<PrepaymentRow>
                    actionRef={paymentRef}
                    enableRowSelection
                    rowKey="id"
                    columnPersistenceId="apps.kuaicaiwu.pages.finance-management.prepayments.payments"
                    columns={paymentColumns}
                    showAdvancedSearch
                    skipFuzzyPinyinClientFilter
                    pinnedTabsField={FINANCE_DOC_PINNED_STATUS_FIELD}
                    request={async (params, sort, _filter, searchFormValues) => {
                      const { current, pageSize } = params;
                      const listParams = resolvePaymentListParams(searchFormValues, sort);
                      paymentLastListParamsRef.current = listParams;
                      const apiParams: PaymentListParams = {
                        skip: ((current || 1) - 1) * (pageSize || 20),
                        limit: pageSize || 20,
                        settlement_type: 'prepayment',
                        unsettled_only: true,
                        ...listParams,
                      };
                      try {
                        const res = await paymentService.listPayments(apiParams);
                        return {
                          data: (res?.items || []) as PrepaymentRow[],
                          total: res?.total || 0,
                          success: true,
                        };
                      } catch (error: unknown) {
                        const err = error as { message?: string };
                        messageApi.error(err?.message || t('app.kuaicaiwu.common.loadListFailed'));
                        return { data: [], total: 0, success: false };
                      }
                    }}
                    pagination={{ pageSize: 20 }}
                    toolBarRender={() => [paymentCreateBtn].filter(Boolean)}
                  />
                ),
              },
            ]}
          />
        ),
      },
    ];
  }, [
    balanceColumns,
    messageApi,
    paymentColumns,
    paymentSubTab,
    prepaymentPerms.canCreate,
    receiptColumns,
    receiptSubTab,
    t,
  ]);

  return (
    <>
      <MultiTabListPageTemplate
        statCards={statCards}
        activeTabKey={activeTab}
        onTabChange={setActiveTab}
        preserveMounted
        tabs={tabs}
      />

      <FormModalTemplate
        title={t(`${P}.convertReceipt`)}
        open={applyReceiptVisible}
        onClose={() => setApplyReceiptVisible(false)}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        initialValues={{
          amount: selectedReceipt ? Number(selectedReceipt.unsettled_amount) : undefined,
        }}
        onFinish={async (values) => {
          if (!selectedReceipt) return;
          await prepaymentService.applyToReceivable({
            receipt_id: Number(selectedReceipt.id),
            receivable_id: values.receivable_id,
            amount: values.amount,
          });
          messageApi.success(t(`${P}.settleSuccessReceipt`));
          reloadBalanceTables();
          receiptRef.current?.reload();
          setApplyReceiptVisible(false);
        }}
      >
        <ProFormSelect
          name="receivable_id"
          label={t(`${P}.targetReceivable`)}
          rules={[{ required: true }]}
          options={receivableOptions}
          showSearch
        />
        <ProFormMoney
          name="amount"
          label={t(`${P}.settleAmount`)}
          min={0.01}
          max={selectedReceipt ? Number(selectedReceipt.unsettled_amount) : undefined}
          rules={[{ required: true }]}
        />
      </FormModalTemplate>

      <FormModalTemplate
        title={t(`${P}.convertPayment`)}
        open={applyPaymentVisible}
        onClose={() => setApplyPaymentVisible(false)}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        initialValues={{
          amount: selectedPayment ? Number(selectedPayment.unsettled_amount) : undefined,
        }}
        onFinish={async (values) => {
          if (!selectedPayment) return;
          await prepaymentService.applyToPayable({
            payment_id: Number(selectedPayment.id),
            payable_id: values.payable_id,
            amount: values.amount,
          });
          messageApi.success(t(`${P}.settleSuccessPayment`));
          reloadBalanceTables();
          paymentRef.current?.reload();
          setApplyPaymentVisible(false);
        }}
      >
        <ProFormSelect
          name="payable_id"
          label={t(`${P}.targetPayable`)}
          rules={[{ required: true }]}
          options={payableOptions}
          showSearch
        />
        <ProFormMoney
          name="amount"
          label={t(`${P}.settleAmount`)}
          min={0.01}
          max={selectedPayment ? Number(selectedPayment.unsettled_amount) : undefined}
          rules={[{ required: true }]}
        />
      </FormModalTemplate>

      <FormModalTemplate
        title={t(`${P}.createPreReceipt`)}
        open={createReceiptVisible}
        onClose={() => setCreateReceiptVisible(false)}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        initialValues={{
          receipt_date: dayjs(),
          payment_method: BANK_TRANSFER_PAYMENT_METHOD,
          settlement_type: 'prepayment',
        }}
        onFinish={async (values) => {
          try {
            assertBankAccountForPaymentMethod(values.payment_method, values.bank_account_id, t);
          } catch (e: unknown) {
            messageApi.warning((e as Error).message);
            return false;
          }
          await receiptService.create({
            customer_id: values.customer_id,
            customer_name: customerOptions.find((o) => o.value === values.customer_id)?.label || '',
            total_amount: values.total_amount,
            receipt_date: formatDateTime(values.receipt_date || dayjs(), 'YYYY-MM-DD'),
            payment_method: values.payment_method,
            bank_account_id: values.bank_account_id,
            bank_account: resolveLedgerAccountNote(bankAccounts, values.bank_account_id, values.bank_account),
            settlement_type: 'prepayment',
            notes: values.notes,
            attachments: normalizeDocumentAttachments(values.attachments),
          });
          messageApi.success(t(`${P}.createPreReceiptSuccess`));
          reloadBalanceTables();
          receiptRef.current?.reload();
          setCreateReceiptVisible(false);
          setActiveTab('receipt');
          setReceiptSubTab('detail');
          return true;
        }}
      >
        <ProFormSelect
          name="customer_id"
          label={t('app.kuaicaiwu.common.customer')}
          rules={[{ required: true }]}
          options={customerOptions}
          showSearch
        />
        <ProFormDatePicker
          name="receipt_date"
          label={t(`${P}.col.receiptDate`)}
          rules={[{ required: true }]}
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormMoney name="total_amount" label={t(`${P}.col.receiptAmount`)} min={0.01} rules={[{ required: true }]} />
        <ProFormSelect name="payment_method" label={t('app.kuaicaiwu.receipt.col.paymentMethod')} options={paymentMethodOptions} rules={[{ required: true }]} />
        <LedgerAccountFormFields
          accounts={bankAccounts}
          accountLabel={t('app.kuaicaiwu.receipt.bankAccount')}
          noteLabel={t('app.kuaicaiwu.receipt.bankAccountNote')}
        />
        <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} />
        <DocumentAttachmentsField name="attachments" />
      </FormModalTemplate>

      <FormModalTemplate
        title={t(`${P}.createPrePayment`)}
        open={createPaymentVisible}
        onClose={() => setCreatePaymentVisible(false)}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        initialValues={{
          payment_date: dayjs(),
          payment_method: BANK_TRANSFER_PAYMENT_METHOD,
          settlement_type: 'prepayment',
        }}
        onFinish={async (values) => {
          try {
            assertBankAccountForPaymentMethod(values.payment_method, values.bank_account_id, t);
          } catch (e: unknown) {
            messageApi.warning((e as Error).message);
            return false;
          }
          await paymentService.create({
            supplier_id: values.supplier_id,
            supplier_name: supplierOptions.find((o) => o.value === values.supplier_id)?.label || '',
            total_amount: values.total_amount,
            payment_date: formatDateTime(values.payment_date || dayjs(), 'YYYY-MM-DD'),
            payment_method: values.payment_method,
            bank_account_id: values.bank_account_id,
            bank_account: resolveLedgerAccountNote(bankAccounts, values.bank_account_id, values.bank_account),
            settlement_type: 'prepayment',
            notes: values.notes,
            attachments: normalizeDocumentAttachments(values.attachments),
          });
          messageApi.success(t(`${P}.createPrePaymentSuccess`));
          reloadBalanceTables();
          paymentRef.current?.reload();
          setCreatePaymentVisible(false);
          setActiveTab('payment');
          setPaymentSubTab('detail');
          return true;
        }}
      >
        <ProFormSelect
          name="supplier_id"
          label={t('app.kuaicaiwu.common.supplier')}
          rules={[{ required: true }]}
          options={supplierOptions}
          showSearch
        />
        <ProFormDatePicker
          name="payment_date"
          label={t(`${P}.col.paymentDate`)}
          rules={[{ required: true }]}
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormMoney name="total_amount" label={t(`${P}.col.paymentAmount`)} min={0.01} rules={[{ required: true }]} />
        <ProFormSelect name="payment_method" label={t('app.kuaicaiwu.payment.col.paymentMethod')} options={paymentMethodOptions} rules={[{ required: true }]} />
        <LedgerAccountFormFields
          accounts={bankAccounts}
          accountLabel={t('app.kuaicaiwu.payment.outBankAccount')}
          noteLabel={t('app.kuaicaiwu.payment.outAccountNote')}
        />
        <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} />
        <DocumentAttachmentsField name="attachments" />
      </FormModalTemplate>
    </>
  );
};

export default PrepaymentsPage;
