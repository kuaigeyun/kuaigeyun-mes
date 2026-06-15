import { warehouseApi } from '../../../services/warehouse-execution';
import { customerMaterialRegistrationApi } from '../../../services/customer-material-registration';
import {
  outsourceMaterialReceiptApi,
  outsourceMaterialReturnApi,
  outsourceProductReturnApi,
} from '../../../services/production';
import type { InboundHubOrder } from './inboundHubTypes';

const toList = (r: unknown) =>
  Array.isArray(r) ? r : (r as { data?: unknown[]; items?: unknown[] })?.data ?? (r as { items?: unknown[] })?.items ?? [];

export type InboundListEnrichers = {
  enrichPurchaseReceiptRecordsWithCustomFields: (rows: InboundHubOrder[]) => Promise<InboundHubOrder[]>;
  enrichFinishedGoodsReceiptRecordsWithCustomFields: (rows: InboundHubOrder[]) => Promise<InboundHubOrder[]>;
  enrichProductionReturnRecordsWithCustomFields: (rows: InboundHubOrder[]) => Promise<InboundHubOrder[]>;
};

export async function fetchInboundHubList(
  params: Record<string, unknown>,
  enrichers: InboundListEnrichers,
): Promise<{ data: InboundHubOrder[]; total: number; success: boolean }> {
  const skip = (((params.current as number) || 1) - 1) * ((params.pageSize as number) || 20);
  const limit = (params.pageSize as number) || 20;
  const listParams = { skip, limit, ...params, keyword: params.keyword };

  const [
    purchaseRes,
    finishedRes,
    semiRes,
    returnRes,
    customerMaterialRes,
    salesReturnRes,
    outsourceReceiptRes,
    outsourceMaterialReturnRes,
    outsourceProductReturnRes,
    otherInboundRes,
    materialReturnRes,
  ] = await Promise.all([
    warehouseApi.purchaseReceipt.list(listParams),
    warehouseApi.finishedGoodsReceipt.list(listParams),
    warehouseApi.semiFinishedGoodsReceipt.list(listParams),
    warehouseApi.productionReturn.list(listParams),
    customerMaterialRegistrationApi.list(listParams),
    warehouseApi.salesReturn.list(listParams),
    outsourceMaterialReceiptApi.list(listParams),
    outsourceMaterialReturnApi.list(listParams),
    outsourceProductReturnApi.list(listParams),
    warehouseApi.otherInbound.list(listParams),
    warehouseApi.materialReturn.list(listParams),
  ]);

  const purchaseData = await enrichers.enrichPurchaseReceiptRecordsWithCustomFields(
    toList(purchaseRes).map(
      (item: Record<string, unknown>) =>
        ({
          ...item,
          receipt_type: 'purchase' as const,
        }) as InboundHubOrder,
    ),
  );
  const finishedData = await enrichers.enrichFinishedGoodsReceiptRecordsWithCustomFields(
    toList(finishedRes).map(
      (item: Record<string, unknown>) =>
        ({
          ...item,
          receipt_type: 'finished_goods' as const,
        }) as InboundHubOrder,
    ),
  );
  const semiData = toList(semiRes).map(
    (item: Record<string, unknown>) =>
      ({
        ...item,
        receipt_type: 'semi_finished_goods' as const,
      }) as InboundHubOrder,
  );
  const returnData = await enrichers.enrichProductionReturnRecordsWithCustomFields(
    toList(returnRes).map(
      (item: Record<string, unknown>) =>
        ({
          ...item,
          receipt_type: 'production_return' as const,
          receipt_code: item.return_code,
        }) as InboundHubOrder,
    ),
  );
  const customerMaterialData = toList(customerMaterialRes).map(
    (item: Record<string, unknown>) =>
      ({
        ...item,
        receipt_type: 'customer_material' as const,
        receipt_code: item.registration_code,
        total_quantity: item.total_quantity ?? item.quantity,
        status: item.status === 'pending' ? '待入库' : item.status === 'processed' ? '已入库' : item.status,
        receipt_date: item.registration_date,
        received_by: item.processed_by_name || item.registered_by_name,
      }) as InboundHubOrder,
  );
  const salesReturnData = toList(salesReturnRes).map(
    (item: Record<string, unknown>) =>
      ({
        ...item,
        receipt_type: 'sales_return' as const,
        receipt_code: item.return_code,
        total_quantity: item.total_quantity ?? item.total_return_quantity,
      }) as InboundHubOrder,
  );
  const outsourceReceiptData = toList(outsourceReceiptRes).map(
    (item: Record<string, unknown>) =>
      ({
        ...item,
        receipt_type: 'outsource_receipt' as const,
        receipt_code: item.code,
        outsource_work_order_code: item.outsource_work_order_code,
        total_quantity: item.quantity,
        status: item.status === 'draft' ? '草稿' : item.status === 'completed' ? '已入库' : item.status,
      }) as InboundHubOrder,
  );
  const outsourceMaterialReturnData = toList(outsourceMaterialReturnRes).map(
    (item: Record<string, unknown>) =>
      ({
        ...item,
        receipt_type: 'outsource_material_return' as const,
        receipt_code: item.code,
        outsource_work_order_code: item.outsource_work_order_code,
        total_quantity: item.quantity,
        status: item.status === 'draft' ? '草稿' : item.status === 'completed' ? '已入库' : item.status,
      }) as InboundHubOrder,
  );
  const outsourceProductReturnData = toList(outsourceProductReturnRes).map(
    (item: Record<string, unknown>) =>
      ({
        ...item,
        receipt_type: 'outsource_product_return' as const,
        receipt_code: item.code,
        outsource_work_order_code: item.outsource_work_order_code,
        total_quantity: item.quantity,
        status: item.status === 'draft' ? '草稿' : item.status === 'completed' ? '已入库' : item.status,
      }) as InboundHubOrder,
  );
  const otherInboundData = toList(otherInboundRes).map(
    (item: Record<string, unknown>) =>
      ({
        ...item,
        receipt_type: 'other_inbound' as const,
        receipt_code: item.inbound_code,
        total_quantity: item.total_quantity,
      }) as InboundHubOrder,
  );
  const materialReturnData = toList(materialReturnRes).map(
    (item: Record<string, unknown>) =>
      ({
        ...item,
        receipt_type: 'material_return' as const,
        receipt_code: item.return_code,
        total_quantity: item.total_quantity ?? item.total_return_quantity,
      }) as InboundHubOrder,
  );

  let combinedData: InboundHubOrder[] = [
    ...purchaseData,
    ...finishedData,
    ...semiData,
    ...returnData,
    ...customerMaterialData,
    ...salesReturnData,
    ...outsourceReceiptData,
    ...outsourceMaterialReturnData,
    ...outsourceProductReturnData,
    ...otherInboundData,
    ...materialReturnData,
  ];

  const statusFilter = params.status as string | undefined;
  if (statusFilter === 'pending') {
    combinedData = combinedData.filter(
      (r) =>
        ['待入库', '草稿', '待退货', '待退料', '待归还', 'pending', 'draft'].includes(String(r.status || '')),
    );
  } else if (statusFilter === 'posted') {
    combinedData = combinedData.filter(
      (r) =>
        ['已入库', '已退货', '已退料', '已归还', 'processed', 'completed', '已确认'].includes(String(r.status || '')),
    );
  }

  const typeFilter = params.receipt_type as string | undefined;
  if (typeFilter) {
    combinedData = combinedData.filter((r) => r.receipt_type === typeFilter);
  }

  combinedData.sort(
    (a, b) => new Date(String(b.created_at || '')).getTime() - new Date(String(a.created_at || '')).getTime(),
  );

  const total =
    (typeof (purchaseRes as { total?: number })?.total === 'number'
      ? (purchaseRes as { total: number }).total
      : purchaseData.length) +
    (typeof (finishedRes as { total?: number })?.total === 'number'
      ? (finishedRes as { total: number }).total
      : finishedData.length) +
    (typeof (semiRes as { total?: number })?.total === 'number'
      ? (semiRes as { total: number }).total
      : semiData.length) +
    (typeof (returnRes as { total?: number })?.total === 'number'
      ? (returnRes as { total: number }).total
      : returnData.length) +
    (typeof (customerMaterialRes as { total?: number })?.total === 'number'
      ? (customerMaterialRes as { total: number }).total
      : customerMaterialData.length) +
    toList(salesReturnRes).length +
    toList(outsourceReceiptRes).length +
    toList(outsourceMaterialReturnRes).length +
    toList(outsourceProductReturnRes).length +
    toList(otherInboundRes).length +
    toList(materialReturnRes).length;

  return { data: combinedData, success: true, total };
}
