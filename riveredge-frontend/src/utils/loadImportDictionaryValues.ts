import type { TFunction } from 'i18next';

import {
  getDataDictionaryByCode,
  getDictionaryItemList,
} from '../services/dataDictionary';
import { mapSystemDictionaryItemOptions } from './systemDictionaryI18n';

/** 导入「是否启用」列常用选项（与 parseActive 中文分支一致） */
export const IMPORT_YES_NO_OPTIONS = ['是', '否'] as const;

/**
 * @deprecated 请用 buildImportPriceTypeOptions(t) 展示中文；确认时用 parseImportPriceType。
 * 保留仅为兼容未迁移引用。
 */
export const IMPORT_PRICE_TYPE_OPTIONS = ['tax_inclusive', 'tax_exclusive'] as const;

/** 从 {label,value} 选项生成导入下拉文案 */
export function importDropdownLabelsFromOptions(
  options: Array<{ label?: string; value?: string }> | undefined,
): string[] {
  const labelByCode: ImportCodeLabelMap = {};
  for (const opt of options ?? []) {
    const code = String(opt.value ?? '').trim();
    if (!code) continue;
    labelByCode[code] = String(opt.label ?? '').trim() || code;
  }
  return importDropdownLabelsFromCodeLabelMap(labelByCode);
}

/** 从 {label,value} 选项解析导入单元格 → 存库 value */
export function parseImportOptionCell(
  raw: string | null | undefined,
  options: Array<{ label?: string; value?: string }> | undefined,
): string | undefined {
  const labelByCode: ImportCodeLabelMap = {};
  for (const opt of options ?? []) {
    const code = String(opt.value ?? '').trim();
    if (!code) continue;
    labelByCode[code] = String(opt.label ?? '').trim() || code;
  }
  return parseImportCodedCell(raw, labelByCode);
}

/**
 * 若示例值不在选项中，回落到首个选项（避免下拉校验把示例标红）。
 */
export function pickImportExampleValue(options: string[] | undefined, fallback: string): string {
  if (!options?.length) return fallback;
  return options.includes(fallback) ? fallback : options[0] ?? fallback;
}

/** value → 展示 label（当前语言） */
export type ImportCodeLabelMap = Record<string, string>;

export type ImportDictionaryOptionPack = {
  /** 下拉展示文案（当前语言 label） */
  options: string[];
  /** value → label */
  labelByCode: ImportCodeLabelMap;
  /** 单元格 → 存库 value；支持 label / value / 大小写变体 */
  parse: (raw?: string | null) => string | undefined;
};

/**
 * 从 value→label 映射生成导入下拉文案（去空、保序）。
 */
export function importDropdownLabelsFromCodeLabelMap(labelByCode: ImportCodeLabelMap): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const label of Object.values(labelByCode)) {
    const text = String(label ?? '').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    labels.push(text);
  }
  return labels;
}

/**
 * 导入单元格 → 存库码。支持已是存库码、当前语言 label、大小写变体。
 * 无法识别时返回 trim 后的原文（兼容租户自定义字典把中文当 value 的情况）。
 */
export function parseImportCodedCell(
  raw: string | null | undefined,
  labelByCode: ImportCodeLabelMap | undefined,
): string | undefined {
  const v = String(raw ?? '').trim();
  if (!v) return undefined;
  if (!labelByCode || Object.keys(labelByCode).length === 0) return v;

  if (Object.prototype.hasOwnProperty.call(labelByCode, v)) {
    return v;
  }

  const byLowerCode = Object.keys(labelByCode).find((code) => code.toLowerCase() === v.toLowerCase());
  if (byLowerCode) return byLowerCode;

  const byLabel = Object.entries(labelByCode).find(([, label]) => String(label).trim() === v);
  if (byLabel) return byLabel[0];

  const byLabelLower = Object.entries(labelByCode).find(
    ([, label]) => String(label).trim().toLowerCase() === v.toLowerCase(),
  );
  if (byLabelLower) return byLabelLower[0];

  return v;
}

/**
 * 列表/详情展示字典存库值：先按 code 查 label，再按 label 反查，最后回落原文。
 * 与 {@link parseImportCodedCell} 存库策略对称，兼容导入时以中文 label 落库的情况。
 */
export function resolveDictionaryDisplayLabel(
  labelByCode: ImportCodeLabelMap | undefined,
  value?: string | null,
  emptyDisplay = '—',
): string {
  const v = String(value ?? '').trim();
  if (!v) return emptyDisplay;
  if (!labelByCode || Object.keys(labelByCode).length === 0) return v;

  if (Object.prototype.hasOwnProperty.call(labelByCode, v)) {
    return labelByCode[v];
  }

  const byLowerCode = Object.keys(labelByCode).find((code) => code.toLowerCase() === v.toLowerCase());
  if (byLowerCode) return labelByCode[byLowerCode];

  const byLabel = Object.entries(labelByCode).find(([, label]) => String(label).trim() === v);
  if (byLabel) return byLabel[1];

  const byLabelLower = Object.entries(labelByCode).find(
    ([, label]) => String(label).trim().toLowerCase() === v.toLowerCase(),
  );
  if (byLabelLower) return byLabelLower[1];

  return v;
}

export function buildImportDictionaryOptionPack(
  labelByCode: ImportCodeLabelMap,
): ImportDictionaryOptionPack {
  const options = importDropdownLabelsFromCodeLabelMap(labelByCode);
  return {
    options,
    labelByCode,
    parse: (raw) => parseImportCodedCell(raw, labelByCode),
  };
}

/**
 * 加载字典项导入下拉包：下拉显示当前语言 label，parse 回存库 value。
 */
export async function loadImportDictionaryOptionPack(
  dictionaryCode: string,
  t: TFunction,
  hostResource?: string,
): Promise<ImportDictionaryOptionPack> {
  const loadOpts = hostResource ? { hostResource } : undefined;
  const dictionary = await getDataDictionaryByCode(dictionaryCode, loadOpts);
  const items = await getDictionaryItemList(dictionary.uuid, true, loadOpts);
  const mapped = mapSystemDictionaryItemOptions(dictionaryCode, items, t);
  const labelByCode: ImportCodeLabelMap = {};
  for (const item of mapped) {
    const code = String(item.value ?? '').trim();
    const label = String(item.label ?? '').trim();
    if (!code) continue;
    labelByCode[code] = label || code;
  }
  return buildImportDictionaryOptionPack(labelByCode);
}

/**
 * 加载字典导入下拉文案（当前语言 label）。
 * 确认导入时请用 {@link loadImportDictionaryOptionPack} / {@link parseImportCodedCell} 解析回存库值。
 */
export async function loadImportDictionaryValues(
  dictionaryCode: string,
  t: TFunction,
  hostResource?: string,
): Promise<string[]> {
  const pack = await loadImportDictionaryOptionPack(dictionaryCode, t, hostResource);
  return pack.options;
}
