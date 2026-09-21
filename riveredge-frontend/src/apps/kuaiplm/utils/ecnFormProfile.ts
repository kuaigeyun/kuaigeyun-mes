/**
 * ECN form-profile 消费：列定义、溢出字段拆分、展示取值。
 */

import type { TFunction } from 'i18next';
import type { ColumnsType } from 'antd/es/table';
import type { EcnFormProfile, EcnMaterialLine } from '../services/engineering-change';

export type EcnProfileColumn = {
  key: string;
  label: string;
  sort?: number;
  required?: boolean;
  width?: number;
  type?: string;
};

export type EcnProfileHeaderField = {
  key: string;
  label: string;
  sort?: number;
  type?: string;
};

export function sortedHeaderFields(
  profile: EcnFormProfile | null,
  industryActive = false,
): EcnProfileHeaderField[] {
  if (!industryActive) return [];
  const raw = profile?.header_fields || [];
  return [...raw]
    .filter((f) => f?.key)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((f) => ({
      key: String(f.key),
      label: String(f.label || f.key),
      sort: f.sort,
      type: f.type,
    }));
}

/** profile 列 key → API 直接字段 */
export const ECN_MATERIAL_DIRECT_KEYS = new Set([
  'material_id',
  'material_code',
  'material_name',
  'before_desc',
  'after_desc',
  'stock_qty',
  'unit_price',
  'cost_amount',
  'disposition',
  'owner_user_id',
  'owner_user_name',
  'remarks',
]);

/** profile 列 key → 落库字段名 */
export const ECN_MATERIAL_KEY_ALIASES: Record<string, string> = {
  cost_delta: 'cost_amount',
};

const DEFAULT_MATERIAL_COLUMNS: EcnProfileColumn[] = [
  { key: 'material_code', label: '物料编码', sort: 10, required: true, width: 130 },
  { key: 'material_name', label: '物料名称', sort: 20, required: true, width: 140 },
  { key: 'before_desc', label: '变更前', sort: 30, width: 120 },
  { key: 'after_desc', label: '变更后', sort: 35, width: 120 },
  { key: 'disposition', label: '库存处置', sort: 70, width: 110 },
  { key: 'owner_user_name', label: '负责人', sort: 80, width: 110 },
];

export function sortedMaterialColumns(
  profile: EcnFormProfile | null,
  industryActive = false,
): EcnProfileColumn[] {
  if (!industryActive) {
    return DEFAULT_MATERIAL_COLUMNS;
  }
  const raw = profile?.material_line_columns?.length
    ? profile.material_line_columns
    : DEFAULT_MATERIAL_COLUMNS;
  return [...raw]
    .filter((c) => c?.key)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((c) => ({
      key: String(c.key),
      label: String(c.label || c.key),
      sort: c.sort,
      required: c.required,
      width: c.width,
      type: c.type,
    }));
}

export function resolveMaterialStorageKey(columnKey: string): string {
  return ECN_MATERIAL_KEY_ALIASES[columnKey] || columnKey;
}

export function getMaterialLineCellValue(
  line: EcnMaterialLine | Record<string, unknown>,
  columnKey: string,
): unknown {
  const storageKey = resolveMaterialStorageKey(columnKey);
  const record = line as Record<string, unknown>;
  if (record[storageKey] !== undefined && record[storageKey] !== null && record[storageKey] !== '') {
    return record[storageKey];
  }
  if (columnKey !== storageKey && record[columnKey] !== undefined && record[columnKey] !== null) {
    return record[columnKey];
  }
  const payload = record.extension_payload as Record<string, unknown> | undefined;
  return payload?.[columnKey];
}

export function flattenMaterialLineForForm(line: EcnMaterialLine): Record<string, unknown> {
  const base: Record<string, unknown> = { ...line };
  const payload = line.extension_payload || {};
  for (const [key, value] of Object.entries(payload)) {
    if (base[key] === undefined || base[key] === null || base[key] === '') {
      base[key] = value;
    }
  }
  if (base.cost_amount !== undefined && base.cost_amount !== null && base.cost_delta == null) {
    base.cost_delta = base.cost_amount;
  }
  return base;
}

export function prepareMaterialLineForApi(
  line: Record<string, unknown>,
  columns: EcnProfileColumn[],
): EcnMaterialLine {
  const columnKeys = new Set(columns.map((c) => c.key));
  const direct: Record<string, unknown> = {};
  const overflow: Record<string, unknown> = {};

  for (const col of columns) {
    const rawKey = col.key;
    const storageKey = resolveMaterialStorageKey(rawKey);
    const value = line[rawKey] ?? (rawKey !== storageKey ? line[storageKey] : undefined);
    if (value === undefined || value === '') continue;
    if (ECN_MATERIAL_DIRECT_KEYS.has(storageKey)) {
      direct[storageKey] = value;
    } else if (columnKeys.has(rawKey)) {
      overflow[rawKey] = value;
    }
  }

  for (const key of ECN_MATERIAL_DIRECT_KEYS) {
    if (line[key] !== undefined && line[key] !== '' && direct[key] === undefined) {
      direct[key] = line[key];
    }
  }

  return {
    material_id: (direct.material_id as number | null | undefined) ?? null,
    material_code: String(direct.material_code || '').trim(),
    material_name: String(direct.material_name || '').trim(),
    before_desc: (direct.before_desc as string | null | undefined) ?? null,
    after_desc: (direct.after_desc as string | null | undefined) ?? null,
    stock_qty: direct.stock_qty as EcnMaterialLine['stock_qty'],
    unit_price: direct.unit_price as EcnMaterialLine['unit_price'],
    cost_amount: direct.cost_amount as EcnMaterialLine['cost_amount'],
    disposition: (direct.disposition as string | null | undefined) ?? null,
    owner_user_id: (direct.owner_user_id as number | null | undefined) ?? null,
    owner_user_name: (direct.owner_user_name as string | null | undefined) ?? null,
    remarks: (direct.remarks as string | null | undefined) ?? null,
    extension_payload: Object.keys(overflow).length ? overflow : null,
  };
}

export function buildHeaderExtensionPayload(
  values: Record<string, unknown>,
  profile: EcnFormProfile | null,
  industryActive = false,
): Record<string, unknown> | null {
  if (!industryActive) return null;
  const payload: Record<string, unknown> = {};
  for (const field of sortedHeaderFields(profile, true)) {
    const value = values[field.key];
    if (value !== undefined && value !== null && value !== '') {
      payload[field.key] = value;
    }
  }
  for (const flag of profile?.header_option_flags || []) {
    const key = String(flag.key || '');
    if (!key) continue;
    const value = values[key];
    if (value !== undefined && value !== null && value !== '') {
      payload[key] = value;
    }
  }
  return Object.keys(payload).length ? payload : null;
}

export function mergeHeaderExtensionIntoForm(
  editing: { extension_payload?: Record<string, unknown> | null } | null | undefined,
): Record<string, unknown> {
  return { ...(editing?.extension_payload || {}) };
}

export function resolveEcnFieldLabel(
  profile: EcnFormProfile | null,
  fieldKey: string,
  fallback: string,
): string {
  return profile?.field_labels?.[fieldKey] || fallback;
}

export function buildEcnDetailMaterialColumns(
  profile: EcnFormProfile | null,
  t: TFunction,
  industryActive = false,
): ColumnsType<EcnMaterialLine> {
  return sortedMaterialColumns(profile, industryActive).map((col) => ({
    title: col.label,
    dataIndex: col.key,
    width: col.width,
    ellipsis: true,
    render: (_: unknown, row: EcnMaterialLine) => {
      const value = getMaterialLineCellValue(row, col.key);
      if (col.key === 'disposition' && value) {
        return t(`app.kuaiplm.ecn.disposition.${String(value)}`, { defaultValue: String(value) });
      }
      if (value === undefined || value === null || value === '') return '-';
      return String(value);
    },
  }));
}
