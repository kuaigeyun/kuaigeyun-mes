import type { InboundHubOrder, InboundReceiptType } from './inboundHubTypes';

export type InboundHubDeepLinkFilter = {
  receiptType: InboundReceiptType;
  id?: number;
  uuid?: string;
};

const DOCUMENT_TYPE_TO_RECEIPT_TYPE: Record<string, InboundReceiptType> = {
  purchase_receipt: 'purchase',
  finished_goods_receipt: 'finished_goods',
  semi_finished_goods_receipt: 'semi_finished_goods',
  production_return: 'production_return',
  sales_return: 'sales_return',
  other_inbound: 'other_inbound',
  material_return: 'material_return',
  customer_material_registration: 'customer_material',
};

function parsePositiveInt(raw: string | null | undefined): number | undefined {
  const value = raw?.trim();
  if (!value || !/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function parseInboundHubDeepLink(searchParams: URLSearchParams): InboundHubDeepLinkFilter | null {
  const documentType = searchParams.get('documentType')?.trim();
  const receiptTypeParam = searchParams.get('receipt_type')?.trim();
  const uuid = searchParams.get('uuid')?.trim();
  const receiptId = parsePositiveInt(searchParams.get('receipt_id'));
  const semiReceiptId = parsePositiveInt(searchParams.get('semi_receipt_id'));
  const highlightId = parsePositiveInt(searchParams.get('highlight'));

  const receiptTypeFromDoc =
    (documentType && DOCUMENT_TYPE_TO_RECEIPT_TYPE[documentType]) ||
    (receiptTypeParam as InboundReceiptType | undefined);

  if (uuid && receiptTypeFromDoc) {
    return { receiptType: receiptTypeFromDoc, uuid };
  }

  if (semiReceiptId) {
    return { receiptType: 'semi_finished_goods', id: semiReceiptId };
  }

  if (receiptTypeFromDoc && receiptId) {
    return { receiptType: receiptTypeFromDoc, id: receiptId };
  }

  if (receiptId) {
    if (documentType === 'finished_goods_receipt') {
      return { receiptType: 'finished_goods', id: receiptId };
    }
    return { receiptType: 'purchase', id: receiptId };
  }

  if (highlightId) {
    return { receiptType: 'purchase', id: highlightId };
  }

  return null;
}

export function filterInboundHubRowsByDeepLink(
  rows: InboundHubOrder[],
  filter: InboundHubDeepLinkFilter | null,
): InboundHubOrder[] {
  if (!filter) return rows;
  return rows.filter((row) => {
    if (row.receipt_type !== filter.receiptType) return false;
    if (filter.id != null && row.id !== filter.id) return false;
    if (filter.uuid && String(row.uuid ?? '') !== filter.uuid) return false;
    return true;
  });
}

export function inboundHubDeepLinkStub(filter: InboundHubDeepLinkFilter): InboundHubOrder {
  return {
    id: filter.id,
    uuid: filter.uuid,
    receipt_type: filter.receiptType,
  };
}

/** uuid 深链：按类型拉列表匹配 uuid 得到 id */
export async function resolveInboundDeepLinkId(
  filter: InboundHubDeepLinkFilter,
): Promise<number | undefined> {
  if (filter.id) return filter.id;
  if (!filter.uuid) return undefined;

  const { warehouseApi } = await import('../../../services/warehouse-execution');
  const { customerMaterialRegistrationApi } = await import('../../../services/customer-material-registration');
  const {
    outsourceMaterialReceiptApi,
    outsourceMaterialReturnApi,
    outsourceProductReturnApi,
  } = await import('../../../services/production');
  const { normalizeWarehouseListResponse } = await import('../../../utils/warehouseListCore');

  const findUuid = (items: unknown[]) => {
    const hit = items.find((item) => String((item as { uuid?: string }).uuid ?? '') === filter.uuid);
    const id = (hit as { id?: number })?.id;
    return id != null && id > 0 ? id : undefined;
  };

  const listLimit = { skip: 0, limit: 500 };
  let res: unknown;
  switch (filter.receiptType) {
    case 'purchase':
      res = await warehouseApi.purchaseReceipt.list(listLimit);
      break;
    case 'finished_goods':
      res = await warehouseApi.finishedGoodsReceipt.list(listLimit);
      break;
    case 'semi_finished_goods':
      res = await warehouseApi.semiFinishedGoodsReceipt.list(listLimit);
      break;
    case 'production_return':
      res = await warehouseApi.productionReturn.list(listLimit);
      break;
    case 'customer_material':
      res = await customerMaterialRegistrationApi.list(listLimit);
      break;
    case 'sales_return':
      res = await warehouseApi.salesReturn.list(listLimit);
      break;
    case 'other_inbound':
      res = await warehouseApi.otherInbound.list(listLimit);
      break;
    case 'material_return':
      res = await warehouseApi.materialReturn.list(listLimit);
      break;
    case 'outsource_receipt':
      res = await outsourceMaterialReceiptApi.list(listLimit);
      break;
    case 'outsource_material_return':
      res = await outsourceMaterialReturnApi.list(listLimit);
      break;
    case 'outsource_product_return':
      res = await outsourceProductReturnApi.list(listLimit);
      break;
    default:
      return undefined;
  }
  const { data } = normalizeWarehouseListResponse(res);
  return findUuid(data);
}
