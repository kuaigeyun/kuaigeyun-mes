/** Hub 聚合列表统一行类型 */

import type { TFunction } from 'i18next';

export type OutboundIssueType =
  | 'production_picking'
  | 'sales_delivery'
  | 'outsource_issue'
  | 'other_outbound'
  | 'material_borrow';

export interface OutboundHubOrder {
  id?: number;
  outbound_type?: OutboundIssueType;
  delivery_code?: string;
  picking_code?: string;
  outbound_code?: string;
  borrow_code?: string;
  issue_code?: string;
  status?: string;
  delivery_date?: string;
  customer_id?: number;
  customer_name?: string;
  work_order_id?: number;
  work_order_code?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  outsource_work_order_id?: number;
  outsource_work_order_code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  total_quantity?: number;
  total_items?: number;
  delivered_by?: string;
  picker_name?: string;
  deliverer_name?: string;
  borrower_name?: string;
  reason_type?: string;
  picking_score?: number | null;
  picking_rank_band?: string | null;
  notes?: string;
  attachments?: { uid?: string; name?: string; url?: string }[];
  created_at?: string;
  updated_at?: string;
  capabilities?: {
    confirm?: { allowed?: boolean; reason?: string };
    withdraw?: { allowed?: boolean; reason?: string };
    print?: { allowed?: boolean; reason?: string };
  };
  [key: string]: unknown;
}

export const OUTBOUND_PENDING_STATUSES = new Set([
  '待出库',
  '待领料',
  '待借出',
  '草稿',
  'draft',
  'pending',
]);

export const OUTBOUND_POSTED_STATUSES = new Set([
  '已出库',
  '已领料',
  '已借出',
  '已完成',
  'completed',
  '已确认',
  'confirmed',
]);

export const OUTBOUND_ISSUE_TYPE_I18N_KEYS: Record<OutboundIssueType, string> = {
  production_picking: 'app.kuaizhizao.warehouseOutbound.type.productionPicking',
  sales_delivery: 'app.kuaizhizao.warehouseOutbound.type.salesDelivery',
  outsource_issue: 'app.kuaizhizao.warehouseOutbound.type.outsourceIssue',
  other_outbound: 'app.kuaizhizao.warehouseOutbound.type.otherOutbound',
  material_borrow: 'app.kuaizhizao.warehouseOutbound.type.materialBorrow',
};

export function getOutboundIssueTypeLabel(t: TFunction, type: OutboundIssueType): string {
  return t(OUTBOUND_ISSUE_TYPE_I18N_KEYS[type]);
}

export const OUTBOUND_ISSUE_TYPE_LABELS: Record<OutboundIssueType, string> = {
  production_picking: '生产领料',
  sales_delivery: '销售出库',
  outsource_issue: '委外发料',
  other_outbound: '其他出库',
  material_borrow: '借料单',
};

export function isOutboundConfirmable(record: OutboundHubOrder): boolean {
  return record.capabilities?.confirm?.allowed === true;
}

export function isOutboundWithdrawable(record: OutboundHubOrder): boolean {
  return record.capabilities?.withdraw?.allowed === true;
}

export function outboundDocumentCode(record: OutboundHubOrder): string {
  return (
    record.delivery_code ||
    record.picking_code ||
    record.outbound_code ||
    record.borrow_code ||
    record.issue_code ||
    String(record.id ?? '')
  );
}

function pushUniqueRef(parts: string[], value: unknown) {
  const s = String(value ?? '').trim();
  if (s && !parts.includes(s)) parts.push(s);
}

export function outboundSourceDocNo(record: OutboundHubOrder): string {
  const parts: string[] = [];
  pushUniqueRef(parts, record.sales_order_code);
  pushUniqueRef(parts, record.work_order_code);
  pushUniqueRef(parts, record.outsource_work_order_code);
  return parts.join(' / ');
}

export function mapOutsourceIssueToOutbound(item: Record<string, unknown>): OutboundHubOrder {
  const code = String(item.code ?? '');
  const statusRaw = String(item.status ?? '');
  const status =
    statusRaw === 'completed' ? '已完成' : statusRaw === 'draft' ? '已出库' : statusRaw || '已出库';
  return {
    id: item.id as number,
    outbound_type: 'outsource_issue',
    issue_code: code,
    picking_code: code,
    work_order_code: String(item.outsource_work_order_code ?? item.outsourceWorkOrderCode ?? ''),
    warehouse_id: item.warehouse_id as number | undefined,
    warehouse_name: String(item.warehouse_name ?? item.warehouseName ?? ''),
    total_quantity: Number(item.quantity ?? 0),
    total_items: 1,
    delivered_by: String(
      item.issued_by_name ?? item.issuedByName ?? item.created_by_name ?? item.createdByName ?? '',
    ),
    delivery_date: String(item.issued_at ?? item.issuedAt ?? item.created_at ?? item.createdAt ?? ''),
    status,
    updated_at: String(item.updated_at ?? item.updatedAt ?? ''),
    created_at: String(item.created_at ?? item.createdAt ?? ''),
    notes: String(item.remarks ?? item.notes ?? ''),
  };
}
