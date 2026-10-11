/** 采购退货冲减应付（红字往来，非正向待付款） */

export const PAYABLE_SOURCE_PURCHASE_RETURN = '采购退货';

export function isPurchaseReturnOffsetPayable(record: {
  source_type?: string | null;
  status?: string | null;
  notes?: string | null;
} | null | undefined): boolean {
  const sourceType = String(record?.source_type || '').trim();
  if (sourceType === PAYABLE_SOURCE_PURCHASE_RETURN) return true;
  if (String(record?.status || '').trim() === '已冲减') return true;
  // 确认退货写路径固定备注前缀（与 warehouse 创建红字应付一致）
  return String(record?.notes || '').startsWith('采购退货冲减');
}
