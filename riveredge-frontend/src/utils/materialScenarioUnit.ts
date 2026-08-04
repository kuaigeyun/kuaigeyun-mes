import type { Material, MaterialUnits } from '../apps/master-data/types/material';

export type MaterialScenario = 'purchase' | 'sale' | 'production' | 'inventory';

type MaterialUnitLike = Pick<Material, 'baseUnit' | 'units'> & {
  base_unit?: string;
  units?: MaterialUnits;
};

function readBaseUnit(material?: MaterialUnitLike | null): string {
  return String(material?.baseUnit ?? material?.base_unit ?? '').trim();
}

export function resolveMaterialScenarioUnit(
  material: MaterialUnitLike | null | undefined,
  scenario: MaterialScenario,
): string {
  const baseUnit = readBaseUnit(material);
  if (scenario === 'inventory') return baseUnit;
  const mapped = material?.units?.scenarios?.[scenario];
  if (mapped != null && String(mapped).trim()) {
    return String(mapped).trim();
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

  const units = material?.units?.units ?? [];
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
): number | undefined {
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
