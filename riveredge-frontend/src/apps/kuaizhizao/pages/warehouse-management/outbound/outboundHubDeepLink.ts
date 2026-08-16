import type { OutboundHubOrder, OutboundIssueType } from './outboundHubTypes';

export type OutboundHubDeepLinkFilter = {
  outboundType: OutboundIssueType;
  id?: number;
  uuid?: string;
};

const DOCUMENT_TYPE_TO_OUTBOUND_TYPE: Record<string, OutboundIssueType> = {
  production_picking: 'production_picking',
  sales_delivery: 'sales_delivery',
  other_outbound: 'other_outbound',
  material_borrow: 'material_borrow',
  outsource_issue: 'outsource_issue',
};

function parsePositiveInt(raw: string | null | undefined): number | undefined {
  const value = raw?.trim();
  if (!value || !/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function parseOutboundHubDeepLink(searchParams: URLSearchParams): OutboundHubDeepLinkFilter | null {
  const documentType = searchParams.get('documentType')?.trim();
  const outboundTypeParam = searchParams.get('outbound_type')?.trim();
  const uuid = searchParams.get('uuid')?.trim();
  const id = parsePositiveInt(searchParams.get('id'));
  const deliveryId = parsePositiveInt(searchParams.get('delivery_id'));

  const outboundTypeFromDoc =
    (documentType && DOCUMENT_TYPE_TO_OUTBOUND_TYPE[documentType]) ||
    (outboundTypeParam as OutboundIssueType | undefined);

  if (uuid && outboundTypeFromDoc) {
    return { outboundType: outboundTypeFromDoc, uuid };
  }

  const resolvedId = id ?? deliveryId;
  if (outboundTypeFromDoc && resolvedId) {
    return { outboundType: outboundTypeFromDoc, id: resolvedId };
  }

  if (resolvedId && documentType === 'sales_delivery') {
    return { outboundType: 'sales_delivery', id: resolvedId };
  }

  return null;
}

export function filterOutboundHubRowsByDeepLink(
  rows: OutboundHubOrder[],
  filter: OutboundHubDeepLinkFilter | null,
): OutboundHubOrder[] {
  if (!filter) return rows;
  return rows.filter((row) => {
    if (row.outbound_type !== filter.outboundType) return false;
    if (filter.id != null && row.id !== filter.id) return false;
    if (filter.uuid && String(row.uuid ?? '') !== filter.uuid) return false;
    return true;
  });
}

export function outboundHubDeepLinkStub(filter: OutboundHubDeepLinkFilter): OutboundHubOrder {
  return {
    id: filter.id,
    uuid: filter.uuid,
    outbound_type: filter.outboundType,
  };
}

export async function resolveOutboundDeepLinkId(
  filter: OutboundHubDeepLinkFilter,
): Promise<number | undefined> {
  if (filter.id) return filter.id;
  if (!filter.uuid) return undefined;

  const { warehouseApi } = await import('../../../services/warehouse-execution');
  const { outsourceMaterialIssueApi } = await import('../../../services/production');
  const { normalizeWarehouseListResponse } = await import('../../../utils/warehouseListCore');

  const findUuid = (items: unknown[]) => {
    const hit = items.find((item) => String((item as { uuid?: string }).uuid ?? '') === filter.uuid);
    const id = (hit as { id?: number })?.id;
    return id != null && id > 0 ? id : undefined;
  };

  const listLimit = { skip: 0, limit: 500 };
  let res: unknown;
  switch (filter.outboundType) {
    case 'production_picking':
      res = await warehouseApi.productionPicking.list(listLimit);
      break;
    case 'sales_delivery':
      res = await warehouseApi.salesDelivery.list(listLimit);
      break;
    case 'other_outbound':
      res = await warehouseApi.otherOutbound.list(listLimit);
      break;
    case 'material_borrow':
      res = await warehouseApi.materialBorrow.list(listLimit);
      break;
    case 'outsource_issue':
      res = await outsourceMaterialIssueApi.list(listLimit);
      break;
    default:
      return undefined;
  }
  const { data } = normalizeWarehouseListResponse(res);
  return findUuid(data);
}
