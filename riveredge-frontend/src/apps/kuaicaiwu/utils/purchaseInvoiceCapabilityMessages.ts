import type { TFunction } from 'i18next';

export const PURCHASE_INVOICE_CAPABILITY_REASON_MESSAGES: Record<string, string> = {
  'purchase_invoice.pull_from_purchase_order.not_allowed': '当前状态的采购订单不可上拉进项发票',
  'purchase_invoice.pull_from_purchase_order.no_lines': '采购订单无可开票金额',
  'purchase_invoice.pull_from_purchase_order.already_pulled': '采购订单可开票金额已全部开票，删除未审核发票后可再次上拉',
  'purchase_invoice.pull_from_purchase_receipt.not_allowed': '当前状态的采购入库单不可上拉进项发票',
  'purchase_invoice.pull_from_purchase_receipt.no_lines': '采购入库单无可开票金额',
  'purchase_invoice.pull_from_purchase_receipt.already_pulled': '采购入库单可开票金额已全部开票，删除未审核发票后可再次上拉',
};

export function purchaseInvoiceCapabilityReasonMessage(
  code: string | null | undefined,
  t?: TFunction,
): string {
  if (!code) return '';
  if (t) {
    const key = `app.kuaicaiwu.purchaseInvoice.capability.${code}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return PURCHASE_INVOICE_CAPABILITY_REASON_MESSAGES[code] ?? code;
}
