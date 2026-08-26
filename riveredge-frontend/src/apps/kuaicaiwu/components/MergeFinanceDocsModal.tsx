/**
 * 应收/应付合并收款（付款）与合并开票预览 Modal
 *
 * 有明细表：FormModalTemplate grid={false}，表头手写 Row/Col，Table 在 Row 外。
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Col,
  Form,
  InputNumber,
  Row,
  Table,
  Typography,
} from 'antd';
import {
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useNumericPrecisionPlaces } from '../../../hooks/useNumericPrecision';
import { formatAmount, formatCurrencyAmount } from '../../../utils/format';
import { useNavigate } from 'react-router-dom';
import {
  FormModalTemplate,
  MODAL_CONFIG,
} from '../../../components/layout-templates';
import {
  LedgerAccountFormFields,
  resolveLedgerAccountNote,
} from './LedgerAccountFormFields';
import { bankAccountService, type BankAccount } from '../services/finance/bank-account';
import { receivableService, type MergeFinanceVoucherResult } from '../services/finance/receivable';
import { payableService } from '../services/finance/payable';
import {
  assertBankAccountForPaymentMethod,
  BANK_TRANSFER_PAYMENT_METHOD,
  getChineseInvoiceTypeOptions,
  getPaymentMethodOptions,
  getPaymentSettlementTypeOptions,
  getReceiptSettlementTypeOptions,
} from '../utils/financeSharedOptions';
import { formatDateTime } from '../../../utils/format';

export type MergeFinanceMode =
  | 'merge_receipt'
  | 'merge_sales_invoice'
  | 'merge_payment'
  | 'merge_purchase_invoice';

export type MergeFinanceSourceRow = {
  id: number;
  code: string;
  partnerId: number;
  partnerName: string;
  availableAmount: number;
};

type Props = {
  open: boolean;
  mode: MergeFinanceMode;
  sources: MergeFinanceSourceRow[];
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

const MODE_I18N: Record<MergeFinanceMode, { title: string; success: string; listPath: string }> = {
  merge_receipt: {
    title: 'app.kuaicaiwu.mergeFinance.mergeReceiptTitle',
    success: 'app.kuaicaiwu.mergeFinance.mergeReceiptSuccess',
    listPath: '/apps/kuaicaiwu/finance-management/receipts',
  },
  merge_sales_invoice: {
    title: 'app.kuaicaiwu.mergeFinance.mergeSalesInvoiceTitle',
    success: 'app.kuaicaiwu.mergeFinance.mergeSalesInvoiceSuccess',
    listPath: '/apps/kuaicaiwu/finance-management/sales-invoices',
  },
  merge_payment: {
    title: 'app.kuaicaiwu.mergeFinance.mergePaymentTitle',
    success: 'app.kuaicaiwu.mergeFinance.mergePaymentSuccess',
    listPath: '/apps/kuaicaiwu/finance-management/payments',
  },
  merge_purchase_invoice: {
    title: 'app.kuaicaiwu.mergeFinance.mergePurchaseInvoiceTitle',
    success: 'app.kuaicaiwu.mergeFinance.mergePurchaseInvoiceSuccess',
    listPath: '/apps/kuaicaiwu/finance-management/purchase-invoices',
  },
};

const isSettlementMode = (mode: MergeFinanceMode) =>
  mode === 'merge_receipt' || mode === 'merge_payment';

const isInvoiceMode = (mode: MergeFinanceMode) =>
  mode === 'merge_sales_invoice' || mode === 'merge_purchase_invoice';

export const MergeFinanceDocsModal: React.FC<Props> = ({
  open,
  mode,
  sources,
  onOpenChange,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const amountDecimals = useNumericPrecisionPlaces('amount');
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [amounts, setAmounts] = useState<Record<number, number>>({});

  const paymentMethodOptions = useMemo(() => getPaymentMethodOptions(t), [t]);
  const settlementTypeOptions = useMemo(
    () =>
      mode === 'merge_payment'
        ? getPaymentSettlementTypeOptions(t)
        : getReceiptSettlementTypeOptions(t),
    [t, mode],
  );
  const invoiceTypeOptions = useMemo(() => getChineseInvoiceTypeOptions(t), [t]);

  const partnerName = sources[0]?.partnerName || '—';
  const meta = MODE_I18N[mode];

  useEffect(() => {
    if (!open) return;
    const next: Record<number, number> = {};
    for (const row of sources) {
      next[row.id] = Number(Number(row.availableAmount || 0).toFixed(2));
    }
    setAmounts(next);
    form.setFieldsValue({
      voucher_date: dayjs(),
      payment_method: BANK_TRANSFER_PAYMENT_METHOD,
      settlement_type: 'normal',
      invoice_type: '增值税专用发票',
      tax_rate: 13,
      invoice_number: '',
      notes: undefined,
      bank_account_id: undefined,
      bank_account: undefined,
    });
    if (isSettlementMode(mode)) {
      bankAccountService
        .list({ limit: 200, is_active: true })
        .then((res) => setBankAccounts(res.data))
        .catch(() => setBankAccounts([]));
    }
  }, [open, mode, sources, form]);

  const totalAmount = useMemo(
    () =>
      Object.values(amounts).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [amounts],
  );

  const handleFinish = async (values: Record<string, any>) => {
    if (sources.length === 0) {
      messageApi.warning(t('app.kuaicaiwu.mergeFinance.needSelection'));
      return;
    }
    for (const row of sources) {
      const amt = Number(amounts[row.id] || 0);
      if (!(amt > 0)) {
        messageApi.error(t('app.kuaicaiwu.mergeFinance.amountMustPositive', { code: row.code }));
        return;
      }
      if (amt > Number(row.availableAmount || 0) + 1e-9) {
        messageApi.error(t('app.kuaicaiwu.mergeFinance.amountExceeds', { code: row.code }));
        return;
      }
    }
    if (!(totalAmount > 0)) {
      messageApi.error(t('app.kuaicaiwu.mergeFinance.totalMustPositive'));
      return;
    }

    const allocations = sources.map((row) => ({
      source_id: row.id,
      amount: Number(Number(amounts[row.id] || 0).toFixed(2)),
    }));

    setSubmitting(true);
    try {
      let result: MergeFinanceVoucherResult;

      if (mode === 'merge_receipt') {
        assertBankAccountForPaymentMethod(values.payment_method, values.bank_account_id, t);
        result = await receivableService.mergeCreateReceipt({
          allocations,
          receipt_date: formatDateTime(values.voucher_date, 'YYYY-MM-DD'),
          payment_method: values.payment_method,
          bank_account_id: values.bank_account_id,
          bank_account: resolveLedgerAccountNote(
            bankAccounts,
            values.bank_account_id,
            values.bank_account,
          ),
          settlement_type: values.settlement_type || 'normal',
          notes: values.notes,
        });
      } else if (mode === 'merge_payment') {
        assertBankAccountForPaymentMethod(values.payment_method, values.bank_account_id, t);
        result = await payableService.mergeCreatePayment({
          allocations,
          payment_date: formatDateTime(values.voucher_date, 'YYYY-MM-DD'),
          payment_method: values.payment_method,
          bank_account_id: values.bank_account_id,
          bank_account: resolveLedgerAccountNote(
            bankAccounts,
            values.bank_account_id,
            values.bank_account,
          ),
          settlement_type: values.settlement_type || 'normal',
          notes: values.notes,
        });
      } else if (mode === 'merge_sales_invoice') {
        result = await receivableService.mergeCreateSalesInvoice({
          allocations,
          invoice_date: formatDateTime(values.voucher_date, 'YYYY-MM-DD'),
          invoice_number: values.invoice_number || '',
          invoice_type: values.invoice_type || '增值税专用发票',
          tax_rate: Number(values.tax_rate) || 13,
          notes: values.notes,
        });
      } else {
        result = await payableService.mergeCreatePurchaseInvoice({
          allocations,
          invoice_date: formatDateTime(values.voucher_date, 'YYYY-MM-DD'),
          invoice_number: values.invoice_number,
          invoice_type: values.invoice_type || '增值税专用发票',
          tax_rate: Number(values.tax_rate) || 13,
          notes: values.notes,
        });
      }

      messageApi.success(
        t(meta.success, { code: result.voucher_code, amount: result.total_amount }),
      );
      onOpenChange(false);
      onSuccess?.();
      navigate(meta.listPath);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaicaiwu.mergeFinance.submitFailed'));
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModalTemplate
      title={t(meta.title)}
      open={open}
      onOpenChange={onOpenChange}
      onFinish={handleFinish}
      form={form}
      width={MODAL_CONFIG.LARGE_WIDTH}
      grid={false}
      loading={submitting}
      submitText={t('common.confirm')}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title={t('app.kuaicaiwu.mergeFinance.partnerLabel', { name: partnerName })}
      />
      <Table
        size="small"
        pagination={false}
        rowKey="id"
        dataSource={sources}
        style={{ width: '100%', marginBottom: 16 }}
        columns={[
          {
            title: t('app.kuaicaiwu.mergeFinance.col.sourceCode'),
            dataIndex: 'code',
          },
          {
            title:
              mode === 'merge_payment' || mode === 'merge_purchase_invoice'
                ? t('app.kuaicaiwu.common.supplier')
                : t('app.kuaicaiwu.common.customer'),
            dataIndex: 'partnerName',
            ellipsis: true,
          },
          {
            title: t('app.kuaicaiwu.mergeFinance.col.available'),
            dataIndex: 'availableAmount',
            width: 140,
            render: (v: number) => formatCurrencyAmount(v || 0),
          },
          {
            title: t('app.kuaicaiwu.mergeFinance.col.thisAmount'),
            dataIndex: 'id',
            width: 160,
            render: (id: number, row) => (
              <InputNumber
                min={0.01}
                max={Number(row.availableAmount || 0)}
                precision={amountDecimals}
                style={{ width: '100%' }}
                value={amounts[id]}
                onChange={(v) =>
                  setAmounts((prev) => ({
                    ...prev,
                    [id]: Number(v || 0),
                  }))
                }
              />
            ),
          },
        ]}
        footer={() => (
          <Typography.Text strong>
            {t('app.kuaicaiwu.mergeFinance.totalLabel', {
              amount: formatAmount(totalAmount),
            })}
          </Typography.Text>
        )}
      />

      <Row gutter={16}>
        <Col span={12}>
          <ProFormDatePicker
            name="voucher_date"
            label={
              isSettlementMode(mode)
                ? mode === 'merge_receipt'
                  ? t('app.kuaicaiwu.receivable.receiptDate')
                  : t('app.kuaicaiwu.payable.paymentDate')
                : t('app.kuaicaiwu.mergeFinance.invoiceDate')
            }
            rules={[{ required: true }]}
            fieldProps={{ style: { width: '100%' } }}
          />
        </Col>
        {isSettlementMode(mode) ? (
          <>
            <Col span={12}>
              <ProFormSelect
                name="payment_method"
                label={
                  mode === 'merge_receipt'
                    ? t('app.kuaicaiwu.receipt.col.paymentMethod')
                    : t('app.kuaicaiwu.payment.col.paymentMethod')
                }
                options={paymentMethodOptions}
                rules={[{ required: true }]}
              />
            </Col>
            <Col span={12}>
              <ProFormSelect
                name="settlement_type"
                label={
                  mode === 'merge_receipt'
                    ? t('app.kuaicaiwu.receipt.settlementType.label')
                    : t('app.kuaicaiwu.payment.settlementType.label')
                }
                options={settlementTypeOptions}
                initialValue="normal"
              />
            </Col>
          </>
        ) : null}
        {isInvoiceMode(mode) ? (
          <>
            <Col span={12}>
              <ProFormText
                name="invoice_number"
                label={t('app.kuaicaiwu.mergeFinance.invoiceNumber')}
                rules={
                  mode === 'merge_purchase_invoice'
                    ? [{ required: true, message: t('app.kuaicaiwu.mergeFinance.invoiceNumberRequired') }]
                    : undefined
                }
              />
            </Col>
            <Col span={12}>
              <ProFormSelect
                name="invoice_type"
                label={t('app.kuaicaiwu.mergeFinance.invoiceType')}
                options={invoiceTypeOptions}
                rules={[{ required: true }]}
              />
            </Col>
            <Col span={12}>
              <ProFormDigit
                name="tax_rate"
                label={t('app.kuaicaiwu.mergeFinance.taxRate')}
                min={0}
                max={100}
                fieldProps={{ precision: 2, addonAfter: '%' }}
                rules={[{ required: true }]}
              />
            </Col>
          </>
        ) : null}
      </Row>

      {isSettlementMode(mode) ? (
        <Row gutter={16}>
          <Col span={24}>
            <LedgerAccountFormFields
              omitColProps
              accounts={bankAccounts}
              accountLabel={
                mode === 'merge_receipt'
                  ? t('app.kuaicaiwu.receipt.bankAccount')
                  : t('app.kuaicaiwu.payment.outBankAccount')
              }
              noteLabel={
                mode === 'merge_receipt'
                  ? t('app.kuaicaiwu.receipt.bankAccountNote')
                  : t('app.kuaicaiwu.payment.outAccountNote')
              }
            />
          </Col>
        </Row>
      ) : null}

      <Row gutter={16}>
        <Col span={24}>
          <ProFormTextArea
            name="notes"
            label={t('common.remark')}
            fieldProps={{ rows: 2 }}
          />
        </Col>
      </Row>
    </FormModalTemplate>
  );
};

export default MergeFinanceDocsModal;
