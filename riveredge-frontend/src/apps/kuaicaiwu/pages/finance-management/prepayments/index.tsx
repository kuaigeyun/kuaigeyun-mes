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
import { formatSettlementType } from '../../../utils/financeUiLabels';

type PrepaymentRow = Record<string, unknown>;

const prepaymentTag = (type?: string) => {
  const label = formatSettlementType(type);
  if (type === 'prepayment') {
    return <Tag color="blue">{label}</Tag>;
  }
  return <Tag>{label}</Tag>;
};

const PrepaymentsPage: React.FC = () => {
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
        title: '客户预收余额合计',
        value: (balances as any)?.total_customer_prepayment ?? 0,
        precision: 2,
        prefix: '¥',
      },
      {
        key: 'supplier',
        title: '供应商预付余额合计',
        value: (balances as any)?.total_supplier_prepayment ?? 0,
        precision: 2,
        prefix: '¥',
      },
    ],
    [balances],
  );

  const balanceColumns: ProColumns<PrepaymentRow>[] = [
    { title: '往来单位', dataIndex: 'partner_name', ellipsis: true },
    { title: '预收/预付余额', dataIndex: 'prepayment_balance', valueType: 'money', align: 'right' },
    { title: '单据数', dataIndex: 'receipt_count', render: (_, r) => r.receipt_count ?? r.payment_count },
  ];

  const receiptColumns: ProColumns<PrepaymentRow>[] = [
    { title: '收款单号', dataIndex: 'receipt_code', width: 160, ellipsis: true },
    { title: '客户', dataIndex: 'customer_name', ellipsis: true },
    { title: '收款日期', dataIndex: 'receipt_date', valueType: 'date', width: 120 },
    { title: '收款金额', dataIndex: 'total_amount', valueType: 'money', align: 'right' },
    { title: '未核销余额', dataIndex: 'unsettled_amount', valueType: 'money', align: 'right' },
    { title: '结算方式', dataIndex: 'settlement_type', width: 100, render: (_, r) => prepaymentTag(String(r.settlement_type ?? 'normal')) },
    { title: '状态', dataIndex: 'status', width: 100 },
    {
      title: '操作',
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
              label: `${item.receivable_code} · 待收 ¥${item.remaining_amount}`,
              value: item.id,
              remaining: Number(item.remaining_amount),
            })));
            setApplyReceiptVisible(true);
          }}
        >
          转核销
        </a>,
      ],
    },
  ];

  const paymentColumns: ProColumns<PrepaymentRow>[] = [
    { title: '付款单号', dataIndex: 'payment_code', width: 160, ellipsis: true },
    { title: '供应商', dataIndex: 'supplier_name', ellipsis: true },
    { title: '付款日期', dataIndex: 'payment_date', valueType: 'date', width: 120 },
    { title: '付款金额', dataIndex: 'total_amount', valueType: 'money', align: 'right' },
    { title: '未核销余额', dataIndex: 'unsettled_amount', valueType: 'money', align: 'right' },
    { title: '结算方式', dataIndex: 'settlement_type', width: 100, render: (_, r) => prepaymentTag(String(r.settlement_type ?? 'normal')) },
    { title: '状态', dataIndex: 'status', width: 100 },
    {
      title: '操作',
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
              label: `${item.payable_code} · 待付 ¥${item.remaining_amount}`,
              value: item.id,
              remaining: Number(item.remaining_amount),
            })));
            setApplyPaymentVisible(true);
          }}
        >
          转核销
        </a>,
      ],
    },
  ];

  return (
    <>
      <MultiTabListPageTemplate
        statCards={statCards}
        activeTabKey={activeTab}
        onTabChange={setActiveTab}
        preserveMounted
        tabs={[
          {
            key: 'balance',
            label: '余额汇总',
            children: (
              <>
                <UniTable<PrepaymentRow>
                  headerTitle="客户预收"
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
                  headerTitle="供应商预付"
                  style={{ marginTop: 24 }}
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
            label: '预收明细',
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
            label: '预付明细',
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
        ]}
      />

      <FormModalTemplate
        title="预收转核销应收"
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
          messageApi.success('预收已核销至应收单');
          queryClient.invalidateQueries({ queryKey: ['prepaymentBalances'] });
          receiptRef.current?.reload();
          setApplyReceiptVisible(false);
        }}
      >
        <ProFormSelect
          name="receivable_id"
          label="目标应收单"
          rules={[{ required: true }]}
          options={receivableOptions}
          showSearch
        />
        <ProFormMoney
          name="amount"
          label="核销金额"
          min={0.01}
          max={selectedReceipt ? Number(selectedReceipt.unsettled_amount) : undefined}
          rules={[{ required: true }]}
        />
      </FormModalTemplate>

      <FormModalTemplate
        title="预付转核销应付"
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
          messageApi.success('预付已核销至应付单');
          queryClient.invalidateQueries({ queryKey: ['prepaymentBalances'] });
          paymentRef.current?.reload();
          setApplyPaymentVisible(false);
        }}
      >
        <ProFormSelect
          name="payable_id"
          label="目标应付单"
          rules={[{ required: true }]}
          options={payableOptions}
          showSearch
        />
        <ProFormMoney
          name="amount"
          label="核销金额"
          min={0.01}
          max={selectedPayment ? Number(selectedPayment.unsettled_amount) : undefined}
          rules={[{ required: true }]}
        />
      </FormModalTemplate>
    </>
  );
};

export default PrepaymentsPage;
