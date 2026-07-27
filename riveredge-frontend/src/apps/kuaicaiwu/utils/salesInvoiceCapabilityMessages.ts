import type { TFunction } from 'i18next';

export const SALES_INVOICE_CAPABILITY_REASON_MESSAGES: Record<string, string> = {
  'sales_invoice.pull_from_sales_order.not_allowed': '当前状态的销售订单不可加载销项发票',
  'sales_invoice.pull_from_sales_order.no_lines': '销售订单无可开票金额',
  'sales_invoice.pull_from_sales_order.already_pulled': '销售订单可开票金额已全部开票，删除未审核发票后可再次加载',
  'sales_invoice.pull_from_sales_delivery.not_allowed': '当前状态的销售出库单不可加载销项发票',
  'sales_invoice.pull_from_sales_delivery.no_lines': '销售出库单无可开票金额',
  'sales_invoice.pull_from_sales_delivery.already_pulled': '销售出库单可开票金额已全部开票，删除未审核发票后可再次加载',
};

export function salesInvoiceCapabilityReasonMessage(
  code: string | null | undefined,
  t?: TFunction,
): string {
  if (!code) return '';
  if (t) {
    const key = `app.kuaicaiwu.salesInvoice.capability.${code}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return SALES_INVOICE_CAPABILITY_REASON_MESSAGES[code] ?? code;
}
