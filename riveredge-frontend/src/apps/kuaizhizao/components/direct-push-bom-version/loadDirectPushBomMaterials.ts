import { bomApi } from '../../../master-data/services/material';
import type { DirectPushBomMaterialRow } from './DirectPushBomVersionFields';

export async function loadDirectPushBomMaterials(
  items: Array<{ material_id?: number; material_code?: string; material_name?: string }>,
): Promise<DirectPushBomMaterialRow[]> {
  const seen = new Set<number>();
  const materials: DirectPushBomMaterialRow[] = [];
  for (const row of items) {
    const mid = Number(row.material_id);
    if (!Number.isFinite(mid) || mid <= 0 || seen.has(mid)) continue;
    seen.add(mid);
    materials.push({
      material_id: mid,
      material_code: String(row.material_code || ''),
      material_name: String(row.material_name || ''),
    });
  }
  return Promise.all(
    materials.map(async m => {
      try {
        const boms = await bomApi.getByMaterial(m.material_id, undefined, true);
        const versionMap = new Map<string, boolean>();
        for (const b of boms) {
          if (b.version) {
            versionMap.set(b.version, !!b.isDefault || !!versionMap.get(b.version));
          }
        }
        const bomVersions = Array.from(versionMap.entries()).map(([version, isDefault]) => ({
          version,
          isDefault: !!isDefault,
        }));
        return { ...m, bomVersions };
      } catch {
        return { ...m, bomVersions: [] };
      }
    }),
  );
}

export function buildDirectPushBomPayload(params: {
  bom_version?: string;
  material_bom_versions?: Record<number, string>;
}): { bom_version?: string; material_bom_versions?: Record<number, string> } | undefined {
  const mbv = params.material_bom_versions || {};
  const filtered: Record<number, string> = {};
  for (const [k, v] of Object.entries(mbv)) {
    const s = String(v || '').trim();
    if (s) filtered[Number(k)] = s;
  }
  const global = String(params.bom_version || '').trim();
  if (!global && Object.keys(filtered).length === 0) {
    return undefined;
  }
  const out: { bom_version?: string; material_bom_versions?: Record<number, string> } = {};
  if (global) out.bom_version = global;
  if (Object.keys(filtered).length > 0) {
    out.material_bom_versions = filtered;
  }
  if (Object.keys(filtered).length > 0 && global) {
    delete out.bom_version;
  }
  return out;
}

export function defaultMaterialBomVersionsFromRows(
  rows: DirectPushBomMaterialRow[],
): Record<number, string> {
  const defaults: Record<number, string> = {};
  for (const m of rows) {
    const def = m.bomVersions?.find(v => v.isDefault)?.version ?? m.bomVersions?.[0]?.version;
    if (def) defaults[m.material_id] = def;
  }
  return defaults;
}
