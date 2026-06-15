/** Hub 聚合列表统一行类型 */

export type InboundReceiptType =
  | 'purchase'
  | 'finished_goods'
  | 'semi_finished_goods'
  | 'production_return'
  | 'customer_material'
  | 'sales_return'
  | 'outsource_receipt'
  | 'outsource_material_return'
  | 'outsource_product_return'
  | 'other_inbound'
  | 'material_return';

export interface InboundHubOrder {
  id?: number;
  receipt_type?: InboundReceiptType;
  receipt_code?: string;
  return_code?: string;
  inbound_code?: string;
  registration_code?: string;
  status?: string;
  receipt_date?: string;
  return_time?: string;
  supplier_id?: number;
  supplier_name?: string;
  customer_id?: number;
  customer_name?: string;
  work_order_id?: number;
  work_order_code?: string;
  picking_code?: string;
  purchase_order_id?: number;
  purchase_order_code?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  outsource_work_order_id?: number;
  outsource_work_order_code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  total_quantity?: number;
  total_items?: number;
  received_by?: string;
  returner_name?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const INBOUND_PENDING_STATUSES = new Set([
  '待入库',
  '草稿',
  '待退货',
  '待退料',
  '待收货',
  'pending',
  'draft',
  '待归还',
  '待确认',
]);

export const INBOUND_RECEIPT_TYPE_LABELS: Record<InboundReceiptType, string> = {
  purchase: '采购入库',
  finished_goods: '成品入库',
  semi_finished_goods: '半成品入库',
  production_return: '生产退料',
  customer_material: '代工来料',
  sales_return: '销售退货',
  outsource_receipt: '委外收货',
  outsource_material_return: '委外退料',
  outsource_product_return: '委外退货',
  other_inbound: '其他入库',
  material_return: '还料单',
};

export function isInboundConfirmable(record: InboundHubOrder): boolean {
  const status = String(record.status || '');
  return INBOUND_PENDING_STATUSES.has(status);
}

export function inboundSourceDocNo(record: InboundHubOrder): string {
  return (
    record.purchase_order_code ||
    record.work_order_code ||
    record.sales_order_code ||
    record.outsource_work_order_code ||
    record.picking_code ||
    ''
  );
}
