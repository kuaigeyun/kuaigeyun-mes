/** 入库明细 — 库位/批号/序列号行字段与物料属性同步 */

import { materialApi } from '../../../../master-data/services/material';
import type { Material, MaterialListResponse } from '../../../../master-data/types/material';

function firstMaterialFromListResponse(
  res: MaterialListResponse | Material[] | null | undefined,
): Material | null {
  if (!res) return null;
  if (Array.isArray(res)) return res[0] ?? null;
  return res.items?.[0] ?? null;
}

export const INBOUND_ITEM_TRACKING_FIELDS = {
  material_uuid: undefined as string | undefined,
  batch_managed: false,
  serial_managed: false,
  batch_rule_id: undefined as number | undefined,
  default_batch_rule_id: undefined as number | undefined,
  serial_rule_id: undefined as number | undefined,
  default_serial_rule_id: undefined as number | undefined,
  location_code: undefined as string | undefined,
  batch_number: undefined as string | undefined,
  serial_numbers: undefined as string[] | undefined,
};

export type InboundMaterialTrackingMeta = {
  uuid: string;
  batchManaged: boolean;
  serialManaged: boolean;
  defaultBatchRuleId: number | null;
  defaultSerialRuleId: number | null;
};

export function readMaterialTrackingFromPicker(material: Record<string, unknown> | undefined): InboundMaterialTrackingMeta | null {
  if (!material) return null;
  const uuid = String(material.uuid ?? material.UUID ?? '').trim();
  if (!uuid) return null;
  const defaultBatchRuleId = material.defaultBatchRuleId ?? material.default_batch_rule_id;
  const defaultSerialRuleId = material.defaultSerialRuleId ?? material.default_serial_rule_id;
  return {
    uuid,
    batchManaged: !!(material.batchManaged ?? material.batch_managed),
    serialManaged: !!(material.serialManaged ?? material.serial_managed),
    defaultBatchRuleId:
      defaultBatchRuleId != null && Number(defaultBatchRuleId) > 0 ? Number(defaultBatchRuleId) : null,
    defaultSerialRuleId:
      defaultSerialRuleId != null && Number(defaultSerialRuleId) > 0 ? Number(defaultSerialRuleId) : null,
  };
}

export function applyMaterialTrackingToFormRow(
  setFieldValue: (name: (string | number)[], value: unknown) => void,
  listName: string,
  index: number,
  meta: InboundMaterialTrackingMeta,
): void {
  setFieldValue([listName, index, 'material_uuid'], meta.uuid);
  setFieldValue([listName, index, 'batch_managed'], meta.batchManaged);
  setFieldValue([listName, index, 'serial_managed'], meta.serialManaged);
  setFieldValue([listName, index, 'default_batch_rule_id'], meta.defaultBatchRuleId ?? undefined);
  setFieldValue([listName, index, 'default_serial_rule_id'], meta.defaultSerialRuleId ?? undefined);
}

export function pickInboundItemTrackingPayload(it: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const loc = String(it.location_code ?? '').trim();
  if (loc) out.location_code = loc;
  const batch = String(it.batch_number ?? '').trim();
  if (batch) out.batch_number = batch;
  if (Array.isArray(it.serial_numbers) && it.serial_numbers.length > 0) {
    out.serial_numbers = it.serial_numbers;
  }
  return out;
}

/** 为已载入明细行补全批号/序列号管理标记（按物料编码查主数据） */
export async function enrichInboundFormItemsTracking(
  items: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  if (!items.length) return items;
  const codes = [...new Set(items.map((it) => String(it.material_code ?? '').trim()).filter(Boolean))];
  const metaByCode = new Map<string, InboundMaterialTrackingMeta>();
  await Promise.all(
    codes.map(async (code) => {
      try {
        const list = await materialApi.list({ code, limit: 1 });
        const m = firstMaterialFromListResponse(list);
        const fromPicker = readMaterialTrackingFromPicker(m as Record<string, unknown> | undefined);
        if (!fromPicker) return;
        if (m?.uuid) {
          try {
            const full = await materialApi.get(m.uuid);
            metaByCode.set(code, {
              uuid: m.uuid,
              batchManaged: !!full.batchManaged,
              serialManaged: !!full.serialManaged,
              defaultBatchRuleId:
                full.defaultBatchRuleId != null && Number(full.defaultBatchRuleId) > 0
                  ? Number(full.defaultBatchRuleId)
                  : null,
              defaultSerialRuleId:
                full.defaultSerialRuleId != null && Number(full.defaultSerialRuleId) > 0
                  ? Number(full.defaultSerialRuleId)
                  : null,
            });
            return;
          } catch {
            /* 使用列表字段 */
          }
        }
        metaByCode.set(code, fromPicker);
      } catch {
        /* 跳过 */
      }
    }),
  );
  return items.map((row) => {
    const code = String(row.material_code ?? '').trim();
    const meta = metaByCode.get(code);
    if (!meta) return row;
    return {
      ...row,
      material_uuid: meta.uuid,
      batch_managed: meta.batchManaged,
      serial_managed: meta.serialManaged,
      default_batch_rule_id: meta.defaultBatchRuleId ?? undefined,
      default_serial_rule_id: meta.defaultSerialRuleId ?? undefined,
    };
  });
}

export type ConfirmPreviewMaterialMeta = {
  batchManaged: boolean;
  serialManaged: boolean;
  materialUuid: string;
  defaultSerialRuleId: number | null;
};

/** 确认预览：按明细行加载物料批号/序列号管理属性 */
export async function loadConfirmPreviewMaterialMeta(
  items: { id?: number; material_code?: string; material_id?: number; serial_numbers?: string[] | null }[],
  materialById?: Map<string, Material>,
): Promise<Record<number, ConfirmPreviewMaterialMeta>> {
  const out: Record<number, ConfirmPreviewMaterialMeta> = {};
  const rows = items.filter((it) => it?.id != null);
  await Promise.all(
    rows.map(async (it) => {
      const id = Number(it.id);
      try {
        let m: Material | null = null;
        const materialId = it.material_id;
        if (materialId != null && materialById?.has(String(materialId))) {
          m = materialById.get(String(materialId)) ?? null;
        }
        if (!m) {
          const code = String(it.material_code || '').trim();
          if (!code) return;
          const res = await materialApi.list({ code, limit: 1 });
          m = firstMaterialFromListResponse(res);
        }
        const uuid = String(m?.uuid ?? '').trim();
        if (!uuid) return;
        let batchManaged = !!(m?.batchManaged ?? (m as any)?.batch_managed);
        let serialManaged = !!(m?.serialManaged ?? (m as any)?.serial_managed);
        let defaultSerialRuleId =
          (m?.defaultSerialRuleId ?? (m as any)?.default_serial_rule_id ?? null) as number | null;
        try {
          const full = await materialApi.get(uuid);
          batchManaged = !!full.batchManaged;
          serialManaged = !!full.serialManaged;
          defaultSerialRuleId = full.defaultSerialRuleId ?? null;
        } catch {
          /* 使用列表/预取字段 */
        }
        out[id] = {
          batchManaged,
          serialManaged,
          materialUuid: uuid,
          defaultSerialRuleId:
            defaultSerialRuleId != null && Number(defaultSerialRuleId) > 0 ? Number(defaultSerialRuleId) : null,
        };
      } catch {
        /* 跳过 */
      }
    }),
  );
  return out;
}
