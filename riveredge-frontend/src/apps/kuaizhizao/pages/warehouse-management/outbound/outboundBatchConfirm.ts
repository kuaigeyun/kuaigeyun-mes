import { warehouseApi } from '../../../services/warehouse-execution';
import type { OutboundHubOrder } from './outboundHubTypes';
import { isOutboundConfirmable } from './outboundHubTypes';
import type { OutboundConfirmationPayload } from './outboundItemTracking';

export type BatchConfirmResult = {
  success: number;
  failed: { key: string; message: string }[];
};

async function fetchDetail(record: OutboundHubOrder): Promise<Record<string, unknown> | null> {
  const id = String(record.id);
  try {
    switch (record.outbound_type) {
      case 'production_picking':
        return (await warehouseApi.productionPicking.get(id)) as Record<string, unknown>;
      case 'sales_delivery':
        return (await warehouseApi.salesDelivery.get(id)) as Record<string, unknown>;
      case 'other_outbound':
        return (await warehouseApi.otherOutbound.get(id)) as Record<string, unknown>;
      case 'material_borrow':
        return (await warehouseApi.materialBorrow.get(id)) as Record<string, unknown>;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function buildSimpleConfirmPayload(detail: Record<string, unknown>, record: OutboundHubOrder): OutboundConfirmationPayload {
  const whId = Number(detail.warehouse_id || record.warehouse_id || 0);
  const whName = String(detail.warehouse_name || record.warehouse_name || '');
  const itemsKey =
    record.outbound_type === 'sales_delivery'
      ? 'items'
      : record.outbound_type === 'production_picking'
        ? 'items'
        : 'items';
  const rawItems = (detail[itemsKey] as Record<string, unknown>[]) || [];
  const items = rawItems.map((it) => ({
    item_id: Number(it.id),
    warehouse_id: whId || undefined,
    batch_number: it.batch_number ? String(it.batch_number) : undefined,
    batch_no: it.batch_number ? String(it.batch_number) : undefined,
    location_id: it.location_id != null ? Number(it.location_id) : undefined,
    location_code: it.location_code ? String(it.location_code) : undefined,
    serial_numbers: Array.isArray(it.serial_numbers) ? (it.serial_numbers as string[]) : undefined,
  }));

  if (record.outbound_type === 'sales_delivery') {
    const active = items.filter((it) => Number.isFinite(it.item_id) && it.item_id > 0);
    return {
      item_batches: active.map((it) => ({
        item_id: it.item_id,
        batch_no: String(it.batch_no ?? it.batch_number ?? ''),
      })),
      items: active,
    };
  }

  return { warehouse_id: whId || undefined, warehouse_name: whName, items };
}

async function confirmSingle(record: OutboundHubOrder): Promise<void> {
  const id = String(record.id);
  if (record.outbound_type === 'outsource_issue') {
    throw new Error('委外发料请在委外工单中操作');
  }
  const detail = await fetchDetail(record);
  if (!detail) {
    throw new Error('加载单据详情失败');
  }
  const payload = buildSimpleConfirmPayload(detail, record);

  if (record.outbound_type === 'production_picking') {
    await warehouseApi.productionPicking.confirm(id, payload);
    return;
  }
  if (record.outbound_type === 'sales_delivery') {
    await warehouseApi.salesDelivery.confirm(id, payload);
    return;
  }
  if (record.outbound_type === 'other_outbound') {
    await warehouseApi.otherOutbound.confirm(id, payload);
    return;
  }
  if (record.outbound_type === 'material_borrow') {
    await warehouseApi.materialBorrow.confirm(id, payload);
    return;
  }
  throw new Error('不支持的单据类型');
}

export async function batchConfirmOutboundDocuments(
  records: OutboundHubOrder[],
): Promise<BatchConfirmResult> {
  const result: BatchConfirmResult = { success: 0, failed: [] };
  for (const record of records) {
    const key = `${record.outbound_type}::${record.id}`;
    if (!isOutboundConfirmable(record)) {
      result.failed.push({ key, message: '当前状态不可确认出库' });
      continue;
    }
    if (record.outbound_type === 'outsource_issue') {
      result.failed.push({ key, message: '委外发料不支持批量确认' });
      continue;
    }
    try {
      await confirmSingle(record);
      result.success += 1;
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } };
      const msg = err?.response?.data?.detail || err?.message || '确认失败';
      result.failed.push({ key, message: typeof msg === 'string' ? msg : '确认失败' });
    }
  }
  return result;
}

export async function withdrawOutboundDocument(record: OutboundHubOrder): Promise<void> {
  const id = String(record.id);
  switch (record.outbound_type) {
    case 'production_picking':
      await warehouseApi.productionPicking.withdraw(id);
      return;
    case 'sales_delivery':
      await warehouseApi.salesDelivery.withdraw(id);
      return;
    case 'other_outbound':
      await warehouseApi.otherOutbound.withdraw(id);
      return;
    case 'material_borrow':
      await warehouseApi.materialBorrow.withdraw(id);
      return;
    default:
      throw new Error('该类型不支持撤回');
  }
}
