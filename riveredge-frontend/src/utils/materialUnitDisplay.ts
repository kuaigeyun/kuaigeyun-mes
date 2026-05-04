/**
 * 物料单位字典 code → 展示标签（与 MaterialUnitSelect 共用数据来源与缓存）
 */

import { getDataDictionaryByCode, getDictionaryItemList } from '../services/dataDictionary';

export function normUnitKey(s: string): string {
  return String(s).trim().toLowerCase();
}

/** 单位 code / 旧数据里存的展示文案 -> 字典标签（含小写键，兼容大小写不一致） */
export function buildUnitDisplayMap(items: { value: string; label: string }[]): Record<string, string> {
  const rec: Record<string, string> = {};
  for (const i of items) {
    const v = String(i.value).trim();
    const l = String(i.label).trim();
    const label = i.label;
    if (v) {
      rec[v] = label;
      rec[normUnitKey(v)] = label;
    }
    if (l) {
      rec[l] = label;
      rec[normUnitKey(l)] = label;
    }
  }
  return rec;
}

async function loadMaterialUnitDisplayMap(): Promise<Record<string, string>> {
  for (const code of ['MATERIAL_UNIT', 'unit'] as const) {
    try {
      const dictionary = await getDataDictionaryByCode(code);
      const items = await getDictionaryItemList(dictionary.uuid, true);
      return buildUnitDisplayMap(items);
    } catch {
      /* try next code */
    }
  }
  return {};
}

/** 全应用共享一次 in-flight 请求，避免表格每行各打一遍字典接口 */
let materialUnitDisplayMapPromise: Promise<Record<string, string>> | null = null;

export function getMaterialUnitDisplayMapShared(): Promise<Record<string, string>> {
  if (!materialUnitDisplayMapPromise) {
    materialUnitDisplayMapPromise = loadMaterialUnitDisplayMap().catch(() => ({}));
  }
  return materialUnitDisplayMapPromise;
}

export function resolveMaterialUnitLabel(raw: unknown, map: Record<string, string>): string {
  const t = String(raw ?? '').trim();
  if (!t) return '';
  return map[t] ?? map[normUnitKey(t)] ?? t;
}
