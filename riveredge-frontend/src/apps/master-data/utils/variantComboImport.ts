/**
 * 属性组合明细表 Excel 导入（仅当前主物料下的 SKU 组合，不含物料主数据）
 */

import type { VariantAttributeDefinition } from '../types/variant-attribute';
import { parseImportBool } from './parseVariantAttributesImport';

const ENABLED_HEADER_ALIASES = ['启用状态', '是否启用', 'enabled', 'isactive'];

export interface VariantComboImportRow {
  rowNum: number;
  variantAttributes: Record<string, unknown>;
  isActive: boolean;
}

function normalizeHeader(h: unknown): string {
  return String(h ?? '')
    .replace(/\*+/, '')
    .trim();
}

function normalizeScalarAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length === 1) cleaned[k] = v[0];
      continue;
    }
    cleaned[k] = v;
  }
  return Object.fromEntries(Object.entries(cleaned).sort(([a], [b]) => a.localeCompare(b)));
}

export function variantComboAttrsKey(attrs: Record<string, unknown>): string {
  return JSON.stringify(normalizeScalarAttrs(attrs));
}

function resolveAttrColumnIndex(
  headers: string[],
  def: VariantAttributeDefinition,
): number {
  const candidates = [def.display_name, def.attribute_name]
    .map((n) => (n || '').trim())
    .filter(Boolean);
  for (const name of candidates) {
    const idx = headers.findIndex((h) => h === name);
    if (idx >= 0) return idx;
  }
  return -1;
}

export function buildVariantComboImportTemplate(definitions: VariantAttributeDefinition[]) {
  const attrHeaders = definitions.map((d) => d.display_name || d.attribute_name);
  const headers = [...attrHeaders, '启用状态'];
  const exampleRow = [
    ...definitions.map((d) => {
      if (d.attribute_type === 'enum' && (d.enum_values?.length ?? 0) > 0) {
        return d.enum_values![0];
      }
      if (d.attribute_type === 'boolean') return '是';
      if (d.attribute_type === 'number') return '1';
      return '';
    }),
    '是',
  ];
  return { headers, exampleRow };
}

export function parseVariantComboImportRows(
  data: unknown[][],
  definitions: VariantAttributeDefinition[],
  existingKeys: Set<string>,
): { rows: VariantComboImportRow[]; errors: Array<{ row: number; message: string }> } {
  const headers = (data[0] || []).map(normalizeHeader);
  const errors: Array<{ row: number; message: string }> = [];
  const rows: VariantComboImportRow[] = [];

  if (!headers.length) {
    return { rows: [], errors: [{ row: 1, message: '表头不能为空' }] };
  }

  const attrColumns = definitions.map((def) => ({
    def,
    colIndex: resolveAttrColumnIndex(headers, def),
  }));

  const missingRequired = attrColumns.filter(
    ({ def, colIndex }) => def.is_required && colIndex < 0,
  );
  if (missingRequired.length) {
    return {
      rows: [],
      errors: [
        {
          row: 1,
          message: `缺少必填属性列：${missingRequired.map(({ def }) => def.display_name || def.attribute_name).join('、')}`,
        },
      ],
    };
  }

  const enabledColIndex = headers.findIndex((h) =>
    ENABLED_HEADER_ALIASES.some((alias) => h.toLowerCase() === alias.toLowerCase()),
  );

  const bodyRows = (data.slice(2) as unknown[][]).filter((row) =>
    row?.some((c) => c != null && String(c).trim() !== ''),
  );

  if (!bodyRows.length) {
    return { rows: [], errors: [{ row: 3, message: '没有可导入的数据行（请从第 3 行起填写）' }] };
  }

  bodyRows.forEach((row, i) => {
    const rowNum = i + 3;
    const attrs: Record<string, unknown> = {};

    for (const { def, colIndex } of attrColumns) {
      if (colIndex < 0) continue;
      const raw = row[colIndex];
      const text = raw == null ? '' : String(raw).trim();
      if (!text) {
        if (def.is_required) {
          errors.push({
            row: rowNum,
            message: `${def.display_name || def.attribute_name} 不能为空`,
          });
        }
        continue;
      }
      if (def.attribute_type === 'number') {
        const num = Number(text);
        if (Number.isNaN(num)) {
          errors.push({ row: rowNum, message: `${def.display_name || def.attribute_name} 须为数值` });
          return;
        }
        attrs[def.attribute_name] = num;
      } else if (def.attribute_type === 'boolean') {
        attrs[def.attribute_name] = parseImportBool(text);
      } else {
        attrs[def.attribute_name] = text;
      }
    }

    if (errors.some((e) => e.row === rowNum)) return;

    const normalized = normalizeScalarAttrs(attrs);
    if (Object.keys(normalized).length === 0) {
      errors.push({ row: rowNum, message: '请至少填写一项属性值' });
      return;
    }

    const key = variantComboAttrsKey(normalized);
    if (existingKeys.has(key)) {
      errors.push({ row: rowNum, message: '该属性组合已存在，已跳过' });
      return;
    }
    existingKeys.add(key);

    let isActive = true;
    if (enabledColIndex >= 0) {
      const enabledRaw = row[enabledColIndex];
      if (enabledRaw != null && String(enabledRaw).trim() !== '') {
        isActive = parseImportBool(enabledRaw);
      }
    }

    rows.push({ rowNum, variantAttributes: normalized, isActive });
  });

  return { rows, errors };
}
