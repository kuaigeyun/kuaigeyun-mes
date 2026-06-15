/**
 * 业务单据二维码（DOC）扫描后跳转列表路径
 * 与 apps/kuaizhizao/print/document_qrcode.py MOBILE_INTERACTIVE_DOCUMENT_TYPES 对齐
 */

export const DOCUMENT_QRCODE_LIST_PATHS: Record<string, string> = {
  production_picking: '/apps/kuaizhizao/warehouse-management/inbound',
  production_return: '/apps/kuaizhizao/warehouse-management/inbound',
  finished_goods_receipt: '/apps/kuaizhizao/warehouse-management/inbound',
  semi_finished_goods_receipt: '/apps/kuaizhizao/warehouse-management/inbound',
  purchase_receipt: '/apps/kuaizhizao/warehouse-management/inbound',
  other_inbound: '/apps/kuaizhizao/warehouse-management/other-inbound',
  sales_delivery: '/apps/kuaizhizao/warehouse-management/outbound',
  other_outbound: '/apps/kuaizhizao/warehouse-management/other-outbound',
  material_borrow: '/apps/kuaizhizao/warehouse-management/material-borrows',
  material_return: '/apps/kuaizhizao/warehouse-management/material-returns',
  delivery_notice: '/apps/kuaizhizao/warehouse-management/delivery-notes',
};

export function buildDocumentQrcodeNavigateUrl(
  documentType: string,
  documentUuid: string,
): string | null {
  const base = DOCUMENT_QRCODE_LIST_PATHS[documentType];
  if (!base || !documentUuid) return null;
  const params = new URLSearchParams({
    uuid: documentUuid,
    documentType,
    action: 'detail',
  });
  return `${base}?${params.toString()}`;
}
