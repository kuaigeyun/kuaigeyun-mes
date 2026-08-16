const PRIORITY_FIELDS = [
  'source_code',
  'quotation_code',
  'review_code',
  'contract_code',
  'order_code',
  'work_order_code',
  'ticket_code',
  'document_code',
  'code',
  'name',
] as const;

function readText(row: Record<string, unknown>, field: string): string {
  const direct = String(row[field] ?? '').trim();
  if (direct) return direct;
  const camel = field.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());
  if (camel !== field) {
    return String(row[camel] ?? '').trim();
  }
  return '';
}

function isInternalIdField(field: string): boolean {
  return field === 'id' || field.endsWith('_id') || field.endsWith('Id');
}

function isBusinessCodeField(field: string): boolean {
  return field === 'code' || field.endsWith('_code') || field.endsWith('Code');
}

/**
 * 取单已选预览：只显示业务单号 / 名称，禁止回退内部 id。
 */
export function defaultPullRowLabel(record: object): string {
  const row = record as Record<string, unknown>;
  for (const field of PRIORITY_FIELDS) {
    const value = readText(row, field);
    if (value) return value;
  }
  for (const field of Object.keys(row)) {
    if (isInternalIdField(field) || !isBusinessCodeField(field)) continue;
    const value = readText(row, field);
    if (value) return value;
  }
  return '';
}
