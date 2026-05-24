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
  groupTitle?: string,
): MaterialImportColumnIndex {
  const col = (n: string) =>
    headers.findIndex(
      (h) => (h || '').replace(/\*+/, '').trim() === n || (h || '').trim() === n,
    );

  return {
    code: col('物料编号') >= 0 ? col('物料编号') : col('编号'),
    name: col('物料名称') >= 0 ? col('物料名称') : col('名称'),
    unit: col('基础单位') >= 0 ? col('基础单位') : col('单位'),
    spec: col('规格') >= 0 ? col('规格') : -1,
    type: col('物料类型') >= 0 ? col('物料类型') : -1,
    group:
      col('分组编号') >= 0
        ? col('分组编号')
        : col('分组') >= 0
          ? col('分组')
          : groupTitle && col(groupTitle) >= 0
            ? col(groupTitle)
            : -1,
    rowType: col('行类型') >= 0 ? col('行类型') : -1,
    masterMainCode: col('主编码') >= 0 ? col('主编码') : -1,
    variantAttrs: col('属性组合') >= 0 ? col('属性组合') : -1,
    variantManaged: col('启用属性管理') >= 0 ? col('启用属性管理') : -1,
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
    baseUnit: master.baseUnit ?? (master as { base_unit?: string }).base_unit ?? 'PC',
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
