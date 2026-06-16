/**
 * Shared select options and display formatters for finance management pages.
 * Backend values remain Chinese; labels are translated via i18n.
 */
import type { TFunction } from 'i18next';

const PAYMENT_METHOD_I18N: Record<string, string> = {
  银行转账: 'app.kuaicaiwu.financeUi.paymentMethod.bankTransfer',
  现金: 'app.kuaicaiwu.financeUi.paymentMethod.cash',
  支票: 'app.kuaicaiwu.financeUi.paymentMethod.check',
  承兑汇票: 'app.kuaicaiwu.financeUi.paymentMethod.acceptanceBill',
  在线支付: 'app.kuaicaiwu.financeUi.paymentMethod.online',
  其他: 'app.kuaicaiwu.financeUi.paymentMethod.other',
};

export function getPaymentMethodOptions(t: TFunction) {
  return Object.entries(PAYMENT_METHOD_I18N).map(([value, key]) => ({
    label: t(key),
    value,
  }));
}

export function formatPaymentMethod(value: string | null | undefined, t: TFunction): string {
  if (!value) return '—';
  const key = PAYMENT_METHOD_I18N[value];
  return key ? t(key) : value;
}

export function getReceiptSettlementTypeOptions(t: TFunction) {
  return [
    { label: t('app.kuaicaiwu.receipt.settlementType.normal'), value: 'normal' },
    { label: t('app.kuaicaiwu.receipt.settlementType.prepayment'), value: 'prepayment' },
  ];
}

export function getPaymentSettlementTypeOptions(t: TFunction) {
  return [
    { label: t('app.kuaicaiwu.payment.settlementType.normal'), value: 'normal' },
    { label: t('app.kuaicaiwu.payment.settlementType.prepayment'), value: 'prepayment' },
  ];
}

export function formatReceiptSettlementType(value: string | null | undefined, t: TFunction): string {
  if (value === 'prepayment') return t('app.kuaicaiwu.receipt.settlementType.prepayment');
  return t('app.kuaicaiwu.receipt.settlementType.normal');
}

export function formatPaymentSettlementType(value: string | null | undefined, t: TFunction): string {
  if (value === 'prepayment') return t('app.kuaicaiwu.payment.settlementType.prepayment');
  return t('app.kuaicaiwu.payment.settlementType.normal');
}

export function buildReceivableStatusEnum(t: TFunction) {
  return {
    未收款: { text: t('app.kuaicaiwu.financeStatus.receivable.unpaid') },
    部分收款: { text: t('app.kuaicaiwu.financeStatus.receivable.partial') },
    已结清: { text: t('app.kuaicaiwu.financeStatus.receivable.settled') },
  };
}

export function buildPayableStatusEnum(t: TFunction) {
  return {
    未付款: { text: t('app.kuaicaiwu.financeStatus.payable.unpaid') },
    部分付款: { text: t('app.kuaicaiwu.financeStatus.payable.partial') },
    已结清: { text: t('app.kuaicaiwu.financeStatus.payable.settled') },
  };
}

export function buildReviewStatusEnum(t: TFunction) {
  return {
    待审核: { text: t('app.kuaicaiwu.financeStatus.review.pending') },
    已审核: { text: t('app.kuaicaiwu.financeStatus.review.approved') },
    已驳回: { text: t('app.kuaicaiwu.financeStatus.review.rejected') },
    通过: { text: t('app.kuaicaiwu.financeStatus.review.approved') },
    驳回: { text: t('app.kuaicaiwu.financeStatus.review.rejected') },
  };
}

export function buildVoucherStatusEnum(t: TFunction) {
  return {
    Draft: { text: t('app.kuaicaiwu.financeStatus.voucher.draft') },
    Confirmed: { text: t('app.kuaicaiwu.financeStatus.voucher.confirmed') },
    Cancelled: { text: t('app.kuaicaiwu.financeStatus.voucher.cancelled') },
  };
}

export function buildUnifiedInvoiceStatusEnum(t: TFunction) {
  return {
    DRAFT: { text: t('app.kuaicaiwu.financeStatus.unifiedInvoice.draft') },
    CONFIRMED: { text: t('app.kuaicaiwu.financeStatus.unifiedInvoice.confirmed') },
    VERIFIED: { text: t('app.kuaicaiwu.financeStatus.unifiedInvoice.verified') },
    CANCELLED: { text: t('app.kuaicaiwu.financeStatus.unifiedInvoice.cancelled') },
  };
}

const CHINESE_INVOICE_TYPE_I18N: Record<string, string> = {
  增值税专用发票: 'app.kuaicaiwu.salesInvoice.invoiceType.vatSpecial',
  增值税普通发票: 'app.kuaicaiwu.salesInvoice.invoiceType.vatNormal',
  电子发票: 'app.kuaicaiwu.salesInvoice.invoiceType.electronic',
  收据: 'app.kuaicaiwu.salesInvoice.invoiceType.receipt',
  其他: 'app.kuaicaiwu.purchaseInvoice.invoiceType.other',
  VAT_SPECIAL: 'app.kuaicaiwu.invoice.invoiceType.vatSpecial',
  VAT_NORMAL: 'app.kuaicaiwu.invoice.invoiceType.vatNormal',
  ELECTRONIC: 'app.kuaicaiwu.invoice.invoiceType.electronic',
};

export function getChineseInvoiceTypeOptions(t: TFunction, opts?: { includeOther?: boolean; includeReceipt?: boolean }) {
  const base = [
    { label: t('app.kuaicaiwu.salesInvoice.invoiceType.vatSpecial'), value: '增值税专用发票' },
    { label: t('app.kuaicaiwu.salesInvoice.invoiceType.vatNormal'), value: '增值税普通发票' },
    { label: t('app.kuaicaiwu.salesInvoice.invoiceType.electronic'), value: '电子发票' },
  ];
  if (opts?.includeReceipt !== false) {
    base.push({ label: t('app.kuaicaiwu.salesInvoice.invoiceType.receipt'), value: '收据' });
  }
  if (opts?.includeOther) {
    base.push({ label: t('app.kuaicaiwu.purchaseInvoice.invoiceType.other'), value: '其他' });
  }
  return base;
}

export function formatChineseInvoiceType(value: string | null | undefined, t: TFunction): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const key = CHINESE_INVOICE_TYPE_I18N[raw];
  return key ? t(key) : raw;
}

export function getUnifiedInvoiceTypeOptions(t: TFunction) {
  return [
    { label: t('app.kuaicaiwu.invoice.invoiceType.vatSpecial'), value: 'VAT_SPECIAL' },
    { label: t('app.kuaicaiwu.invoice.invoiceType.vatNormal'), value: 'VAT_NORMAL' },
    { label: t('app.kuaicaiwu.invoice.invoiceType.electronic'), value: 'ELECTRONIC' },
  ];
}

export function buildPartnerStatementStatusEnum(t: TFunction) {
  return {
    Draft: { text: t('app.kuaicaiwu.partnerStatement.status.draft') },
    Confirmed: { text: t('app.kuaicaiwu.partnerStatement.status.confirmed') },
    Sent: { text: t('app.kuaicaiwu.partnerStatement.status.sent') },
    Disputed: { text: t('app.kuaicaiwu.partnerStatement.status.disputed') },
  };
}

const SENT_CHANNEL_I18N: Record<string, string> = {
  wechat_manual: 'app.kuaicaiwu.partnerStatement.sentChannel.wechatManual',
  print: 'app.kuaicaiwu.partnerStatement.sentChannel.print',
  export: 'app.kuaicaiwu.partnerStatement.sentChannel.export',
  email_manual: 'app.kuaicaiwu.partnerStatement.sentChannel.emailManual',
  other: 'app.kuaicaiwu.partnerStatement.sentChannel.other',
};

export function getSentChannelOptions(t: TFunction) {
  return Object.entries(SENT_CHANNEL_I18N).map(([value, key]) => ({
    label: t(key),
    value,
  }));
}

export function formatSentChannel(value: string | null | undefined, t: TFunction): string {
  if (!value) return '—';
  const key = SENT_CHANNEL_I18N[value];
  return key ? t(key) : value;
}
