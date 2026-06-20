import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProFormMoney, ProFormSelect } from '@ant-design/pro-components';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Tag } from 'antd';
import { FormModalTemplate, MultiTabListPageTemplate, MODAL_CONFIG, type StatCard } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { receiptService } from '../../../services/finance/receipt';
import { paymentService } from '../../../services/finance/payment';
import { documentReconciliationService } from '../../../services/finance/document-reconciliation';
import { prepaymentService } from '../../../services/finance/prepayment';
import { receivableService } from '../../../services/finance/receivable';
import { payableService } from '../../../services/finance/payable';
import { useTranslation } from 'react-i18next';
import { formatSettlementType } from '../../../utils/financeUiLabels';
import type { TFunction } from 'i18next';

type PrepaymentRow = Record<string, unknown>;

const P = 'app.kuaicaiwu.prepayment';

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
  const receiptRef = useRef<ActionType>();
  const paymentRef = useRef<ActionType>();
  const [activeTab, setActiveTab] = useState('balance');
  const [applyReceiptVisible, setApplyReceiptVisible] = useState(false);
  const [applyPaymentVisible, setApplyPaymentVisible] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<PrepaymentRow | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PrepaymentRow | null>(null);
  const [receivableOptions, setReceivableOptions] = useState<{ label: string; value: number; remaining: number }[]>([]);
  const [payableOptions, setPayableOptions] = useState<{ label: string; value: number; remaining: number }[]>([]);

  const { data: balances } = useQuery({
    queryKey: ['prepaymentBalances'],
    queryFn: () => documentReconciliationService.getPrepaymentBalances(),
  });

  const customerBalances = (balances as any)?.customer_balances ?? [];
  const supplierBalances = (balances as any)?.supplier_balances ?? [];

  const statCards: StatCard[] = useMemo(
    () => [
      {
        key: 'customer',
        title: t(`${P}.statCustomerTotal`),
        value: (balances as any)?.total_customer_prepayment ?? 0,
        precision: 2,
        prefix: '¥',
      },
      {
        key: 'supplier',
        title: t(`${P}.statSupplierTotal`),
        value: (balances as any)?.total_supplier_prepayment ?? 0,
        precision: 2,
        prefix: '¥',
      },
    ],
    [balances, t],
  );

  const balanceColumns: ProColumns<PrepaymentRow>[] = useMemo(() => [
    { title: t(`${P}.col.partner`), dataIndex: 'partner_name', ellipsis: true },
    { title: t(`${P}.col.balance`), dataIndex: 'prepayment_balance', valueType: 'money', align: 'right' },
    { title: t(`${P}.col.docCount`), dataIndex: 'receipt_count', render: (_, r) => r.receipt_count ?? r.payment_count },
  ], [t]);

  const receiptColumns: ProColumns<PrepaymentRow>[] = useMemo(() => [
    { title: t(`${P}.col.receiptCode`), dataIndex: 'receipt_code', width: 160, ellipsis: true },
    { title: t('app.kuaicaiwu.common.customer'), dataIndex: 'customer_name', ellipsis: true },
    { title: t(`${P}.col.receiptDate`), dataIndex: 'receipt_date', valueType: 'date', width: 120 },
    { title: t(`${P}.col.receiptAmount`), dataIndex: 'total_amount', valueType: 'money', align: 'right' },
    { title: t(`${P}.col.unsettledBalance`), dataIndex: 'unsettled_amount', valueType: 'money', align: 'right' },
    { title: t(`${P}.col.settlementMethod`), dataIndex: 'settlement_type', width: 100, render: (_, r) => prepaymentTag(String(r.settlement_type ?? 'normal'), t) },
    { title: t(`${P}.col.status`), dataIndex: 'status', width: 100 },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 100,
      render: (_, r) => [
        <a
          key="apply"
          onClick={async () => {
            setSelectedReceipt(r);
            const res = await receivableService.listReceivables({
              skip: 0,
              limit: 200,
              customer_id: Number(r.customer_id),
              pending_settlement: true,
            } as any);
            setReceivableOptions((res?.items || []).map((item: any) => ({
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
        </a>,
      ],
    },
  ], [t]);

  const paymentColumns: ProColumns<PrepaymentRow>[] = useMemo(() => [
    { title: t(`${P}.col.paymentCode`), dataIndex: 'payment_code', width: 160, ellipsis: true },
    { title: t('app.kuaicaiwu.common.supplier'), dataIndex: 'supplier_name', ellipsis: true },
    { title: t(`${P}.col.paymentDate`), dataIndex: 'payment_date', valueType: 'date', width: 120 },
    { title: t(`${P}.col.paymentAmount`), dataIndex: 'total_amount', valueType: 'money', align: 'right' },
    { title: t(`${P}.col.unsettledBalance`), dataIndex: 'unsettled_amount', valueType: 'money', align: 'right' },
    { title: t(`${P}.col.settlementMethod`), dataIndex: 'settlement_type', width: 100, render: (_, r) => prepaymentTag(String(r.settlement_type ?? 'normal'), t) },
    { title: t(`${P}.col.status`), dataIndex: 'status', width: 100 },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 100,
      render: (_, r) => [
        <a
          key="apply"
          onClick={async () => {
            setSelectedPayment(r);
            const res = await payableService.listPayables({
              skip: 0,
              limit: 200,
              supplier_id: Number(r.supplier_id),
              pending_settlement: true,
            } as any);
            setPayableOptions((res?.items || []).map((item: any) => ({
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
        </a>,
      ],
    },
  ], [t]);

  const tabs = useMemo(() => [
    {
      key: 'balance',
      label: t(`${P}.tabSummary`),
      children: (
        <>
          <UniTable<PrepaymentRow>
            headerTitle={t(`${P}.customerBalance`)}
            enableRowSelection
            rowKey={(r) => `c-${r.partner_id}`}
            columnPersistenceId="apps.kuaicaiwu.pages.finance-management.prepayments.customer-balance"
            columns={balanceColumns}
            dataSource={customerBalances}
            search={false}
            pagination={false}
            toolBarRender={false}
          />
          <UniTable<PrepaymentRow>
            headerTitle={t(`${P}.supplierBalance`)}
            style={{ marginTop: 16 }}
            enableRowSelection
            rowKey={(r) => `s-${r.partner_id}`}
            columnPersistenceId="apps.kuaicaiwu.pages.finance-management.prepayments.supplier-balance"
            columns={balanceColumns}
            dataSource={supplierBalances}
            search={false}
            pagination={false}
            toolBarRender={false}
          />
        </>
      ),
    },
    {
      key: 'receipt',
      label: t(`${P}.tabReceiptDetail`),
      children: (
        <UniTable<PrepaymentRow>
          actionRef={receiptRef}
          enableRowSelection
          rowKey="id"
          columnPersistenceId="apps.kuaicaiwu.pages.finance-management.prepayments.receipts"
          columns={receiptColumns}
          request={async (params) => {
            const res = await receiptService.listReceipts({
              ...params,
              settlement_type: 'prepayment',
              unsettled_only: true,
            } as any);
            return { data: (res as any)?.items ?? [], success: true, total: (res as any)?.total ?? 0 };
          }}
          search={false}
          pagination={{ pageSize: 20 }}
          toolBarRender={false}
        />
      ),
    },
    {
      key: 'payment',
      label: t(`${P}.tabPaymentDetail`),
      children: (
        <UniTable<PrepaymentRow>
          actionRef={paymentRef}
          enableRowSelection
          rowKey="id"
          columnPersistenceId="apps.kuaicaiwu.pages.finance-management.prepayments.payments"
          columns={paymentColumns}
          request={async (params) => {
            const res = await paymentService.listPayments({
              ...params,
              settlement_type: 'prepayment',
              unsettled_only: true,
            } as any);
            return { data: (res as any)?.items ?? [], success: true, total: (res as any)?.total ?? 0 };
          }}
          search={false}
          pagination={{ pageSize: 20 }}
          toolBarRender={false}
        />
      ),
    },
  ], [balanceColumns, customerBalances, paymentColumns, receiptColumns, supplierBalances, t]);

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
          queryClient.invalidateQueries({ queryKey: ['prepaymentBalances'] });
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
          queryClient.invalidateQueries({ queryKey: ['prepaymentBalances'] });
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
    </>
  );
};

export default PrepaymentsPage;
