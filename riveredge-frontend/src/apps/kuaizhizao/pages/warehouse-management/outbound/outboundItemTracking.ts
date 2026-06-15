/** 出库明细 — 库位/批号/序列号行字段与物料属性同步 */

export {
  INBOUND_ITEM_TRACKING_FIELDS as OUTBOUND_ITEM_TRACKING_FIELDS,
  type InboundMaterialTrackingMeta as OutboundMaterialTrackingMeta,
  readMaterialTrackingFromPicker,
  applyMaterialTrackingToFormRow,
  pickInboundItemTrackingPayload as pickOutboundItemTrackingPayload,
  enrichInboundFormItemsTracking as enrichOutboundFormItemsTracking,
  type ConfirmPreviewMaterialMeta,
  loadConfirmPreviewMaterialMeta,
} from '../inbound/inboundItemTracking';

import type { OutboundIssueType } from './outboundHubTypes';

export type OutboundConfirmationItemPayload = {
  item_id: number;
  warehouse_id?: number;
  location_id?: number;
  location_code?: string;
  batch_number?: string;
  batch_no?: string;
  serial_numbers?: string[];
};

export type OutboundConfirmationPayload = {
  warehouse_id?: number;
  warehouse_name?: string;
  items?: OutboundConfirmationItemPayload[];
  item_batches?: { item_id: number; batch_no: string }[];
};

export function buildOutboundConfirmPayloadFromForm(
  outboundType: OutboundIssueType,
  lines: Record<string, unknown>[],
  formValues: Record<string, unknown>,
  warehouseId?: number,
  warehouseName?: string,
): OutboundConfirmationPayload {
  const items: OutboundConfirmationItemPayload[] = lines
    .map((it) => {
      const lineId = Number(it.id);
      if (!Number.isFinite(lineId) || lineId <= 0) return null;
      const batchRaw = formValues[`batch_${lineId}`] ?? it.batch_number;
      const batch = String(batchRaw ?? '').trim();
      const locId = formValues[`location_${lineId}`];
      const locCode = formValues[`location_code_${lineId}`] ?? it.location_code;
      const serials = formValues[`serial_${lineId}`] ?? it.serial_numbers;
      return {
        item_id: lineId,
        warehouse_id: warehouseId,
        location_id: locId != null && locId !== '' ? Number(locId) : undefined,
        location_code: locCode != null && String(locCode).trim() ? String(locCode).trim() : undefined,
        batch_number: batch || undefined,
        batch_no: batch || undefined,
        serial_numbers: Array.isArray(serials) ? (serials as string[]) : undefined,
      };
    })
    .filter(Boolean) as OutboundConfirmationItemPayload[];

  if (outboundType === 'sales_delivery') {
    return {
      item_batches: items.map((it) => ({
        item_id: it.item_id,
        batch_no: String(it.batch_no ?? it.batch_number ?? ''),
      })),
      items,
    };
  }

  return {
    warehouse_id: warehouseId,
    warehouse_name: warehouseName,
    items,
  };
}
