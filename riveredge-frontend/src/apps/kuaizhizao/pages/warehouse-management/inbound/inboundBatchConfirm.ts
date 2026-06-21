import type { TFunction } from 'i18next';
import { warehouseApi } from '../../../services/warehouse-execution';
import { customerMaterialRegistrationApi } from '../../../services/customer-material-registration';
import {
  outsourceMaterialReceiptApi,
  outsourceMaterialReturnApi,
  outsourceProductReturnApi,
} from '../../../services/production';
import type { InboundHubOrder } from './inboundHubTypes';
import { isInboundConfirmable } from './inboundHubTypes';
import { checkPurchaseReceiptIqcForConfirm } from './inboundPurchaseIqcGate';
import { checkCustomerMaterialIqcForConfirm } from './inboundCustomerMaterialIqcGate';
import {
  checkFinishedGoodsReceiptFqcForConfirm,
  checkSemiFinishedGoodsReceiptFqcForConfirm,
} from './inboundFinishedGoodsFqcGate';

export type BatchConfirmResult = {
  success: number;
  failed: { key: string; message: string }[];
};

async function fetchDetail(record: InboundHubOrder): Promise<Record<string, unknown> | null> {
  const id = String(record.id);
  try {
    switch (record.receipt_type) {
      case 'purchase':
        return (await warehouseApi.purchaseReceipt.get(id)) as Record<string, unknown>;
      case 'finished_goods':
        return (await warehouseApi.finishedGoodsReceipt.get(id)) as Record<string, unknown>;
      case 'semi_finished_goods':
        return (await warehouseApi.semiFinishedGoodsReceipt.get(id)) as Record<string, unknown>;
      case 'production_return':
        return (await warehouseApi.productionReturn.get(id)) as Record<string, unknown>;
      case 'sales_return':
        return (await warehouseApi.salesReturn.get(id)) as Record<string, unknown>;
      case 'other_inbound':
        return (await warehouseApi.otherInbound.get(id)) as Record<string, unknown>;
      case 'material_return':
        return (await warehouseApi.materialReturn.get(id)) as Record<string, unknown>;
      case 'outsource_receipt':
        return (await outsourceMaterialReceiptApi.get(id)) as Record<string, unknown>;
      case 'outsource_material_return':
        return (await outsourceMaterialReturnApi.get(id)) as Record<string, unknown>;
      case 'outsource_product_return':
        return (await outsourceProductReturnApi.get(id)) as Record<string, unknown>;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

async function confirmSingle(record: InboundHubOrder, t?: TFunction): Promise<void> {
  const id = String(record.id);
  if (record.receipt_type === 'customer_material') {
    await checkCustomerMaterialIqcForConfirm(id, t);
    await customerMaterialRegistrationApi.process(id);
    return;
  }
  if (record.receipt_type === 'outsource_receipt') {
    await outsourceMaterialReceiptApi.complete(id);
    return;
  }
  const detail = await fetchDetail(record);
  if (!detail) {
    throw new Error(t?.('app.kuaizhizao.warehouseInbound.batchConfirm.loadDetailFailed') ?? '加载单据详情失败');
  }
  const whId = Number(detail.warehouse_id || record.warehouse_id || 0);
  const whName = String(detail.warehouse_name || record.warehouse_name || '');

  if (record.receipt_type === 'purchase') {
    await checkPurchaseReceiptIqcForConfirm(id, t);
    const items = ((detail.items as Record<string, unknown>[]) || []).map((it) => ({
      item_id: Number(it.id),
      warehouse_id: whId,
      warehouse_name: whName,
      batch_number: it.batch_number || undefined,
      serial_numbers: it.serial_numbers || undefined,
      location_id: it.location_id || undefined,
      location_code: it.location_code || undefined,
    }));
    await warehouseApi.purchaseReceipt.confirm(id, {
      warehouse_id: whId,
      warehouse_name: whName,
      items,
    });
    return;
  }
  if (record.receipt_type === 'finished_goods') {
    await checkFinishedGoodsReceiptFqcForConfirm(id, t);
    await warehouseApi.finishedGoodsReceipt.confirm(id, {
      warehouse_id: whId,
      warehouse_name: whName,
    });
    return;
  }
  if (record.receipt_type === 'semi_finished_goods') {
    await checkSemiFinishedGoodsReceiptFqcForConfirm(id, t);
    await warehouseApi.semiFinishedGoodsReceipt.confirm(id, {
      warehouse_id: whId,
      warehouse_name: whName,
    });
    return;
  }
  if (record.receipt_type === 'production_return') {
    await warehouseApi.productionReturn.confirm(id, {
      warehouse_id: whId,
      warehouse_name: whName,
    });
    return;
  }
  if (record.receipt_type === 'sales_return') {
    await warehouseApi.salesReturn.confirm(id);
    return;
  }
  if (record.receipt_type === 'other_inbound') {
    await warehouseApi.otherInbound.confirm(id);
    return;
  }
  if (record.receipt_type === 'material_return') {
    await warehouseApi.materialReturn.confirm(id);
    return;
  }
  if (record.receipt_type === 'outsource_material_return' || record.receipt_type === 'outsource_product_return') {
    throw new Error(
      t?.('app.kuaizhizao.warehouseInbound.batchConfirm.useSinglePreview') ?? '委外退料/退货请使用单行确认预览',
    );
  }
  throw new Error(t?.('app.kuaizhizao.warehouseInbound.batchConfirm.unsupportedType') ?? '不支持的单据类型');
}

export async function batchConfirmInboundDocuments(
  records: InboundHubOrder[],
  t?: TFunction,
): Promise<BatchConfirmResult> {
  const result: BatchConfirmResult = { success: 0, failed: [] };
  const notConfirmableMsg =
    t?.('app.kuaizhizao.warehouseInbound.batchConfirm.notConfirmable') ?? '当前状态不可确认入库';
  const failedMsg = t?.('app.kuaizhizao.warehouseInbound.batchConfirm.failed') ?? '确认失败';
  for (const record of records) {
    const key = `${record.receipt_type}::${record.id}`;
    if (!isInboundConfirmable(record)) {
      result.failed.push({ key, message: notConfirmableMsg });
      continue;
    }
    try {
      await confirmSingle(record, t);
      result.success += 1;
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } };
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        failedMsg;
      result.failed.push({ key, message: typeof msg === 'string' ? msg : failedMsg });
    }
  }
  return result;
}
