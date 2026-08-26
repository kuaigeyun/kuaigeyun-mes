import {
  clampPushProgressPercent,
  ratioToPushProgressPercent,
  type PushProgressDocument,
} from './DocumentPushProgressBar';

type QuotationPushRow = {
  sales_order_id?: number | null;
  contract_id?: number | null;
  sales_order_code?: string | null;
  contract_code?: string | null;
  conversion_downstream_missing?: boolean | null;
  contract_downstream_missing?: boolean | null;
};

type ShipmentNoticeOutboundRow = {
  status?: string | null;
  sales_delivery_id?: number | null;
  related_sales_delivery_ids?: unknown;
};

type ReceiptNoticeInboundRow = {
  status?: string | null;
  purchase_receipt_id?: number | null;
};

const SHIPPED_NOTICE_STATUSES = new Set(['已出库', 'completed', '已完成']);
const RECEIVED_NOTICE_STATUSES = new Set(['已入库', 'received', '已完成']);

export function isQuotationDownstreamPushed(row: QuotationPushRow): boolean {
  const orderPushed = Boolean(row.sales_order_id) && row.conversion_downstream_missing !== true;
  const contractPushed = Boolean(row.contract_id) && row.contract_downstream_missing !== true;
  return orderPushed || contractPushed;
}

export function quotationDownstreamPushPercent(row: QuotationPushRow): number {
  return isQuotationDownstreamPushed(row) ? 100 : 0;
}

function appendPushDoc(
  docs: PushProgressDocument[],
  label: string,
  code?: string | null,
): void {
  const trimmed = String(code ?? '').trim();
  if (!trimmed) return;
  if (docs.some((d) => d.label === label && d.code === trimmed)) return;
  docs.push({ label, code: trimmed });
}

function appendPushDocs(
  docs: PushProgressDocument[],
  label: string,
  codes?: Array<string | null | undefined> | null,
): void {
  if (!Array.isArray(codes)) return;
  for (const code of codes) appendPushDoc(docs, label, code);
}

/** 报价单 → 已下推销售订单 / 销售合同 */
export function collectQuotationPushDocuments(
  row: QuotationPushRow,
  labels: { salesOrder: string; salesContract: string },
): PushProgressDocument[] {
  const docs: PushProgressDocument[] = [];
  if (Boolean(row.sales_order_id) && row.conversion_downstream_missing !== true) {
    appendPushDoc(docs, labels.salesOrder, row.sales_order_code);
  }
  if (Boolean(row.contract_id) && row.contract_downstream_missing !== true) {
    appendPushDoc(docs, labels.salesContract, row.contract_code);
  }
  return docs;
}

/** 发货通知 → 销售出库 */
export function collectShipmentOutboundPushDocuments(
  row: ShipmentNoticeOutboundRow & { sales_delivery_code?: string | null },
  label: string,
): PushProgressDocument[] {
  const docs: PushProgressDocument[] = [];
  appendPushDoc(docs, label, row.sales_delivery_code);
  return docs;
}

/** 收货通知 → 采购入库 */
export function collectReceiptInboundPushDocuments(
  row: ReceiptNoticeInboundRow & { purchase_receipt_code?: string | null },
  label: string,
): PushProgressDocument[] {
  const docs: PushProgressDocument[] = [];
  appendPushDoc(docs, label, row.purchase_receipt_code);
  return docs;
}

/** 需求 / 预测 → 需求计算 */
export function collectComputationPushDocuments(
  code: string | null | undefined,
  label: string,
): PushProgressDocument[] {
  const docs: PushProgressDocument[] = [];
  appendPushDoc(docs, label, code);
  return docs;
}

/** 销售订单 → 工单（及可选需求计算） */
export function collectSalesOrderPushDocuments(
  row: {
    pushed_work_order_codes?: Array<string | null | undefined> | null;
    computation_code?: string | null;
    pushed_to_computation?: boolean | null;
  },
  labels: { workOrder: string; demandComputation: string },
): PushProgressDocument[] {
  const docs: PushProgressDocument[] = [];
  appendPushDocs(docs, labels.workOrder, row.pushed_work_order_codes);
  if (row.pushed_to_computation) {
    appendPushDoc(docs, labels.demandComputation, row.computation_code);
  }
  return docs;
}

/** 销售合同 → 已释放销售订单 */
export function collectSalesContractPushDocuments(
  codes: Array<string | null | undefined> | null | undefined,
  label: string,
): PushProgressDocument[] {
  const docs: PushProgressDocument[] = [];
  appendPushDocs(docs, label, codes);
  return docs;
}

/** 采购订单 → 收货通知 / 采购入库 */
export function collectPurchaseOrderPushDocuments(
  row: {
    downstream_receipt_notice_codes?: Array<string | null | undefined> | null;
    downstream_purchase_receipt_codes?: Array<string | null | undefined> | null;
  },
  labels: { receiptNotice: string; purchaseReceipt: string },
): PushProgressDocument[] {
  const docs: PushProgressDocument[] = [];
  appendPushDocs(docs, labels.receiptNotice, row.downstream_receipt_notice_codes);
  appendPushDocs(docs, labels.purchaseReceipt, row.downstream_purchase_receipt_codes);
  return docs;
}

export function salesForecastComputationPushPercent(planningPushed?: boolean | null): number {
  return planningPushed ? 100 : 0;
}

/** 需求计划 → 需求计算下推进度（0/100） */
export function demandComputationPushPercent(pushed?: boolean | null): number {
  return pushed ? 100 : 0;
}

export function shipmentNoticeOutboundPushPercent(row: ShipmentNoticeOutboundRow): number {
  const status = String(row.status ?? '').trim();
  if (SHIPPED_NOTICE_STATUSES.has(status)) return 100;
  if (row.sales_delivery_id) return 100;
  const related = row.related_sales_delivery_ids;
  if (Array.isArray(related) && related.length > 0) return 100;
  return 0;
}

export function receiptNoticeInboundPushPercent(row: ReceiptNoticeInboundRow): number {
  const status = String(row.status ?? '').trim();
  if (RECEIVED_NOTICE_STATUSES.has(status)) return 100;
  if (row.purchase_receipt_id) return 100;
  return 0;
}

export function salesContractOrderPushPercent(
  releasedQuantity?: number | string | null,
  totalQuantity?: number | string | null,
): number {
  const total = Number(totalQuantity ?? 0);
  const released = Number(releasedQuantity ?? 0);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return clampPushProgressPercent((released / total) * 100);
}

/** 应收 → 收款（按已收/总额） */
export function receivableReceiptPushPercent(
  receivedAmount?: number | string | null,
  totalAmount?: number | string | null,
): number {
  return ratioToPushProgressPercent(Number(receivedAmount ?? 0), Number(totalAmount ?? 0));
}

/** 应付 → 付款（按已付/总额） */
export function payablePaymentPushPercent(
  paidAmount?: number | string | null,
  totalAmount?: number | string | null,
): number {
  return ratioToPushProgressPercent(Number(paidAmount ?? 0), Number(totalAmount ?? 0));
}

/** 应收 → 销项发票（按已开票/总额） */
export function receivableInvoicePushPercent(
  invoicedAmount?: number | string | null,
  totalAmount?: number | string | null,
): number {
  return ratioToPushProgressPercent(Number(invoicedAmount ?? 0), Number(totalAmount ?? 0));
}

/** 应付 → 进项发票（按已收票/总额） */
export function payableInvoicePushPercent(
  invoicedAmount?: number | string | null,
  totalAmount?: number | string | null,
): number {
  return ratioToPushProgressPercent(Number(invoicedAmount ?? 0), Number(totalAmount ?? 0));
}

/** 来料检验 → 采购退货（已下推不合格数 / 不合格数） */
export function incomingInspectionReturnPushPercent(
  pushedQty?: number | string | null,
  unqualifiedQty?: number | string | null,
): number {
  const total = Number(unqualifiedQty ?? 0);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return ratioToPushProgressPercent(Number(pushedQty ?? 0), total);
}

/** 成品检验 → 返工单 */
export function finishedGoodsReworkPushPercent(
  pushedQty?: number | string | null,
  unqualifiedQty?: number | string | null,
): number {
  return incomingInspectionReturnPushPercent(pushedQty, unqualifiedQty);
}

/** 成品检验 → 入库单（合格品） */
export function finishedGoodsInboundPushPercent(
  pushedQty?: number | string | null,
  qualifiedQty?: number | string | null,
): number {
  const total = Number(qualifiedQty ?? 0);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return ratioToPushProgressPercent(Number(pushedQty ?? 0), total);
}

/**
 * 委外工单下推：发料进度与收货进度各占一半（与采购订单下游进度类似）。
 */
export function outsourceWorkOrderPushPercent(row: {
  quantity?: number | string | null;
  issued_quantity?: number | string | null;
  received_quantity?: number | string | null;
}): number {
  const total = Number(row.quantity ?? 0);
  if (!Number.isFinite(total) || total <= 0) return 0;
  const issuePct = ratioToPushProgressPercent(Number(row.issued_quantity ?? 0), total);
  const receivePct = ratioToPushProgressPercent(Number(row.received_quantity ?? 0), total);
  return clampPushProgressPercent((issuePct + receivePct) / 2);
}

/** 优先用后端聚合字段；否则按比例兜底 */
export function resolveDownstreamPushPercent(
  progress?: number | string | null,
  pushed?: number | string | null,
  total?: number | string | null,
): number {
  if (progress != null && progress !== '') {
    const n = Number(progress);
    if (Number.isFinite(n)) return clampPushProgressPercent(n);
  }
  return ratioToPushProgressPercent(Number(pushed ?? 0), Number(total ?? 0));
}
