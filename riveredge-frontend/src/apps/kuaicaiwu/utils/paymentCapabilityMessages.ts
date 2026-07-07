import type { TFunction } from 'i18next';

export const PAYMENT_CAPABILITY_REASON_MESSAGES: Record<string, string> = {
  'payment.pull_from_payable.not_allowed': '当前状态的应付单不可上拉付款单',
  'payment.pull_from_payable.no_lines': '应付单无可付款金额',
  'payment.pull_from_payable.already_pulled': '应付单可付款金额已全部占用，作废未核销付款单后可再次上拉',
};

export function paymentCapabilityReasonMessage(
  code: string | null | undefined,
  t?: TFunction,
): string {
  if (!code) return '';
  if (t) {
    const key = `app.kuaicaiwu.payment.capability.${code}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return PAYMENT_CAPABILITY_REASON_MESSAGES[code] ?? code;
}
