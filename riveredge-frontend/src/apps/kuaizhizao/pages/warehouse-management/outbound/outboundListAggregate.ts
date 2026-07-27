import { warehouseApi } from '../../../services/warehouse-execution';
import { outsourceMaterialIssueApi } from '../../../services/production';
import {
  normalizeWarehouseListResponse,
  sortOutboundHubRows,
} from '../../../utils/warehouseListCore';
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

export type OutboundListEnrichers = {
  enrichProductionPickingRecordsWithCustomFields: (rows: OutboundHubOrder[]) => Promise<OutboundHubOrder[]>;
  enrichSalesDeliveryRecordsWithCustomFields: (rows: OutboundHubOrder[]) => Promise<OutboundHubOrder[]>;
};

export async function fetchOutboundHubList(
  params: Record<string, unknown>,
  enrichers: OutboundListEnrichers,
): Promise<{ data: OutboundHubOrder[]; total: number; success: boolean }> {
  const skip = (((params.current as number) || 1) - 1) * ((params.pageSize as number) || 20);
  const limit = (params.pageSize as number) || 20;
  const typeFilter = params.outbound_type as string | undefined;

  const fetchPicking = !typeFilter || typeFilter === 'production_picking';
  const fetchDelivery = !typeFilter || typeFilter === 'sales_delivery';
  const fetchOutsource = !typeFilter || typeFilter === 'outsource_issue';
  const fetchOther = !typeFilter || typeFilter === 'other_outbound';
  const fetchBorrow = !typeFilter || typeFilter === 'material_borrow';

  const listParams = {
    skip: 0,
    limit: Math.max(limit * 3, 60),
    keyword: params.keyword,
    order_by: params.order_by,
    warehouse_id: params.warehouse_id,
    customer_name: params.customer_name,
    created_start_date: params.created_start_date,
    created_end_date: params.created_end_date,
    updated_start_date: params.updated_start_date,
    updated_end_date: params.updated_end_date,
  };

  const [pickingRes, deliveryRes, outsourceRes, otherRes, borrowRes] = await Promise.all([
    fetchPicking ? warehouseApi.productionPicking.list(listParams) : Promise.resolve(emptyList),
    fetchDelivery ? warehouseApi.salesDelivery.list(listParams) : Promise.resolve(emptyList),
    fetchOutsource ? outsourceMaterialIssueApi.list(listParams) : Promise.resolve(emptyList),
    fetchOther ? warehouseApi.otherOutbound.list(listParams) : Promise.resolve(emptyList),
    fetchBorrow ? warehouseApi.materialBorrow.list(listParams) : Promise.resolve(emptyList),
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

  let combinedData: OutboundHubOrder[] = [
    ...pickingData,
    ...deliveryData,
    ...outsourceData,
    ...otherData,
    ...borrowData,
  ].map(withOutboundHubDisplayFields);

  const statusFilter = params.status as string | undefined;
  if (statusFilter === 'pending') {
    combinedData = combinedData.filter((r) =>
      ['待出库', '待领料', '待借出', '草稿', 'draft', 'pending'].includes(String(r.status || '')),
    );
  } else if (statusFilter === 'posted') {
    combinedData = combinedData.filter((r) =>
      ['已出库', '已领料', '已借出', '已完成', 'completed', '已确认', 'confirmed'].includes(String(r.status || '')),
    );
  }

  const sorted = sortOutboundHubRows(
    combinedData as Record<string, unknown>[],
    typeof params.order_by === 'string' ? params.order_by : undefined,
  ) as OutboundHubOrder[];

  const total = sorted.length;
  const page = sorted.slice(skip, skip + limit);

  return { data: page, success: true, total };
}
