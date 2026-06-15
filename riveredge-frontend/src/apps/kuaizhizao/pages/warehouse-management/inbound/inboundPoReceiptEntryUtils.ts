import type { Material } from '../../../../master-data/types/material';
import {
  storageAreaApi,
  storageLocationApi,
} from '../../../../master-data/services/warehouse';
import type { PurchaseOrder, PurchaseOrderItem } from '../../../services/purchase';

export function formatStorageAreaOrLocationLabel(code?: string, name?: string): string {
  const c = (code || '').trim();
  const n = (name || '').trim();
  if (c && n && c === n) return c;
  return [c, n].filter(Boolean).join(' ').trim();
}

export async function fetchStorageLocationsForWarehouse(
  warehouseId: number,
): Promise<{ value: number; label: string; code: string }[]> {
  const saRes = await storageAreaApi.list({
    warehouse_id: warehouseId,
    limit: 500,
    is_active: true,
  } as Parameters<typeof storageAreaApi.list>[0]);
  const areas = (saRes as { items?: { id: number; code?: string; name?: string }[] })?.items ?? [];
  const parts = await Promise.all(
    areas.map(async (a) => {
      const locRes = await storageLocationApi.list({
        storage_area_id: a.id,
        limit: 500,
        is_active: true,
      } as Parameters<typeof storageLocationApi.list>[0]);
      const locs = (locRes as { items?: { id: number; code?: string; name?: string }[] })?.items ?? [];
      const areaLabel = formatStorageAreaOrLocationLabel(a.code, a.name) || `库区${a.id}`;
      return locs.map((l) => {
        const locLabel = formatStorageAreaOrLocationLabel(l.code, l.name) || String(l.id);
        return {
          value: l.id,
          label: `${areaLabel} - ${locLabel}`,
          code: String(l.code || ''),
        };
      });
    }),
  );
  return parts.flat().sort((a, b) => a.label.localeCompare(b.label));
}

export function normalizePurchaseOrderItem(raw: Record<string, unknown>): PurchaseOrderItem {
  return {
    ...(raw as PurchaseOrderItem),
    id: Number(raw.id) || undefined,
    material_id: Number(raw.material_id ?? raw.materialId) || undefined,
    material_code: String(raw.material_code ?? raw.materialCode ?? '').trim(),
    material_name: String(raw.material_name ?? raw.materialName ?? '').trim(),
    material_spec: String(raw.material_spec ?? raw.materialSpec ?? '').trim() || undefined,
    ordered_quantity: Number(raw.ordered_quantity ?? raw.orderedQuantity ?? 0),
    received_quantity: Number(raw.received_quantity ?? raw.receivedQuantity ?? 0),
    outstanding_quantity: Number(raw.outstanding_quantity ?? raw.outstandingQuantity ?? 0),
    unit: String(raw.unit ?? raw.material_unit ?? raw.materialUnit ?? '').trim() || undefined,
  };
}

export function normalizePurchaseOrderDetail(detail: PurchaseOrder): PurchaseOrder {
  const raw = detail as PurchaseOrder & Record<string, unknown>;
  return {
    ...detail,
    order_code: String(detail.order_code ?? raw.orderCode ?? ''),
    supplier_name: String(detail.supplier_name ?? raw.supplierName ?? ''),
    buyer_name: String(detail.buyer_name ?? raw.buyerName ?? ''),
    supplier_contact: String(detail.supplier_contact ?? raw.supplierContact ?? ''),
    supplier_phone: String(detail.supplier_phone ?? raw.supplierPhone ?? ''),
    currency: String(detail.currency ?? raw.currency ?? ''),
    order_date: detail.order_date ?? (raw.orderDate as string | undefined),
    delivery_date: detail.delivery_date ?? (raw.deliveryDate as string | undefined),
    items: (detail.items || []).map((it) =>
      normalizePurchaseOrderItem(it as unknown as Record<string, unknown>),
    ),
  };
}

export function enrichPurchaseOrderItemsMaterial(
  items: PurchaseOrderItem[],
  materialById: Map<string, Material>,
): PurchaseOrderItem[] {
  return items.map((it) => {
    const m = it.material_id ? materialById.get(String(it.material_id)) : undefined;
    return {
      ...it,
      material_code: it.material_code || m?.mainCode || m?.code || '',
      material_name: it.material_name || m?.name || '',
      unit: it.unit || m?.baseUnit || it.unit,
    };
  });
}

export function getOutstandingPoItems(order: PurchaseOrder | null): PurchaseOrderItem[] {
  return (order?.items || []).filter((it) => Number(it.outstanding_quantity ?? 0) > 0);
}
