/**
 * 快制造业务单据打印 — API 路径与类型映射（唯一真源）
 */

import type { InboundReceiptType } from '../pages/warehouse-management/inbound/inboundHubTypes';
import type { OutboundIssueType } from '../pages/warehouse-management/outbound/outboundHubTypes';
import { PRINT_TEMPLATE_SCHEMAS } from '../../../config/printTemplateSchemas';

export type KuaizhizaoPrintDocumentType =
  | 'quotation'
  | 'sales_contract'
  | 'sales_order'
  | 'sales_forecast'
  | 'sales_order_change'
  | 'shipment_notice'
  | 'sales_return'
  | 'delivery_notice'
  | 'purchase_order'
  | 'purchase_receipt'
  | 'work_order'
  | 'production_picking'
  | 'production_return'
  | 'finished_goods_receipt'
  | 'semi_finished_goods_receipt'
  | 'sales_delivery'
  | 'other_inbound'
  | 'other_outbound'
  | 'material_borrow'
  | 'material_return'
  | 'product_quality_certificate';

const PRINT_API_PATH_BUILDERS: Record<KuaizhizaoPrintDocumentType, (id: number) => string> = {
  quotation: (id) => `/apps/kuaizhizao/quotations/${id}/print`,
  sales_contract: (id) => `/apps/kuaizhizao/sales-contracts/${id}/print`,
  sales_order: (id) => `/apps/kuaizhizao/sales-orders/${id}/print`,
  sales_forecast: (id) => `/apps/kuaizhizao/sales-forecasts/${id}/print`,
  sales_order_change: (id) => `/apps/kuaizhizao/sales-order-change-orders/${id}/print`,
  shipment_notice: (id) => `/apps/kuaizhizao/shipment-notices/${id}/print`,
  sales_return: (id) => `/apps/kuaizhizao/sales-returns/${id}/print`,
  delivery_notice: (id) => `/apps/kuaizhizao/delivery-notices/${id}/print`,
  purchase_order: (id) => `/apps/kuaizhizao/purchase-orders/${id}/print`,
  purchase_receipt: (id) => `/apps/kuaizhizao/purchase-receipts/${id}/print`,
  work_order: (id) => `/apps/kuaizhizao/work-orders/${id}/print`,
  production_picking: (id) => `/apps/kuaizhizao/production-pickings/${id}/print`,
  production_return: (id) => `/apps/kuaizhizao/production-returns/${id}/print`,
  finished_goods_receipt: (id) => `/apps/kuaizhizao/finished-goods-receipts/${id}/print`,
  semi_finished_goods_receipt: (id) => `/apps/kuaizhizao/semi-finished-goods-receipts/${id}/print`,
  sales_delivery: (id) => `/apps/kuaizhizao/sales-deliveries/${id}/print`,
  other_inbound: (id) => `/apps/kuaizhizao/other-inbounds/${id}/print`,
  other_outbound: (id) => `/apps/kuaizhizao/other-outbounds/${id}/print`,
  material_borrow: (id) => `/apps/kuaizhizao/material-borrows/${id}/print`,
  material_return: (id) => `/apps/kuaizhizao/material-returns/${id}/print`,
  product_quality_certificate: (id) =>
    `/apps/kuaizhizao/finished-goods-inspections/${id}/print-certificate`,
};

export function buildKuaizhizaoPrintApiPath(documentType: string, documentId: number): string {
  const builder = PRINT_API_PATH_BUILDERS[documentType as KuaizhizaoPrintDocumentType];
  if (!builder) {
    throw new Error(`不支持打印的单据类型: ${documentType}`);
  }
  return builder(documentId);
}

export function getKuaizhizaoPrintTitle(documentType: string): string {
  const schema = PRINT_TEMPLATE_SCHEMAS[documentType];
  return schema?.name ? `打印${schema.name}` : '打印预览';
}

export function inboundReceiptTypeToPrintDocumentType(
  receiptType?: InboundReceiptType,
): KuaizhizaoPrintDocumentType | null {
  switch (receiptType) {
    case 'purchase':
      return 'purchase_receipt';
    case 'finished_goods':
      return 'finished_goods_receipt';
    case 'semi_finished_goods':
      return 'semi_finished_goods_receipt';
    case 'production_return':
      return 'production_return';
    case 'other_inbound':
      return 'other_inbound';
    case 'material_return':
      return 'material_return';
    default:
      return null;
  }
}

export function outboundTypeToPrintDocumentType(
  outboundType?: OutboundIssueType,
): KuaizhizaoPrintDocumentType | null {
  switch (outboundType) {
    case 'production_picking':
      return 'production_picking';
    case 'sales_delivery':
      return 'sales_delivery';
    case 'other_outbound':
      return 'other_outbound';
    case 'material_borrow':
      return 'material_borrow';
    default:
      return null;
  }
}
