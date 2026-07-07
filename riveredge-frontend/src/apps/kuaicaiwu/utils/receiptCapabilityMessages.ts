import type { TFunction } from 'i18next';

export const RECEIPT_CAPABILITY_REASON_MESSAGES: Record<string, string> = {
  'receipt.pull_from_receivable.not_allowed': '当前状态的应收单不可上拉收款单',
  'receipt.pull_from_receivable.no_lines': '应收单无可收款金额',
  'receipt.pull_from_receivable.already_pulled': '应收单可收款金额已全部占用，作废未核销收款单后可再次上拉',
};

export function receiptCapabilityReasonMessage(
  code: string | null | undefined,
  t?: TFunction,
): string {
  if (!code) return '';
  if (t) {
    const key = `app.kuaicaiwu.receipt.capability.${code}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return RECEIPT_CAPABILITY_REASON_MESSAGES[code] ?? code;
}
