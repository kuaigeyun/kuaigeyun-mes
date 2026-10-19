/**
 * 从业务行记录解析单据单号（与后端 approval_document_view._CODE_KEYS 对齐）。
 * 供审核弹窗单据区展示，禁止各页再自写一套。
 */
const DOCUMENT_CODE_KEYS = [
  'requisition_code',
  'order_code',
  'contract_code',
  'quotation_code',
  'forecast_code',
  'notice_code',
  'change_code',
  'return_code',
  'receipt_code',
  'inquiry_code',
  'work_order_code',
  'rework_code',
  'inspection_code',
  'picking_code',
  'delivery_code',
  'demand_code',
  'report_code',
  'document_code',
  'document_no',
  'application_code',
  'payment_code',
  'invoice_code',
  'receivable_code',
  'payable_code',
  'leave_code',
  'request_code',
  'seal_code',
  'form_code',
  'bill_code',
  'code',
] as const;

/** 从审批实例 title（如「采购申请审批: CGSQ…」）兜底抽出单号 */
export function documentCodeFromInstanceTitle(title?: string | null): string {
  const raw = String(title ?? '').trim();
  if (!raw) return '';
  const parts = raw.split(/[:：]/);
  if (parts.length < 2) return '';
  const code = parts[parts.length - 1].trim();
  return code || '';
}

export function resolveRecordDocumentCode(record: unknown): string {
  if (!record || typeof record !== 'object') return '';
  const row = record as Record<string, unknown>;
  for (const key of DOCUMENT_CODE_KEYS) {
    const value = row[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}
