import type { TFunction } from 'i18next';

export type FinanceRefundCapabilityNs = 'app.kuaicaiwu.receiptRefund' | 'app.kuaicaiwu.paymentRefund';

const FALLBACK_MESSAGES: Record<string, string> = {
  'receipt_refund.pull_from_receipt.not_allowed': '当前状态的收款单不可创建退款',
  'receipt_refund.pull_from_receipt.already_refunded': '收款单可退金额已全部占用',
  'payment_refund.pull_from_payment.not_allowed': '当前状态的付款单不可创建退款',
  'payment_refund.pull_from_payment.already_refunded': '付款单可退金额已全部占用',
};

export function financeRefundCapabilityReasonMessage(
  ns: FinanceRefundCapabilityNs,
  code: string | null | undefined,
  t?: TFunction,
): string {
  if (!code) return '';
  if (t) {
    const key = `${ns}.capability.${code}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return FALLBACK_MESSAGES[code] ?? code;
}
