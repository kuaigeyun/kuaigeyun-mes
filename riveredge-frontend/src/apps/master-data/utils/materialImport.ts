/**
 * 物料 Excel 导入：主物料 + 属性 SKU 行
 */

import type { Material, MaterialCreate } from '../types/material';
import { materialApi } from '../services/material';
import { isVariantMasterMaterial } from '../components/MaterialVariantCombinationsTable';
import {
  isSkuImportRowType,
  parseImportBool,
  parseVariantAttributesImport,
} from './parseVariantAttributesImport';
import { DEFAULT_MATERIAL_BASE_UNIT } from '../constants/materialDefaults';
import { resolveFactoryImportHeaderIndexMap } from '../../../utils/spreadsheetImportTemplate';

export type MaterialImportRowKind = 'master' | 'sku';

export interface MaterialMasterImportItem {
  kind: 'master';
  rowNum: number;
  data: MaterialCreate;
  mainCodeHint?: string;
}

export interface MaterialSkuImportItem {
  kind: 'sku';
  rowNum: number;
  masterMainCode: string;
  variantAttributes: Record<string, unknown>;
}

export type MaterialImportItem = MaterialMasterImportItem | MaterialSkuImportItem;

export interface MaterialImportColumnIndex {
  code: number;
  name: number;
  unit: number;
  spec: number;
  type: number;
  group: number;
  rowType: number;
  masterMainCode: number;
  variantAttrs: number;
  variantManaged: number;
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
    rowType: idx('rowType'),
    masterMainCode: idx('masterMainCode'),
    variantAttrs: idx('variantAttributes'),
    variantManaged: idx('variantManaged'),
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
): { items: MaterialImportItem[]; errors: Array<{ row: number; message: string }> } {
  const errors: Array<{ row: number; message: string }> = [];
  const items: MaterialImportItem[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + rowOffset;
    const rowTypeRaw = cell(row, idx.rowType);
    const masterMainCode = cell(row, idx.masterMainCode);
    const variantAttrsRaw = cell(row, idx.variantAttrs);
    const isSku =
      isSkuImportRowType(rowTypeRaw) ||
      (!rowTypeRaw && !!masterMainCode && !!variantAttrsRaw);

    if (isSku) {
      if (!masterMainCode) {
        errors.push({ row: rowNum, message: 'SKU 行须填写主编码（对应主物料编号）' });
        return;
      }
      try {
        const variantAttributes = parseVariantAttributesImport(variantAttrsRaw);
        items.push({
          kind: 'sku',
          rowNum,
          masterMainCode,
          variantAttributes,
        });
      } catch (e: unknown) {
        errors.push({
          row: rowNum,
          message: e instanceof Error ? e.message : '属性组合解析失败',
        });
      }
      return;
    }

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
    const variantManaged =
      idx.variantManaged >= 0 ? parseImportBool(row[idx.variantManaged]) : false;

    items.push({
      kind: 'master',
      rowNum,
      mainCodeHint: code,
      data: {
        mainCode: code,
        name,
        baseUnit: unit,
        specification: cell(row, idx.spec) || undefined,
        sourceType: cell(row, idx.type) || undefined,
        groupId: groupCode ? resolveGroupId(groupCode) : undefined,
        variantManaged,
        ...(variantManaged ? { variantAttributes: undefined } : {}),
        isActive: true,
      },
    });
  });

  return { items, errors };
}

function pickMainCode(m: Material): string {
  return (m.mainCode ?? (m as { main_code?: string }).main_code ?? m.code ?? '').trim();
}

function isMasterRowMaterial(m: Material): boolean {
  if (isVariantMasterMaterial(m)) return true;
  const attrs = m.variantAttributes ?? (m as { variant_attributes?: Record<string, unknown> }).variant_attributes;
  return !!m.variantManaged && (!attrs || Object.keys(attrs).length === 0);
}

export async function resolveMasterMaterialForImport(
  mainCode: string,
  cache: Map<string, Material>,
): Promise<Material | null> {
  const key = mainCode.trim();
  if (!key) return null;
  const cached = cache.get(key);
  if (cached) return cached;

  const { items } = await materialApi.list({ code: key, limit: 20 });
  const master = (items ?? []).find((m) => pickMainCode(m) === key && isMasterRowMaterial(m));
  if (master) {
    cache.set(key, master);
  }
  return master ?? null;
}

export function materialToSkuCreatePayload(
  master: Material,
  variantAttributes: Record<string, unknown>,
): MaterialCreate {
  return {
    mainCode: pickMainCode(master),
    name: master.name,
    baseUnit: master.baseUnit ?? (master as { base_unit?: string }).base_unit ?? DEFAULT_MATERIAL_BASE_UNIT,
    groupId: master.groupId ?? (master as { group_id?: number }).group_id,
    specification: master.specification,
    sourceType: master.sourceType ?? (master as { source_type?: string }).source_type,
    variantManaged: true,
    variantAttributes,
    isActive: master.isActive ?? true,
  };
}

export async function ensureMasterVariantManaged(master: Material): Promise<Material> {
  if (master.variantManaged && isMasterRowMaterial(master)) {
    return master;
  }
  const uuid = master.uuid;
  await materialApi.update(uuid, {
    variantManaged: true,
    variantAttributes: null,
  } as MaterialCreate);
  const updated = await materialApi.get(uuid);
  return updated;
}
