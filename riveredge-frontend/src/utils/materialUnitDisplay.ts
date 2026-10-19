/**
 * 数量 + 单位展示。
 *
 * 契约：业务字段存的就是单位名称（单位目录 name 为唯一真源）。
 * 禁止 code→name 对照表 / 读侧翻译。
 */

import { formatQuantity } from './format';

/** @deprecated 仅保留导出给旧 import；单位真源已是名称，勿再做对照 */
export function normUnitKey(s: string): string {
  return String(s).trim().toLowerCase();
}

/** 数量后直接拼业务字段中的单位文案（已是名称） */
export function formatQuantityWithUnit(quantity: unknown, unit: unknown): string {
  const qtyStr = formatQuantity(quantity);
  if (qtyStr === '—') return qtyStr;
  const unitRaw = String(unit ?? '').trim();
  if (!unitRaw) return qtyStr;
  return `${qtyStr} ${unitRaw}`;
}

/**
 * @deprecated 禁止再构建/使用 code→name 映射。保留空实现以免旧调用编译失败，恒返回空对象。
 */
export function buildUnitDisplayMap(
  _items: { value: string; label: string }[],
): Record<string, string> {
  return {};
}

/** @deprecated 见上；不再加载对照表 */
export function getMaterialUnitDisplayMapShared(): Promise<Record<string, string>> {
  return Promise.resolve({});
}

/** @deprecated */
export function invalidateMaterialUnitDisplayMapCache(): void {}

/** @deprecated 直接展示业务字段，不做翻译 */
export function resolveMaterialUnitLabel(raw: unknown, _map?: Record<string, string>): string {
  return String(raw ?? '').trim();
}

/** @deprecated */
export function peekMaterialUnitDisplayMap(): Record<string, string> {
  return {};
}

/** @deprecated */
export function subscribeMaterialUnitDisplayMap(_listener: () => void): () => void {
  return () => {};
}

/** @deprecated */
export function useMaterialUnitDisplayMap(
  unitLabelMapProp?: Record<string, string>,
): Record<string, string> {
  return unitLabelMapProp ?? {};
}
