import type { Material, MaterialUnit, MaterialUnits } from '../apps/master-data/types/material';

export type MaterialScenario = 'purchase' | 'sale' | 'production' | 'inventory';

type MaterialUnitLike = Pick<Material, 'baseUnit' | 'units'> & {
  base_unit?: string;
  units?: MaterialUnits | string | null;
};

const SCENARIO_KEYS: MaterialScenario[] = ['purchase', 'sale', 'production', 'inventory'];

function readBaseUnit(material?: MaterialUnitLike | null): string {
  return String(material?.baseUnit ?? material?.base_unit ?? '').trim();
}

/** 解析物料 units JSON（含历史字符串/纯数组结构） */
export function parseMaterialUnitsConfig(raw: unknown): MaterialUnits | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return undefined;
    try {
      return parseMaterialUnitsConfig(JSON.parse(text));
    } catch {
      return undefined;
    }
  }
  if (Array.isArray(raw)) {
    return { units: raw as MaterialUnit[], scenarios: {} };
  }
  if (typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const list = Array.isArray(obj.units) ? (obj.units as MaterialUnit[]) : [];
  const scenariosRaw = obj.scenarios;
  const scenarios =
    scenariosRaw && typeof scenariosRaw === 'object' && !Array.isArray(scenariosRaw)
      ? (scenariosRaw as NonNullable<MaterialUnits['scenarios']>)
      : {};
  return { units: list, scenarios };
}

function collectAllowedUnits(baseUnit: string, unitsCfg?: MaterialUnits): Set<string> {
  const allowed = new Set<string>();
  if (baseUnit) allowed.add(baseUnit);
  for (const row of unitsCfg?.units ?? []) {
    const name = String(row?.unit ?? '').trim();
    if (name) allowed.add(name);
  }
  return allowed;
}

/**
 * 裁掉已不在「基础单位+辅助单位」集合中的场景映射。
 * 无辅助单位时场景区会隐藏，须清空残留的 production/purchase/sale，否则工单仍读旧吨。
 */
export function pruneMaterialScenarioUnits(
  baseUnit: string,
  unitsCfg?: MaterialUnits | null,
): NonNullable<MaterialUnits['scenarios']> {
  const aux = unitsCfg?.units ?? [];
  if (aux.length === 0) return {};
  const allowed = collectAllowedUnits(String(baseUnit ?? '').trim(), unitsCfg ?? undefined);
  const next: NonNullable<MaterialUnits['scenarios']> = {};
  const scenarios = unitsCfg?.scenarios ?? {};
  for (const key of SCENARIO_KEYS) {
    const raw = scenarios[key];
    if (raw == null) continue;
    const unit = String(raw).trim();
    if (unit && allowed.has(unit)) next[key] = unit;
  }
  return next;
}

export function resolveMaterialScenarioUnit(
  material: MaterialUnitLike | null | undefined,
  scenario: MaterialScenario,
): string {
  const baseUnit = readBaseUnit(material);
  if (scenario === 'inventory') return baseUnit;

  const unitsCfg = parseMaterialUnitsConfig(material?.units);
  const mapped = unitsCfg?.scenarios?.[scenario];
  if (mapped != null && String(mapped).trim()) {
    const unit = String(mapped).trim();
    const aux = unitsCfg?.units ?? [];
    // 无辅助单位时场景映射 UI 不可见，残留 production 不得覆盖基础单位
    if (aux.length === 0) return baseUnit;
    const allowed = collectAllowedUnits(baseUnit, unitsCfg);
    if (allowed.has(unit)) return unit;
    return baseUnit;
  }
  return baseUnit;
}

export function resolveUnitToBaseFactor(
  material: MaterialUnitLike | null | undefined,
  unitName?: string | null,
): number {
  const target = String(unitName ?? '').trim();
  const baseUnit = readBaseUnit(material);
  if (!target || !baseUnit || target === baseUnit) return 1;

  const unitsCfg = parseMaterialUnitsConfig(material?.units);
  const units = unitsCfg?.units ?? [];
  const matched = units.find((u) => String(u.unit ?? '').trim() === target);
  if (!matched) return 1;

  const numerator = Number(matched.numerator ?? 1);
  const denominator = Number(matched.denominator ?? 1);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || numerator <= 0 || denominator <= 0) {
    return 1;
  }
  return numerator / denominator;
}

export function convertToBaseQuantity(
  material: MaterialUnitLike | null | undefined,
  quantity: number,
  fromUnit?: string | null,
): number {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) return qty;
  const unitName = fromUnit ?? resolveMaterialScenarioUnit(material, 'production');
  const factor = resolveUnitToBaseFactor(material, unitName);
  if (factor <= 0) return qty;
  return qty * factor;
}

export function convertFromBaseQuantity(
  material: MaterialUnitLike | null | undefined,
  baseQuantity: number,
  toUnit?: string | null,
): number {
  const qty = Number(baseQuantity);
  if (!Number.isFinite(qty) || qty <= 0) return qty;
  const unitName = toUnit ?? resolveMaterialScenarioUnit(material, 'production');
  const baseUnit = readBaseUnit(material);
  if (!unitName || unitName === baseUnit) return qty;
  const factor = resolveUnitToBaseFactor(material, unitName);
  if (factor <= 0) return qty;
  return qty / factor;
}

/** 切换业务单位时重算数量：newQty = oldQty × (old→base) / (new→base) */
export function convertQuantityBetweenUnits(
  material: MaterialUnitLike | null | undefined,
  quantity: number,
  fromUnit?: string | null,
  toUnit?: string | null,
): number {
  const qty = Number(quantity);
  if (!Number.isFinite(qty)) return qty;
  const from = String(fromUnit ?? '').trim();
  const to = String(toUnit ?? '').trim();
  if (!from || !to || from === to) return qty;
  const baseQty = convertToBaseQuantity(material, qty, from);
  return convertFromBaseQuantity(material, baseQty, to);
}

export function usesProductionDisplayUnit(record: {
  product_unit?: string;
  productUnit?: string;
  base_unit?: string;
  baseUnit?: string;
}): boolean {
  const productUnit = String(record.product_unit ?? record.productUnit ?? '').trim();
  const baseUnit = String(record.base_unit ?? record.baseUnit ?? '').trim();
  return Boolean(productUnit && baseUnit && productUnit !== baseUnit);
}

export function productionFactorFromWorkOrder(record: {
  unit_to_base_factor?: number;
  unitToBaseFactor?: number;
}): number {
  const factor = Number(record.unit_to_base_factor ?? record.unitToBaseFactor);
  return Number.isFinite(factor) && factor > 0 ? factor : 1;
}

export function convertProductionInputToBaseQty(
  quantity: number,
  ctx: {
    unit_to_base_factor?: number;
    unitToBaseFactor?: number;
    product_unit?: string;
    productUnit?: string;
    base_unit?: string;
    baseUnit?: string;
  },
): number {
  const qty = Number(quantity);
  if (!Number.isFinite(qty)) return qty;
  if (!usesProductionDisplayUnit(ctx)) return qty;
  return qty * productionFactorFromWorkOrder(ctx);
}

export function convertBaseQtyToProductionDisplay(
  baseQuantity: number,
  ctx: {
    unit_to_base_factor?: number;
    unitToBaseFactor?: number;
    product_unit?: string;
    productUnit?: string;
    base_unit?: string;
    baseUnit?: string;
  },
): number {
  const qty = Number(baseQuantity);
  if (!Number.isFinite(qty)) return qty;
  if (!usesProductionDisplayUnit(ctx)) return qty;
  const factor = productionFactorFromWorkOrder(ctx);
  return qty / factor;
}

/** 工单表单录入：与列表展示同一口径，并归一化为有限 number（避免 1.6E+2 等科学计数法串） */
export function resolveWorkOrderFormQuantity(
  record: Parameters<typeof formatWorkOrderDisplayQuantity>[0] & {
    quantity?: number | string;
    unit_to_base_factor?: number;
    unitToBaseFactor?: number;
  },
  qtyField: Parameters<typeof formatWorkOrderDisplayQuantity>[1] = 'quantity',
  material?: MaterialUnitLike | null,
): number | undefined {
  if (qtyField === 'quantity' && material) {
    const converted = convertFromBaseQuantity(material, Number(record.quantity) || 0);
    if (Number.isFinite(converted)) return converted;
  }

  if (qtyField !== 'quantity') {
    const { value } = formatWorkOrderDisplayQuantity(record, qtyField);
    return Number.isFinite(value) ? value : undefined;
  }

  const displayRaw = record.display_quantity ?? record.displayQuantity;
  if (displayRaw != null && displayRaw !== '') {
    const display = Number(displayRaw);
    if (Number.isFinite(display)) return display;
  }

  const converted = convertBaseQtyToProductionDisplay(Number(record.quantity) || 0, record);
  return Number.isFinite(converted) ? converted : undefined;
}

export function formatWorkOrderDisplayQuantity(
  record: {
    quantity?: number;
    display_quantity?: number;
    displayQuantity?: number;
    product_unit?: string;
    productUnit?: string;
    base_unit?: string;
    baseUnit?: string;
  },
  qtyField: 'quantity' | 'split_remaining_quantity' | 'completed_quantity' = 'quantity',
): { value: number; unit: string } {
  const productUnit = String(record.product_unit ?? record.productUnit ?? '').trim();
  const baseUnit = String(record.base_unit ?? record.baseUnit ?? '').trim();
  const useProduction = Boolean(productUnit && baseUnit && productUnit !== baseUnit);

  if (qtyField === 'quantity') {
    const display = Number(record.display_quantity ?? record.displayQuantity);
    if (useProduction && Number.isFinite(display)) {
      return { value: display, unit: productUnit };
    }
  }
  if (qtyField === 'split_remaining_quantity') {
    const display = Number(
      (record as Record<string, unknown>).display_split_remaining_quantity ??
        (record as Record<string, unknown>).displaySplitRemainingQuantity,
    );
    if (useProduction && Number.isFinite(display)) {
      return { value: display, unit: productUnit };
    }
  }

  const raw = Number((record as Record<string, unknown>)[qtyField]);
  const unit = useProduction ? productUnit : baseUnit;
  return {
    value: Number.isFinite(raw) ? raw : NaN,
    unit,
  };
}
