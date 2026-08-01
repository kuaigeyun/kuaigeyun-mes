/**
 * 物料列表：默认值导入（按主编码合并 defaults）
 */

import type { TFunction } from 'i18next';

import type { MaterialBulkDefaultsPatchPayload } from '../types/material';
import type { Warehouse } from '../types/warehouse';
import { resolveFactoryImportHeaderIndexMap } from '../../../utils/spreadsheetImportTemplate';

export interface MaterialDefaultsImportRow {
  rowNum: number;
  mainCode: string;
  patch: Omit<MaterialBulkDefaultsPatchPayload, 'material_uuids'>;
}

export interface MaterialDefaultsImportColumnIndex {
  mainCode: number;
  defaultTaxRate: number;
  defaultWarehouseCodes: number;
  safetyStock: number;
  maxStock: number;
  defaultSalePrice: number;
  defaultLocation: number;
}

export function buildMaterialDefaultsImportColumnIndex(
  headers: string[],
  importHeaderMap: Record<string, string>,
): MaterialDefaultsImportColumnIndex {
  const m = resolveFactoryImportHeaderIndexMap(headers, importHeaderMap);
  const idx = (field: string) => m[field] ?? -1;
  return {
    mainCode: idx('mainCode'),
    defaultTaxRate: idx('defaultTaxRate'),
    defaultWarehouseCodes: idx('defaultWarehouseCodes'),
    safetyStock: idx('safetyStock'),
    maxStock: idx('maxStock'),
    defaultSalePrice: idx('defaultSalePrice'),
    defaultLocation: idx('defaultLocation'),
  };
}

function cell(row: unknown[], index: number): string {
  if (index < 0) return '';
  return String(row[index] ?? '').trim();
}

function parseOptionalNumber(raw: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`数值无效：${raw}`);
  }
  return n;
}

function parseOptionalIntTaxRate(raw: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100 || !Number.isInteger(n)) {
    throw new Error(`默认税率须为 0-100 的整数：${raw}`);
  }
  return n;
}

export function resolveWarehouseIdsByCodes(
  raw: string,
  warehouses: Warehouse[],
): number[] | undefined {
  const text = raw.trim();
  if (!text) return undefined;
  if (text === '-' || text === '清除' || text.toLowerCase() === 'clear') {
    return [];
  }
  const codes = text
    .split(/[;；,，]/)
    .map((c) => c.trim())
    .filter(Boolean);
  const ids: number[] = [];
  for (const code of codes) {
    const wh = warehouses.find((w) => (w.code || '').trim() === code);
    if (!wh) {
      throw new Error(`未找到仓库编码：${code}`);
    }
    ids.push(wh.id);
  }
  return ids;
}

export function parseMaterialDefaultsImportRows(
  rows: unknown[][],
  idx: MaterialDefaultsImportColumnIndex,
  warehouses: Warehouse[],
  rowOffset = 3,
  t?: TFunction,
): { items: MaterialDefaultsImportRow[]; errors: Array<{ row: number; message: string }> } {
  const errors: Array<{ row: number; message: string }> = [];
  const items: MaterialDefaultsImportRow[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + rowOffset;
    const mainCode = cell(row, idx.mainCode);
    if (!mainCode) {
      errors.push({
        row: rowNum,
        message: t?.('app.master-data.materials.importDefaults.mainCodeRequired') ?? '主编码不能为空',
      });
      return;
    }

    try {
      const patch: Omit<MaterialBulkDefaultsPatchPayload, 'material_uuids'> = {};
      const taxRaw = cell(row, idx.defaultTaxRate);
      const warehouseRaw = cell(row, idx.defaultWarehouseCodes);
      const safetyRaw = cell(row, idx.safetyStock);
      const maxRaw = cell(row, idx.maxStock);
      const salePriceRaw = cell(row, idx.defaultSalePrice);
      const locationRaw = cell(row, idx.defaultLocation);

      if (taxRaw) patch.defaultTaxRate = parseOptionalIntTaxRate(taxRaw);
      if (warehouseRaw) patch.defaultWarehouseIds = resolveWarehouseIdsByCodes(warehouseRaw, warehouses);
      if (safetyRaw) patch.safetyStock = parseOptionalNumber(safetyRaw);
      if (maxRaw) patch.maxStock = parseOptionalNumber(maxRaw);
      if (salePriceRaw) patch.defaultSalePrice = parseOptionalNumber(salePriceRaw);
      if (locationRaw) patch.defaultLocation = locationRaw;

      if (Object.keys(patch).length === 0) {
        errors.push({
          row: rowNum,
          message:
            t?.('app.master-data.materials.importDefaults.fieldRequired') ??
            '至少填写一项默认值字段',
        });
        return;
      }

      items.push({ rowNum, mainCode, patch });
    } catch (e) {
      errors.push({
        row: rowNum,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  return { items, errors };
}
