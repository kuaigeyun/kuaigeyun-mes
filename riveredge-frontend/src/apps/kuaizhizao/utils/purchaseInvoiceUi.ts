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

const PURCHASE_INVOICE_NON_DELETABLE_STATUSES = new Set(['已审核', '已开票', '已作废', '已红冲']);
const PURCHASE_INVOICE_FACE_LOCKED_STATUSES = new Set(['已作废', '已红冲']);

/** 是否允许删除（与后端 delete 接口一致） */
export function canDeletePurchaseInvoice(record: { status?: string | null }): boolean {
  const st = String(record.status || '').trim();
  if (!st) return false;
  return !PURCHASE_INVOICE_NON_DELETABLE_STATUSES.has(st);
}

/** 是否允许填写/更正票面发票号码（与后端 PUT 门禁一致；已审核仍可补全） */
export function canFillPurchaseInvoiceNumber(record: { status?: string | null }): boolean {
  const st = String(record.status || '').trim();
  return !PURCHASE_INVOICE_FACE_LOCKED_STATUSES.has(st);
}

/** 填号弹窗初始值：占位「待补全」视为空 */
export function faceInvoiceNumberForEdit(invoiceNumber?: string | null): string {
  const s = String(invoiceNumber ?? '').trim();
  if (!s || s === '待补全') return '';
  return s;
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
