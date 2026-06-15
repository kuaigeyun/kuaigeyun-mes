import { warehouseApi } from '../../../services/warehouse-execution';
import { outsourceMaterialIssueApi } from '../../../services/production';
import type { OutboundHubOrder } from './outboundHubTypes';
import { mapOutsourceIssueToOutbound } from './outboundHubTypes';

const toList = (r: unknown) =>
  Array.isArray(r) ? r : (r as { data?: unknown[]; items?: unknown[] })?.data ?? (r as { items?: unknown[] })?.items ?? [];

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
  const listParams = { skip, limit, ...params, keyword: params.keyword };
  const typeFilter = params.outbound_type as string | undefined;

  const fetchPicking = !typeFilter || typeFilter === 'production_picking';
  const fetchDelivery = !typeFilter || typeFilter === 'sales_delivery';
  const fetchOutsource = !typeFilter || typeFilter === 'outsource_issue';
  const fetchOther = !typeFilter || typeFilter === 'other_outbound';
  const fetchBorrow = !typeFilter || typeFilter === 'material_borrow';

  const [pickingRes, deliveryRes, outsourceRes, otherRes, borrowRes] = await Promise.all([
    fetchPicking ? warehouseApi.productionPicking.list(listParams) : Promise.resolve([]),
    fetchDelivery ? warehouseApi.salesDelivery.list(listParams) : Promise.resolve([]),
    fetchOutsource ? outsourceMaterialIssueApi.list(listParams) : Promise.resolve([]),
    fetchOther ? warehouseApi.otherOutbound.list(listParams) : Promise.resolve([]),
    fetchBorrow ? warehouseApi.materialBorrow.list(listParams) : Promise.resolve([]),
  ]);

  const pickingData = fetchPicking
    ? await enrichers.enrichProductionPickingRecordsWithCustomFields(
        toList(pickingRes).map(
          (item: Record<string, unknown>) =>
            ({
              ...item,
              outbound_type: 'production_picking' as const,
              delivery_date: item.picking_time ?? item.created_at,
              delivered_by: item.picker_name,
            }) as OutboundHubOrder,
        ),
      )
    : [];
  const deliveryData = fetchDelivery
    ? await enrichers.enrichSalesDeliveryRecordsWithCustomFields(
        toList(deliveryRes).map(
          (item: Record<string, unknown>) =>
            ({
              ...item,
              outbound_type: 'sales_delivery' as const,
              delivery_date: item.delivery_time ?? item.delivery_date ?? item.created_at,
              delivered_by: item.deliverer_name,
            }) as OutboundHubOrder,
        ),
      )
    : [];
  const outsourceData = fetchOutsource
    ? toList(outsourceRes).map((item: Record<string, unknown>) => mapOutsourceIssueToOutbound(item))
    : [];
  const otherData = fetchOther
    ? toList(otherRes).map(
        (item: Record<string, unknown>) =>
          ({
            ...item,
            outbound_type: 'other_outbound' as const,
            delivery_code: item.outbound_code,
            delivery_date: item.delivery_time ?? item.created_at,
            delivered_by: item.deliverer_name,
          }) as OutboundHubOrder,
      )
    : [];
  const borrowData = fetchBorrow
    ? toList(borrowRes).map(
        (item: Record<string, unknown>) =>
          ({
            ...item,
            outbound_type: 'material_borrow' as const,
            delivery_code: item.borrow_code,
            delivery_date: item.borrow_time ?? item.created_at,
            delivered_by: item.borrower_name,
          }) as OutboundHubOrder,
      )
    : [];

  let combinedData: OutboundHubOrder[] = [
    ...pickingData,
    ...deliveryData,
    ...outsourceData,
    ...otherData,
    ...borrowData,
  ];

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

  combinedData.sort(
    (a, b) => new Date(String(b.updated_at || '')).getTime() - new Date(String(a.updated_at || '')).getTime(),
  );

  const total =
    (fetchPicking && typeof (pickingRes as { total?: number })?.total === 'number'
      ? (pickingRes as { total: number }).total
      : pickingData.length) +
    (fetchDelivery && typeof (deliveryRes as { total?: number })?.total === 'number'
      ? (deliveryRes as { total: number }).total
      : deliveryData.length) +
    (fetchOutsource ? outsourceData.length : 0) +
    (fetchOther ? otherData.length : 0) +
    (fetchBorrow ? borrowData.length : 0);

  return { data: combinedData, success: true, total };
}
