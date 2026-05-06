/**
 * 销售发票列表/详情共用展示逻辑（编码 UUID 隐藏、类型码转中文）
 */

export interface SalesInvoiceCodeRow {
  id: number;
  invoice_code: string;
}

export const INVOICE_TYPE_OPTIONS = [
  { label: '增值税专用发票', value: '增值税专用发票' },
  { label: '增值税普通发票', value: '增值税普通发票' },
  { label: '电子发票', value: '电子发票' },
  { label: '收据', value: '收据' },
];

const SALES_INVOICE_TYPE_CODE_TO_ZH: Record<string, string> = {
  VAT_SPECIAL: '增值税专用发票',
  VAT_NORMAL: '增值税普通发票',
  VAT_ELECTRONIC: '电子发票',
  ELECTRONIC: '电子发票',
  E_INVOICE: '电子发票',
  RECEIPT: '收据',
};

const UUID_INVOICE_CODE_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidInvoiceCode(code: string | undefined | null): boolean {
  if (!code || typeof code !== 'string') return false;
  return UUID_INVOICE_CODE_RE.test(code.trim());
}

export function formatSalesInvoiceTypeZh(raw: string | undefined | null): string {
  const t = (raw || '').trim();
  if (!t) return '—';
  if (SALES_INVOICE_TYPE_CODE_TO_ZH[t]) return SALES_INVOICE_TYPE_CODE_TO_ZH[t];
  if (t.includes('发票') || t === '收据' || t === '电子发票') return t;
  return t;
}

/** 列表/确认框：系统编号为 UUID 时显示 #id */
export function displaySalesInvoiceListCode(r: SalesInvoiceCodeRow): string {
  if (isUuidInvoiceCode(r.invoice_code)) return `#${r.id}`;
  return String(r.invoice_code ?? '—');
}
