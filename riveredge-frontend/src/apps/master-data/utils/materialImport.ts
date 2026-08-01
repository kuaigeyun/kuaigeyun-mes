/**
 * 物料 Excel 导入：仅主物料（属性 SKU 请在物料详情「属性组合」中导入）
 */

import type { TFunction } from 'i18next';

import type { MaterialCreate } from '../types/material';
import { parseImportBool } from './parseVariantAttributesImport';
import { parseMaterialSourceTypeImport } from './materialSourceType';
import { resolveFactoryImportHeaderIndexMap } from '../../../utils/spreadsheetImportTemplate';

export interface MaterialMasterImportItem {
  kind: 'master';
  rowNum: number;
  data: MaterialCreate;
}

export type MaterialImportItem = MaterialMasterImportItem;

export interface MaterialImportColumnIndex {
  code: number;
  name: number;
  unit: number;
  spec: number;
  type: number;
  group: number;
  variantManaged: number;
  isActive: number;
  batchManaged: number;
  serialManaged: number;
}

/** 旧模板遗留列名：物料导入不再支持，检测到时明确报错 */
const REMOVED_SKU_IMPORT_HEADERS = new Set([
  '行类型',
  '主编码',
  '属性组合',
  'row type',
  'rowtype',
  'master code',
  'mastercode',
  'variant attributes',
  'variantattributes',
]);

export function materialImportHasRemovedSkuColumns(headers: string[]): string[] {
  return headers
    .map((h) => String(h || '').trim())
    .filter((h) => {
      if (!h) return false;
      return REMOVED_SKU_IMPORT_HEADERS.has(h) || REMOVED_SKU_IMPORT_HEADERS.has(h.toLowerCase());
    });
}

export function buildMaterialImportColumnIndex(
  headers: string[],
  importHeaderMap: Record<string, string>,
): MaterialImportColumnIndex {
  const m = resolveFactoryImportHeaderIndexMap(headers, importHeaderMap);
  const idx = (field: string) => m[field] ?? -1;
  return {
    code: idx('mainCode'),
    name: idx('name'),
    unit: idx('baseUnit'),
    spec: idx('specification'),
    type: idx('sourceType'),
    group: idx('groupCode'),
    variantManaged: idx('variantManaged'),
    isActive: idx('isActive'),
    batchManaged: idx('batchManaged'),
    serialManaged: idx('serialManaged'),
  };
}

function cell(row: unknown[], index: number): string {
  if (index < 0) return '';
  return String(row[index] ?? '').trim();
}

export function parseMaterialImportRows(
  rows: unknown[][],
  idx: MaterialImportColumnIndex,
  resolveGroupId: (groupCode: string) => number | undefined,
  rowOffset = 3,
  t?: TFunction,
): { items: MaterialImportItem[]; errors: Array<{ row: number; message: string }> } {
  const errors: Array<{ row: number; message: string }> = [];
  const items: MaterialImportItem[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + rowOffset;
    const name = cell(row, idx.name);
    const unit = cell(row, idx.unit);
    if (!name) {
      errors.push({ row: rowNum, message: '物料名称不能为空' });
      return;
    }
    if (!unit) {
      errors.push({ row: rowNum, message: '基础单位不能为空' });
      return;
    }

    const code = cell(row, idx.code) || undefined;
    const groupCode = cell(row, idx.group);
    let groupId: number | undefined;
    if (groupCode) {
      const resolvedGroupId = resolveGroupId(groupCode);
      if (resolvedGroupId == null) {
        errors.push({
          row: rowNum,
          message:
            t?.('app.master-data.materials.importGroupNotFound', { value: groupCode }) ??
            `未找到物料分组：${groupCode}`,
        });
        return;
      }
      groupId = resolvedGroupId;
    }
    const variantManaged =
      idx.variantManaged >= 0 ? parseImportBool(row[idx.variantManaged]) : false;
    const isActiveRaw = cell(row, idx.isActive);
    const isActive = idx.isActive >= 0 ? (isActiveRaw ? parseImportBool(row[idx.isActive]) : true) : true;
    const batchManaged =
      idx.batchManaged >= 0 ? parseImportBool(row[idx.batchManaged]) : false;
    const serialManaged =
      idx.serialManaged >= 0 ? parseImportBool(row[idx.serialManaged]) : false;

    items.push({
      kind: 'master',
      rowNum,
      data: {
        mainCode: code,
        name,
        baseUnit: unit,
        specification: cell(row, idx.spec) || undefined,
        sourceType: parseMaterialSourceTypeImport(cell(row, idx.type), t),
        groupId,
        variantManaged,
        ...(variantManaged ? { variantAttributes: undefined } : {}),
        isActive,
        batchManaged,
        serialManaged,
      },
    });
  });

  return { items, errors };
}
