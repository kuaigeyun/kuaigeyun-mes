/** Hub 聚合列表统一行类型 */

import type { TFunction } from 'i18next';
import {
  inboundHubCapabilityReasonMessage,
  salesReturnCapabilityReasonMessage,
} from '../../../../../hooks/useDocumentCapabilities';

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
  receipt_time?: string;
  /** 委外收货业务收货时刻 */
  received_at?: string;
  registration_date?: string;
  return_time?: string;
  /** 委外退料/退货业务时刻 */
  returned_at?: string;
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
  total_amount?: number;
  total_items?: number;
  /** 采购等：操作员姓名；委外收货：用户 ID（勿当姓名展示） */
  received_by?: string | number;
  received_by_name?: string;
  receiver_name?: string;
  returner_name?: string;
  returned_by_name?: string;
  processed_by_name?: string;
  registered_by_name?: string;
  created_by_name?: string;
  updated_by_name?: string;
  created_at?: string;
  updated_at?: string;
  capabilities?: {
    confirm?: { allowed?: boolean; reason?: string };
    print?: { allowed?: boolean; reason?: string };
  };
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

export const INBOUND_RECEIPT_TYPES: InboundReceiptType[] = [
  'purchase',
  'finished_goods',
  'semi_finished_goods',
  'production_return',
  'customer_material',
  'sales_return',
  'outsource_receipt',
  'outsource_material_return',
  'outsource_product_return',
  'other_inbound',
  'material_return',
];

export function inboundReceiptTypeLabel(t: TFunction, type: InboundReceiptType): string {
  return t(`app.kuaizhizao.warehouseInbound.receiptType.${type}`);
}

export function inboundReceiptTypeValueEnum(
  t: TFunction,
): Record<string, { text: string; status: string }> {
  const colors: Record<InboundReceiptType, string> = {
    purchase: 'blue',
    finished_goods: 'success',
    semi_finished_goods: 'cyan',
    production_return: 'warning',
    customer_material: 'geekblue',
    sales_return: 'orange',
    outsource_receipt: 'purple',
    outsource_material_return: 'volcano',
    outsource_product_return: 'magenta',
    other_inbound: 'gold',
    material_return: 'lime',
  };
  return Object.fromEntries(
    INBOUND_RECEIPT_TYPES.map((key) => [
      key,
      { text: inboundReceiptTypeLabel(t, key), status: colors[key] },
    ]),
  );
}

/** 列表工具栏快速筛选：全部 + 各入库类型 */
export function inboundReceiptTypeSegmentOptions(
  t: TFunction,
): Array<{ label: string; value: string }> {
  return [
    { label: t('app.kuaizhizao.warehouseCommon.allTypes'), value: 'all' },
    ...INBOUND_RECEIPT_TYPES.map((type) => ({
      label: inboundReceiptTypeLabel(t, type),
      value: type,
    })),
  ];
}

export function isInboundConfirmable(record: InboundHubOrder): boolean {
  return record.capabilities?.confirm?.allowed === true;
}

export function inboundConfirmCapabilityReasonMessage(record: InboundHubOrder, t: TFunction): string {
  const reason = record.capabilities?.confirm?.reason;
  if (!reason) return '';
  if (record.receipt_type === 'sales_return') {
    return salesReturnCapabilityReasonMessage(reason, t);
  }
  return inboundHubCapabilityReasonMessage(reason, t);
}

function pushUniqueRef(parts: string[], value: unknown) {
  const s = String(value ?? '').trim();
  if (s && !parts.includes(s)) parts.push(s);
}

export function inboundSourceDocNo(record: InboundHubOrder): string {
  const parts: string[] = [];
  pushUniqueRef(parts, record.purchase_order_code);
  pushUniqueRef(parts, record.sales_order_code);
  pushUniqueRef(parts, record.outsource_work_order_code);
  pushUniqueRef(parts, record.work_order_code);
  pushUniqueRef(parts, record.picking_code);
  pushUniqueRef(parts, record.source_doc_no);
  return parts.join(' / ');
}

/** Hub 统一「日期」原始值：各入库类型字段名不一致（receipt_date / receipt_time / received_at / return_time 等） */
export function resolveInboundHubDateRaw(record: InboundHubOrder): unknown {
  return (
    record.receipt_date ??
    record.receipt_time ??
    record.received_at ??
    record.return_time ??
    record.returned_at ??
    record.registration_date ??
    null
  );
}

/** Hub 统一「操作员」：姓名字段优先；received_by 在委外收货上是用户 ID，不可当姓名 */
export function inboundDocumentTrackingType(
  order: Pick<InboundHubOrder, 'receipt_type'>,
):
  | 'purchase_receipt'
  | 'finished_goods_receipt'
  | 'semi_finished_goods_receipt'
  | 'production_return'
  | 'sales_return'
  | 'material_return'
  | 'other_inbound'
  | undefined {
  if (order.receipt_type === 'purchase') return 'purchase_receipt';
  if (order.receipt_type === 'finished_goods') return 'finished_goods_receipt';
  if (order.receipt_type === 'semi_finished_goods') return 'semi_finished_goods_receipt';
  if (order.receipt_type === 'production_return') return 'production_return';
  if (order.receipt_type === 'sales_return') return 'sales_return';
  if (order.receipt_type === 'material_return') return 'material_return';
  if (order.receipt_type === 'other_inbound') return 'other_inbound';
  return undefined;
}

export function resolveInboundHubOperator(record: InboundHubOrder): string {
  const named = [
    record.received_by_name,
    record.receiver_name,
    record.returner_name,
    record.returned_by_name,
    record.processed_by_name,
    record.registered_by_name,
    record.created_by_name,
    record.updated_by_name,
  ];
  for (const candidate of named) {
    const s = String(candidate ?? '').trim();
    if (s) return s;
  }
  // 采购入库等：received_by 本身就是姓名字符串
  if (typeof record.received_by === 'string') {
    const s = record.received_by.trim();
    if (s) return s;
  }
  return '';
}
