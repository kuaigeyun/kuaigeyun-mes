/** 采购发票列表/详情共用展示逻辑 */

export const INVOICE_TYPE_OPTIONS = [
  { label: '增值税专用发票', value: '增值税专用发票' },
  { label: '增值税普通发票', value: '增值税普通发票' },
  { label: '电子发票', value: '电子发票' },
  { label: '收据', value: '收据' },
];

const INVOICE_TYPE_CODE_TO_ZH: Record<string, string> = {
  VAT_SPECIAL: '增值税专用发票',
  VAT_NORMAL: '增值税普通发票',
  VAT_ELECTRONIC: '电子发票',
  ELECTRONIC: '电子发票',
  E_INVOICE: '电子发票',
  RECEIPT: '收据',
};

export function formatPurchaseInvoiceTypeZh(raw: string | undefined | null): string {
  const t = (raw || '').trim();
  if (!t) return '—';
  if (INVOICE_TYPE_CODE_TO_ZH[t]) return INVOICE_TYPE_CODE_TO_ZH[t];
  if (t.includes('发票') || t === '收据' || t === '电子发票') return t;
  return t;
}

/** 详情页标题：采购发票 + 发票号码 */
export function formatPurchaseInvoiceDetailPageTitle(invoiceNumber?: string | null): string {
  const num = String(invoiceNumber ?? '').trim();
  return num ? `采购发票 ${num}` : '采购发票';
}

/** 详情 Tab 标题：优先发票号码 */
export function formatPurchaseInvoiceTabTitle(invoiceNumber?: string | null): string {
  const num = String(invoiceNumber ?? '').trim();
  return num || '采购发票';
}
