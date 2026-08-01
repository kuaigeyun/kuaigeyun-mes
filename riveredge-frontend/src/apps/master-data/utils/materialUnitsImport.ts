/**
 * 物料列表：多单位导入
 */

import type { TFunction } from 'i18next';

import type { MaterialUnit, MaterialUnits } from '../types/material';
import { resolveFactoryImportHeaderIndexMap } from '../../../utils/spreadsheetImportTemplate';

export interface MaterialUnitsImportRow {
  rowNum: number;
  mainCode: string;
  unit: string;
  numerator: number;
  denominator: number;
  scenarios: Partial<MaterialUnits['scenarios']>;
}

export interface MaterialUnitsImportColumnIndex {
  mainCode: number;
  unit: number;
  numerator: number;
  denominator: number;
  purchaseUnit: number;
  saleUnit: number;
  productionUnit: number;
  inventoryUnit: number;
}

export interface MaterialUnitsImportGroup {
  mainCode: string;
  rowNums: number[];
  units: MaterialUnit[];
  scenarios: NonNullable<MaterialUnits['scenarios']>;
}

export function buildMaterialUnitsImportColumnIndex(
  headers: string[],
  importHeaderMap: Record<string, string>,
): MaterialUnitsImportColumnIndex {
  const m = resolveFactoryImportHeaderIndexMap(headers, importHeaderMap);
  const idx = (field: string) => m[field] ?? -1;
  return {
    mainCode: idx('mainCode'),
    unit: idx('unit'),
    numerator: idx('numerator'),
    denominator: idx('denominator'),
    purchaseUnit: idx('purchaseUnit'),
    saleUnit: idx('saleUnit'),
    productionUnit: idx('productionUnit'),
    inventoryUnit: idx('inventoryUnit'),
  };
}

function cell(row: unknown[], index: number): string {
  if (index < 0) return '';
  return String(row[index] ?? '').trim();
}

function parsePositiveInt(raw: string, fieldLabel: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new Error(`${fieldLabel}须为正整数`);
  }
  return n;
}

export function parseMaterialUnitsImportRows(
  rows: unknown[][],
  idx: MaterialUnitsImportColumnIndex,
  rowOffset = 3,
  t?: TFunction,
): { groups: MaterialUnitsImportGroup[]; errors: Array<{ row: number; message: string }> } {
  const errors: Array<{ row: number; message: string }> = [];
  const parsedRows: MaterialUnitsImportRow[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + rowOffset;
    const mainCode = cell(row, idx.mainCode);
    const unit = cell(row, idx.unit);
    const numeratorRaw = cell(row, idx.numerator);
    const denominatorRaw = cell(row, idx.denominator);

    if (!mainCode) {
      errors.push({
        row: rowNum,
        message: t?.('app.master-data.materials.importUnits.mainCodeRequired') ?? '主编码不能为空',
      });
      return;
    }
    if (!unit) {
      errors.push({
        row: rowNum,
        message: t?.('app.master-data.materials.importUnits.unitRequired') ?? '辅助单位不能为空',
      });
      return;
    }
    if (!numeratorRaw || !denominatorRaw) {
      errors.push({
        row: rowNum,
        message: t?.('app.master-data.materials.importUnits.conversionRequired') ?? '换算分子与分母不能为空',
      });
      return;
    }

    try {
      const numerator = parsePositiveInt(
        numeratorRaw,
        t?.('app.master-data.materials.importUnits.numerator') ?? '换算分子',
      );
      const denominator = parsePositiveInt(
        denominatorRaw,
        t?.('app.master-data.materials.importUnits.denominator') ?? '换算分母',
      );
      const scenarios: Partial<MaterialUnits['scenarios']> = {};
      const purchaseUnit = cell(row, idx.purchaseUnit);
      const saleUnit = cell(row, idx.saleUnit);
      const productionUnit = cell(row, idx.productionUnit);
      const inventoryUnit = cell(row, idx.inventoryUnit);
      if (purchaseUnit) scenarios.purchase = purchaseUnit;
      if (saleUnit) scenarios.sale = saleUnit;
      if (productionUnit) scenarios.production = productionUnit;
      if (inventoryUnit) scenarios.inventory = inventoryUnit;

      parsedRows.push({
        rowNum,
        mainCode,
        unit,
        numerator,
        denominator,
        scenarios,
      });
    } catch (e) {
      errors.push({
        row: rowNum,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  const groupMap = new Map<string, MaterialUnitsImportGroup>();
  for (const row of parsedRows) {
    const key = row.mainCode.trim().toUpperCase();
    let group = groupMap.get(key);
    if (!group) {
      group = { mainCode: row.mainCode.trim(), rowNums: [], units: [], scenarios: {} };
      groupMap.set(key, group);
    }
    group.rowNums.push(row.rowNum);
    const existingUnitIdx = group.units.findIndex((u) => u.unit === row.unit);
    const unitEntry: MaterialUnit = {
      unit: row.unit,
      numerator: row.numerator,
      denominator: row.denominator,
    };
    if (existingUnitIdx >= 0) {
      group.units[existingUnitIdx] = unitEntry;
    } else {
      group.units.push(unitEntry);
    }
    group.scenarios = { ...group.scenarios, ...row.scenarios };
  }

  return { groups: [...groupMap.values()], errors };
}

export function mergeMaterialUnits(
  existing: MaterialUnits | undefined,
  incoming: MaterialUnitsImportGroup,
): MaterialUnits {
  const baseUnits = [...(existing?.units ?? [])];
  for (const u of incoming.units) {
    const idx = baseUnits.findIndex((x) => x.unit === u.unit);
    if (idx >= 0) {
      baseUnits[idx] = u;
    } else {
      baseUnits.push(u);
    }
  }
  return {
    units: baseUnits,
    scenarios: { ...(existing?.scenarios ?? {}), ...incoming.scenarios },
  };
}
