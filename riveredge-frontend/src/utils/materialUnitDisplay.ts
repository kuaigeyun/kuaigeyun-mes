/**
 * 物料单位 code → 展示标签（单位主数据为唯一真源）
 */

import { materialUnitApi } from '../apps/master-data/services/material-unit';
import { formatQuantity } from './format';

export function normUnitKey(s: string): string {
  return String(s).trim().toLowerCase();
}

/** 单位 code / 旧数据里存的展示文案 -> 名称（含小写键，兼容大小写不一致） */
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
  const res = await materialUnitApi.list({ skip: 0, limit: 500, is_active: true });
  return buildUnitDisplayMap(
    (res.items ?? []).map((u) => ({
      value: u.code,
      label: u.name || u.code,
    })),
  );
}

/** 全应用共享一次 in-flight 请求，避免表格每行各打一遍接口 */
let materialUnitDisplayMapPromise: Promise<Record<string, string>> | null = null;

export function getMaterialUnitDisplayMapShared(): Promise<Record<string, string>> {
  if (!materialUnitDisplayMapPromise) {
    materialUnitDisplayMapPromise = loadMaterialUnitDisplayMap().catch((error) => {
      console.error('加载单位主数据展示映射失败:', error);
      materialUnitDisplayMapPromise = null;
      return {};
    });
  }
  return materialUnitDisplayMapPromise;
}

/** 单位目录变更后清空缓存（单位管理页保存/加载预设后调用） */
export function invalidateMaterialUnitDisplayMapCache(): void {
  materialUnitDisplayMapPromise = null;
}

export function resolveMaterialUnitLabel(raw: unknown, map: Record<string, string>): string {
  const t = String(raw ?? '').trim();
  if (!t) return '';
  return map[t] ?? map[normUnitKey(t)] ?? t;
}

/** 数量 + 单位文案（主数据标签优先，否则 raw code） */
export function formatQuantityWithUnit(
  quantity: unknown,
  unitCode: unknown,
  unitLabelMap?: Record<string, string>,
): string {
  const qtyStr = formatQuantity(quantity);
  if (qtyStr === '—') return qtyStr;
  const unitRaw = String(unitCode ?? '').trim();
  if (!unitRaw) return qtyStr;
  const unitLabel = unitLabelMap
    ? resolveMaterialUnitLabel(unitRaw, unitLabelMap)
    : unitRaw;
  return `${qtyStr} ${unitLabel}`;
}
