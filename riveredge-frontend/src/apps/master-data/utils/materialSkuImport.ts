/**
 * 物料列表：属性 SKU 导入（主编码 + 属性组合 + 启用状态）
 */

import type { TFunction } from 'i18next';

import { parseImportBool, parseVariantAttributesImport } from './parseVariantAttributesImport';
import { resolveFactoryImportHeaderIndexMap } from '../../../utils/spreadsheetImportTemplate';

export interface MaterialSkuImportRow {
  rowNum: number;
  mainCode: string;
  variantAttributes: Record<string, unknown>;
  isActive: boolean;
}

export interface MaterialSkuImportColumnIndex {
  mainCode: number;
  variantAttributes: number;
  isActive: number;
}

export function buildMaterialSkuImportColumnIndex(
  headers: string[],
  importHeaderMap: Record<string, string>,
): MaterialSkuImportColumnIndex {
  const m = resolveFactoryImportHeaderIndexMap(headers, importHeaderMap);
  const idx = (field: string) => m[field] ?? -1;
  return {
    mainCode: idx('mainCode'),
    variantAttributes: idx('variantAttributes'),
    isActive: idx('isActive'),
  };
}

function cell(row: unknown[], index: number): string {
  if (index < 0) return '';
  return String(row[index] ?? '').trim();
}

export function parseMaterialSkuImportRows(
  rows: unknown[][],
  idx: MaterialSkuImportColumnIndex,
  rowOffset = 3,
  t?: TFunction,
): { items: MaterialSkuImportRow[]; errors: Array<{ row: number; message: string }> } {
  const errors: Array<{ row: number; message: string }> = [];
  const items: MaterialSkuImportRow[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + rowOffset;
    const mainCode = cell(row, idx.mainCode);
    const attrsRaw = cell(row, idx.variantAttributes);

    if (!mainCode) {
      errors.push({
        row: rowNum,
        message: t?.('app.master-data.materials.importSku.mainCodeRequired') ?? '主编码不能为空',
      });
      return;
    }
    if (!attrsRaw) {
      errors.push({
        row: rowNum,
        message: t?.('app.master-data.materials.importSku.variantAttrsRequired') ?? '属性组合不能为空',
      });
      return;
    }

    try {
      const variantAttributes = parseVariantAttributesImport(attrsRaw);
      const isActiveRaw = cell(row, idx.isActive);
      const isActive =
        idx.isActive >= 0 ? (isActiveRaw ? parseImportBool(row[idx.isActive]) : true) : true;
      items.push({ rowNum, mainCode, variantAttributes, isActive });
    } catch (e) {
      errors.push({
        row: rowNum,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  return { items, errors };
}
