/**
 * 关联单据类型登记（当前页嵌套详情抽屉）。
 * 打开入口：LinkedDocumentDetailProvider.openLinkedDocumentDetail。
 * 禁止再 navigate 到列表后再弹抽屉。
 */

/** 支持嵌套详情抽屉的单据类型（与 TraceLinkedDocumentBrief / 销售订单详情体对齐） */
export const LINKED_DOCUMENT_DETAIL_TYPES = new Set([
  'sales_order',
  'sales_delivery',
  'purchase_order',
  'purchase_receipt',
  'quotation',
]);

export type LinkedDocumentType =
  | 'sales_order'
  | 'sales_delivery'
  | 'purchase_order'
  | 'purchase_receipt'
  | 'quotation';

export function canOpenLinkedDocumentDetail(documentType: string | null | undefined): boolean {
  const t = String(documentType ?? '').trim();
  return LINKED_DOCUMENT_DETAIL_TYPES.has(t);
}
