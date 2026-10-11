/** 销售退货冲减应收（红字往来，非正向待收款） */

export const RECEIVABLE_SOURCE_SALES_RETURN = '销售退货';

export function isSalesReturnOffsetReceivable(record: {
  source_type?: string | null;
  status?: string | null;
  notes?: string | null;
} | null | undefined): boolean {
  const sourceType = String(record?.source_type || '').trim();
  if (sourceType === RECEIVABLE_SOURCE_SALES_RETURN) return true;
  if (String(record?.status || '').trim() === '已冲减') return true;
  // 确认退货写路径固定备注前缀（与 warehouse 创建红字应收一致）
  return String(record?.notes || '').startsWith('销售退货冲减');
}
