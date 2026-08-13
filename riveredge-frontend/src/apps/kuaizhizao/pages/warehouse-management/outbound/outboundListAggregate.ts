import type { CurrentUser } from '../../../../../types/api';
import { warehouseApi } from '../../../services/warehouse-execution';
import { outsourceMaterialIssueApi } from '../../../services/production';
import {
  normalizeWarehouseListResponse,
  sortOutboundHubRows,
} from '../../../utils/warehouseListCore';
import { shouldFetchOutboundHubType } from '../../../utils/warehouseHubFetchGates';
import type { OutboundHubOrder } from './outboundHubTypes';
import {
  mapOutsourceIssueToOutbound,
  resolveOutboundHubDateRaw,
  resolveOutboundHubOperator,
} from './outboundHubTypes';

function withOutboundHubDisplayFields(row: OutboundHubOrder): OutboundHubOrder {
  const dateRaw = resolveOutboundHubDateRaw(row);
  const operator = resolveOutboundHubOperator(row);
  return {
    ...row,
    ...(dateRaw != null && String(dateRaw).trim() !== ''
      ? { delivery_date: String(dateRaw) }
      : {}),
    ...(operator ? { delivered_by: operator } : {}),
  };
}

const emptyList = { items: [] as unknown[], total: 0 };

const toList = (r: unknown) => {
  const { data, total } = normalizeWarehouseListResponse(r);
  return { items: data, total };
};

function sourceStatus(
  hubStatus: string | undefined,
  pendingStatus: string,
  postedStatus: string,
): string | undefined {
  if (hubStatus === 'pending') return pendingStatus;
  if (hubStatus === 'posted') return postedStatus;
  if (!hubStatus || hubStatus === 'all') return undefined;
  return hubStatus;
}

export type OutboundListEnrichers = {
  enrichProductionPickingRecordsWithCustomFields: (rows: OutboundHubOrder[]) => Promise<OutboundHubOrder[]>;
  enrichSalesDeliveryRecordsWithCustomFields: (rows: OutboundHubOrder[]) => Promise<OutboundHubOrder[]>;
};

export async function fetchOutboundHubList(
  params: Record<string, unknown>,
  enrichers: OutboundListEnrichers,
  user: CurrentUser | undefined,
): Promise<{ data: OutboundHubOrder[]; total: number; success: boolean }> {
  const skip = (((params.current as number) || 1) - 1) * ((params.pageSize as number) || 20);
  const limit = (params.pageSize as number) || 20;
  const typeFilter = params.outbound_type as string | undefined;
  const hubStatus = params.status as string | undefined;
  const typed = Boolean(typeFilter);
  const fetchSkip = typed ? skip : 0;
  const fetchLimit = typed ? limit : skip + limit;

  const fetchPicking = shouldFetchOutboundHubType(user, typeFilter, 'production_picking');
  const fetchDelivery = shouldFetchOutboundHubType(user, typeFilter, 'sales_delivery');
  const fetchOutsource = shouldFetchOutboundHubType(user, typeFilter, 'outsource_issue');
  const fetchOther = shouldFetchOutboundHubType(user, typeFilter, 'other_outbound');
  const fetchBorrow = shouldFetchOutboundHubType(user, typeFilter, 'material_borrow');

  const baseParams = {
    skip: fetchSkip,
    limit: fetchLimit,
    keyword: params.keyword,
    order_by: params.order_by,
    warehouse_id: params.warehouse_id,
    warehouse_name: params.warehouse_name,
    customer_name: params.customer_name,
    total_quantity: params.total_quantity,
    created_start_date: params.created_start_date,
    created_end_date: params.created_end_date,
    updated_start_date: params.updated_start_date,
    updated_end_date: params.updated_end_date,
  };

  const [pickingRes, deliveryRes, outsourceRes, otherRes, borrowRes] = await Promise.all([
    fetchPicking
      ? warehouseApi.productionPicking.list({
          ...baseParams,
          status: sourceStatus(hubStatus, '待领料', '已领料'),
        })
      : Promise.resolve(emptyList),
    fetchDelivery
      ? warehouseApi.salesDelivery.list({
          ...baseParams,
          status: sourceStatus(hubStatus, '待出库', '已出库'),
        })
      : Promise.resolve(emptyList),
    fetchOutsource
      ? outsourceMaterialIssueApi.list({
          ...baseParams,
          status: sourceStatus(hubStatus, 'draft', 'completed'),
        })
      : Promise.resolve(emptyList),
    fetchOther
      ? warehouseApi.otherOutbound.list({
          ...baseParams,
          status: sourceStatus(hubStatus, '待出库', '已出库'),
        })
      : Promise.resolve(emptyList),
    fetchBorrow
      ? warehouseApi.materialBorrow.list({
          ...baseParams,
          status: sourceStatus(hubStatus, '待借出', '已借出'),
        })
      : Promise.resolve(emptyList),
  ]);

  const pickingData = fetchPicking
    ? await enrichers.enrichProductionPickingRecordsWithCustomFields(
        toList(pickingRes).items.map(
          (item) =>
            ({
              ...(item as Record<string, unknown>),
              outbound_type: 'production_picking' as const,
              delivery_date: (item as Record<string, unknown>).picking_time ?? (item as Record<string, unknown>).created_at,
              delivered_by: (item as Record<string, unknown>).picker_name,
            }) as OutboundHubOrder,
        ),
      )
    : [];
  const deliveryData = fetchDelivery
    ? await enrichers.enrichSalesDeliveryRecordsWithCustomFields(
        toList(deliveryRes).items.map(
          (item) =>
            ({
              ...(item as Record<string, unknown>),
              outbound_type: 'sales_delivery' as const,
              delivery_date:
                (item as Record<string, unknown>).delivery_time ??
                (item as Record<string, unknown>).delivery_date ??
                (item as Record<string, unknown>).created_at,
              delivered_by: (item as Record<string, unknown>).deliverer_name,
            }) as OutboundHubOrder,
        ),
      )
    : [];
  const outsourceData = fetchOutsource
    ? toList(outsourceRes).items.map((item) => mapOutsourceIssueToOutbound(item as Record<string, unknown>))
    : [];
  const otherData = fetchOther
    ? toList(otherRes).items.map(
        (item) =>
          ({
            ...(item as Record<string, unknown>),
            outbound_type: 'other_outbound' as const,
            delivery_code: (item as Record<string, unknown>).outbound_code,
            delivery_date: (item as Record<string, unknown>).delivery_time ?? (item as Record<string, unknown>).created_at,
            delivered_by: (item as Record<string, unknown>).deliverer_name,
          }) as OutboundHubOrder,
      )
    : [];
  const borrowData = fetchBorrow
    ? toList(borrowRes).items.map(
        (item) =>
          ({
            ...(item as Record<string, unknown>),
            outbound_type: 'material_borrow' as const,
            delivery_code: (item as Record<string, unknown>).borrow_code,
            delivery_date: (item as Record<string, unknown>).borrow_time ?? (item as Record<string, unknown>).created_at,
            delivered_by: (item as Record<string, unknown>).borrower_name,
          }) as OutboundHubOrder,
      )
    : [];

  const combinedData: OutboundHubOrder[] = [
    ...pickingData,
    ...deliveryData,
    ...outsourceData,
    ...otherData,
    ...borrowData,
  ].map(withOutboundHubDisplayFields);

  const sorted = sortOutboundHubRows(
    combinedData as Record<string, unknown>[],
    typeof params.order_by === 'string' ? params.order_by : undefined,
  ) as OutboundHubOrder[];

  const sourceTotal =
    (fetchPicking ? toList(pickingRes).total : 0) +
    (fetchDelivery ? toList(deliveryRes).total : 0) +
    (fetchOutsource ? toList(outsourceRes).total : 0) +
    (fetchOther ? toList(otherRes).total : 0) +
    (fetchBorrow ? toList(borrowRes).total : 0);

  if (typed) {
    return { data: sorted, success: true, total: sourceTotal };
  }

  const page = sorted.slice(skip, skip + limit);
  return { data: page, success: true, total: sourceTotal };
}
