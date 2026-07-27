import { warehouseApi } from '../../../services/warehouse-execution';
import { customerMaterialRegistrationApi } from '../../../services/customer-material-registration';
import {
  outsourceMaterialReceiptApi,
  outsourceMaterialReturnApi,
  outsourceProductReturnApi,
} from '../../../services/production';
import {
  normalizeWarehouseListResponse,
  sortInboundHubRows,
} from '../../../utils/warehouseListCore';
import type { InboundHubOrder, InboundReceiptType } from './inboundHubTypes';
import { resolveInboundHubDateRaw, resolveInboundHubOperator } from './inboundHubTypes';

function withInboundHubDisplayFields(row: InboundHubOrder): InboundHubOrder {
  const dateRaw = resolveInboundHubDateRaw(row);
  const operator = resolveInboundHubOperator(row);
  return {
    ...row,
    ...(dateRaw != null && String(dateRaw).trim() !== ''
      ? { receipt_date: String(dateRaw) }
      : {}),
    ...(operator ? { received_by: operator } : {}),
  };
}

const emptyList = { items: [] as unknown[], total: 0 };

const toList = (r: unknown) => {
  const { data, total } = normalizeWarehouseListResponse(r);
  return { items: data, total };
};

export type InboundListEnrichers = {
  enrichPurchaseReceiptRecordsWithCustomFields: (rows: InboundHubOrder[]) => Promise<InboundHubOrder[]>;
  enrichFinishedGoodsReceiptRecordsWithCustomFields: (rows: InboundHubOrder[]) => Promise<InboundHubOrder[]>;
  enrichProductionReturnRecordsWithCustomFields: (rows: InboundHubOrder[]) => Promise<InboundHubOrder[]>;
};

function shouldFetchType(typeFilter: string | undefined, type: InboundReceiptType) {
  return !typeFilter || typeFilter === type;
}

export async function fetchInboundHubList(
  params: Record<string, unknown>,
  enrichers: InboundListEnrichers,
): Promise<{ data: InboundHubOrder[]; total: number; success: boolean }> {
  const skip = (((params.current as number) || 1) - 1) * ((params.pageSize as number) || 20);
  const limit = (params.pageSize as number) || 20;
  const typeFilter = params.receipt_type as string | undefined;
  const listParams = {
    skip: 0,
    limit: Math.max(limit * 3, 60),
    keyword: params.keyword,
    order_by: params.order_by,
    warehouse_id: params.warehouse_id,
    supplier_name: params.supplier_name,
    created_start_date: params.created_start_date,
    created_end_date: params.created_end_date,
    updated_start_date: params.updated_start_date,
    updated_end_date: params.updated_end_date,
  };

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
    shouldFetchType(typeFilter, 'purchase')
      ? warehouseApi.purchaseReceipt.list(listParams)
      : Promise.resolve(emptyList),
    shouldFetchType(typeFilter, 'finished_goods')
      ? warehouseApi.finishedGoodsReceipt.list(listParams)
      : Promise.resolve(emptyList),
    shouldFetchType(typeFilter, 'semi_finished_goods')
      ? warehouseApi.semiFinishedGoodsReceipt.list(listParams)
      : Promise.resolve(emptyList),
    shouldFetchType(typeFilter, 'production_return')
      ? warehouseApi.productionReturn.list(listParams)
      : Promise.resolve(emptyList),
    shouldFetchType(typeFilter, 'customer_material')
      ? customerMaterialRegistrationApi.list(listParams)
      : Promise.resolve(emptyList),
    shouldFetchType(typeFilter, 'sales_return')
      ? warehouseApi.salesReturn.list(listParams)
      : Promise.resolve(emptyList),
    shouldFetchType(typeFilter, 'outsource_receipt')
      ? outsourceMaterialReceiptApi.list(listParams)
      : Promise.resolve(emptyList),
    shouldFetchType(typeFilter, 'outsource_material_return')
      ? outsourceMaterialReturnApi.list(listParams)
      : Promise.resolve(emptyList),
    shouldFetchType(typeFilter, 'outsource_product_return')
      ? outsourceProductReturnApi.list(listParams)
      : Promise.resolve(emptyList),
    shouldFetchType(typeFilter, 'other_inbound')
      ? warehouseApi.otherInbound.list(listParams)
      : Promise.resolve(emptyList),
    shouldFetchType(typeFilter, 'material_return')
      ? warehouseApi.materialReturn.list(listParams)
      : Promise.resolve(emptyList),
  ]);

  const purchaseListed = toList(purchaseRes);
  const purchaseData = await enrichers.enrichPurchaseReceiptRecordsWithCustomFields(
    purchaseListed.items.map(
      (item) =>
        ({
          ...(item as Record<string, unknown>),
          receipt_type: 'purchase' as const,
        }) as InboundHubOrder,
    ),
  );
  const finishedListed = toList(finishedRes);
  const finishedData = await enrichers.enrichFinishedGoodsReceiptRecordsWithCustomFields(
    finishedListed.items.map(
      (item) =>
        ({
          ...(item as Record<string, unknown>),
          receipt_type: 'finished_goods' as const,
        }) as InboundHubOrder,
    ),
  );
  const semiData = toList(semiRes).items.map(
    (item) =>
      ({
        ...(item as Record<string, unknown>),
        receipt_type: 'semi_finished_goods' as const,
      }) as InboundHubOrder,
  );
  const returnListed = toList(returnRes);
  const returnData = await enrichers.enrichProductionReturnRecordsWithCustomFields(
    returnListed.items.map(
      (item) =>
        ({
          ...(item as Record<string, unknown>),
          receipt_type: 'production_return' as const,
          receipt_code: (item as Record<string, unknown>).return_code,
        }) as InboundHubOrder,
    ),
  );
  const customerMaterialData = toList(customerMaterialRes).items.map(
    (item) =>
      ({
        ...(item as Record<string, unknown>),
        receipt_type: 'customer_material' as const,
        receipt_code: (item as Record<string, unknown>).registration_code,
        total_quantity: (item as Record<string, unknown>).total_quantity ?? (item as Record<string, unknown>).quantity,
        status:
          (item as Record<string, unknown>).status === 'pending'
            ? '待入库'
            : (item as Record<string, unknown>).status === 'processed'
              ? '已入库'
              : (item as Record<string, unknown>).status,
        receipt_date: (item as Record<string, unknown>).registration_date,
        received_by: (item as Record<string, unknown>).processed_by_name || (item as Record<string, unknown>).registered_by_name,
      }) as InboundHubOrder,
  );
  const salesReturnData = toList(salesReturnRes).items.map(
    (item) =>
      ({
        ...(item as Record<string, unknown>),
        receipt_type: 'sales_return' as const,
        receipt_code: (item as Record<string, unknown>).return_code,
        total_quantity:
          (item as Record<string, unknown>).total_quantity ?? (item as Record<string, unknown>).total_return_quantity,
      }) as InboundHubOrder,
  );
  const outsourceReceiptData = toList(outsourceReceiptRes).items.map((item) => {
    const row = item as Record<string, unknown>;
    const receivedAt = row.received_at ?? row.receivedAt;
    const operatorName =
      row.received_by_name ||
      row.receivedByName ||
      row.created_by_name ||
      row.createdByName;
    return {
      ...row,
      receipt_type: 'outsource_receipt' as const,
      receipt_code: row.code,
      outsource_work_order_code: row.outsource_work_order_code ?? row.outsourceWorkOrderCode,
      total_quantity: row.quantity,
      // 委外收货：业务字段 received_at / received_by_name（received_by 为用户 ID）
      received_at: receivedAt,
      received_by_name: operatorName,
      receipt_date: receivedAt ?? row.receipt_date,
      received_by: operatorName,
      status:
        row.status === 'draft'
          ? '草稿'
          : row.status === 'completed'
            ? '已入库'
            : row.status,
    } as InboundHubOrder;
  });
  const outsourceMaterialReturnData = toList(outsourceMaterialReturnRes).items.map((item) => {
    const row = item as Record<string, unknown>;
    const returnedAt = row.returned_at ?? row.returnedAt;
    const operatorName =
      row.returned_by_name ||
      row.returnedByName ||
      row.created_by_name ||
      row.createdByName;
    return {
      ...row,
      receipt_type: 'outsource_material_return' as const,
      receipt_code: row.code,
      outsource_work_order_code: row.outsource_work_order_code ?? row.outsourceWorkOrderCode,
      total_quantity: row.quantity,
      returned_at: returnedAt,
      returned_by_name: operatorName,
      receipt_date: returnedAt ?? row.receipt_date,
      received_by: operatorName,
      status:
        row.status === 'draft'
          ? '草稿'
          : row.status === 'completed'
            ? '已入库'
            : row.status,
    } as InboundHubOrder;
  });
  const outsourceProductReturnData = toList(outsourceProductReturnRes).items.map((item) => {
    const row = item as Record<string, unknown>;
    const returnedAt = row.returned_at ?? row.returnedAt;
    const operatorName =
      row.returned_by_name ||
      row.returnedByName ||
      row.created_by_name ||
      row.createdByName;
    return {
      ...row,
      receipt_type: 'outsource_product_return' as const,
      receipt_code: row.code,
      outsource_work_order_code: row.outsource_work_order_code ?? row.outsourceWorkOrderCode,
      total_quantity: row.quantity,
      returned_at: returnedAt,
      returned_by_name: operatorName,
      receipt_date: returnedAt ?? row.receipt_date,
      received_by: operatorName,
      status:
        row.status === 'draft'
          ? '草稿'
          : row.status === 'completed'
            ? '已入库'
            : row.status,
    } as InboundHubOrder;
  });
  const otherInboundData = toList(otherInboundRes).items.map(
    (item) =>
      ({
        ...(item as Record<string, unknown>),
        receipt_type: 'other_inbound' as const,
        receipt_code: (item as Record<string, unknown>).inbound_code,
        total_quantity: (item as Record<string, unknown>).total_quantity,
      }) as InboundHubOrder,
  );
  const materialReturnData = toList(materialReturnRes).items.map(
    (item) =>
      ({
        ...(item as Record<string, unknown>),
        receipt_type: 'material_return' as const,
        receipt_code: (item as Record<string, unknown>).return_code,
        total_quantity:
          (item as Record<string, unknown>).total_quantity ?? (item as Record<string, unknown>).total_return_quantity,
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
  ].map(withInboundHubDisplayFields);

  const statusFilter = params.status as string | undefined;
  if (statusFilter === 'pending') {
    combinedData = combinedData.filter((r) =>
      ['待入库', '草稿', '待退货', '待退料', '待归还', 'pending', 'draft'].includes(String(r.status || '')),
    );
  } else if (statusFilter === 'posted') {
    combinedData = combinedData.filter((r) =>
      ['已入库', '已退货', '已退料', '已归还', 'processed', 'completed', '已确认'].includes(String(r.status || '')),
    );
  }

  const sorted = sortInboundHubRows(
    combinedData as Record<string, unknown>[],
    typeof params.order_by === 'string' ? params.order_by : undefined,
  ) as InboundHubOrder[];

  const total = sorted.length;
  const page = sorted.slice(skip, skip + limit);

  return { data: page, success: true, total };
}
