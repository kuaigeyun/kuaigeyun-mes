/**
 * 关联单据类型登记（当前页嵌套详情抽屉）。
 * 打开入口：LinkedDocumentDetailProvider.openLinkedDocumentDetail。
 * 禁止再 navigate 到列表后再弹抽屉。
 * 列表/详情自动挂链：见 linkedDocumentAutoLink（UniTable + detailDrawerDescriptionItems）。
 * 禁止用单号前缀猜测类型；须用约定字段（source_type/source_id 或 *_code + *_id）。
 */

/** 支持嵌套详情抽屉的单据类型（snake_case） */
export const LINKED_DOCUMENT_DETAIL_TYPES = new Set([
  'sales_order',
  'sales_delivery',
  'purchase_order',
  'purchase_receipt',
  'quotation',
  'sales_forecast',
  'demand',
  'purchase_requisition',
  'demand_computation',
  'work_order',
]);

export type LinkedDocumentType =
  | 'sales_order'
  | 'sales_delivery'
  | 'purchase_order'
  | 'purchase_receipt'
  | 'quotation'
  | 'sales_forecast'
  | 'demand'
  | 'purchase_requisition'
  | 'demand_computation'
  | 'work_order';

/** 后端偶发别名 → 标准 snake */
const LINKED_DOCUMENT_TYPE_ALIASES: Record<string, string> = {
  purchaserequisition: 'purchase_requisition',
  demandcomputation: 'demand_computation',
  salesorder: 'sales_order',
  salesforecast: 'sales_forecast',
  salesdelivery: 'sales_delivery',
  purchaseorder: 'purchase_order',
  purchasereceipt: 'purchase_receipt',
  workorder: 'work_order',
};

/**
 * 规范化单据类型：PascalCase / 连字符 → snake_case。
 * 例：PurchaseRequisition → purchase_requisition
 */
export function normalizeLinkedDocumentType(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (s.includes('_') || s === s.toLowerCase()) {
    return s.toLowerCase().replace(/-/g, '_');
  }
  const snake = s
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
  const compact = s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return LINKED_DOCUMENT_TYPE_ALIASES[compact] ?? snake;
}

export function canOpenLinkedDocumentDetail(documentType: string | null | undefined): boolean {
  const t = normalizeLinkedDocumentType(documentType);
  return Boolean(t) && LINKED_DOCUMENT_DETAIL_TYPES.has(t);
}

/** 需求计算「来源单号」→ 可嵌套打开的上游单据（多来源时链接首个） */
export function resolveDemandComputationSourceLink(record: {
  demand_code?: string | null;
  demand_type?: string | null;
  source_id?: number | null;
  demand_id?: number | null;
}): { documentType: LinkedDocumentType; documentId: number } | null {
  const code = String(record.demand_code ?? '').trim();
  const primary = code.includes('等')
    ? code.split('等', 1)[0].trim()
    : code.split(/[,，]/)[0]?.trim() || code;
  if (!primary) return null;
  const dtype = normalizeLinkedDocumentType(record.demand_type);
  const sourceId = Number(record.source_id);
  const demandId = Number(record.demand_id);

  if (dtype === 'demand_plan' || String(record.demand_type ?? '').trim() === 'demand_plan') {
    const id = Number.isFinite(sourceId) && sourceId > 0 ? sourceId : demandId;
    if (Number.isFinite(id) && id > 0) return { documentType: 'demand', documentId: id };
    return null;
  }
  if (!Number.isFinite(sourceId) || sourceId <= 0) return null;
  if (dtype === 'sales_order' || String(record.demand_type ?? '').trim() === 'sales_order') {
    return { documentType: 'sales_order', documentId: sourceId };
  }
  if (dtype === 'sales_forecast' || String(record.demand_type ?? '').trim() === 'sales_forecast') {
    return { documentType: 'sales_forecast', documentId: sourceId };
  }
  return null;
}
