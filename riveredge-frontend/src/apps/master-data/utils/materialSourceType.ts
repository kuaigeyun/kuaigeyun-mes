import type { TFunction } from 'i18next';

/** 物料来源类型可选值（不含已废弃的 Configure） */
export const MATERIAL_SOURCE_TYPE_VALUES = ['Make', 'Buy', 'Outsource', 'Phantom', 'Service'] as const;

export type MaterialSourceTypeValue = (typeof MATERIAL_SOURCE_TYPE_VALUES)[number];

const SOURCE_TYPE_I18N_KEY: Record<string, string> = {
  Make: 'app.master-data.materialForm.sourceMake',
  Buy: 'app.master-data.materialForm.sourceBuy',
  Outsource: 'app.master-data.materialForm.sourceOutsource',
  Phantom: 'app.master-data.materialForm.sourcePhantom',
  Service: 'app.master-data.materialForm.sourceService',
};

/** 导入常见中文/别名 → 存库值（不依赖当前 UI 语言） */
const SOURCE_TYPE_IMPORT_ALIASES: Record<string, MaterialSourceTypeValue> = {
  自制件: 'Make',
  自制: 'Make',
  采购件: 'Buy',
  采购: 'Buy',
  採購件: 'Buy',
  委外件: 'Outsource',
  外协: 'Outsource',
  外協: 'Outsource',
  虚拟件: 'Phantom',
  虛擬件: 'Phantom',
  服务: 'Service',
  服務: 'Service',
};

/** Configure 已废弃，展示与业务逻辑归并为 Buy */
export function normalizeMaterialSourceType(raw?: string | null): string {
  const v = String(raw ?? '').trim();
  if (v === 'Configure') return 'Buy';
  return v;
}

/**
 * 导入单元格 → 存库来源类型。支持英文存库值、大小写变体、中文别名，以及当前语言文案。
 */
export function parseMaterialSourceTypeImport(
  raw?: string | null,
  t?: TFunction,
): string | undefined {
  const v = String(raw ?? '').trim();
  if (!v) return undefined;
  if (v === 'Configure') return 'Buy';

  if ((MATERIAL_SOURCE_TYPE_VALUES as readonly string[]).includes(v)) {
    return v;
  }
  const byLower = MATERIAL_SOURCE_TYPE_VALUES.find((x) => x.toLowerCase() === v.toLowerCase());
  if (byLower) return byLower;

  const alias = SOURCE_TYPE_IMPORT_ALIASES[v];
  if (alias) return alias;

  if (t) {
    for (const value of MATERIAL_SOURCE_TYPE_VALUES) {
      if (t(SOURCE_TYPE_I18N_KEY[value]) === v) return value;
    }
  }

  return normalizeMaterialSourceType(v);
}

/** 导入下拉展示文案（与表单 Dictionary/Select 一致，随当前语言） */
export function buildMaterialSourceTypeImportOptions(t: TFunction): string[] {
  return MATERIAL_SOURCE_TYPE_VALUES.map((value) => t(SOURCE_TYPE_I18N_KEY[value]));
}

export function getMaterialSourceTypeLabel(raw: string | null | undefined, t: TFunction): string {
  const normalized = normalizeMaterialSourceType(raw);
  const key = SOURCE_TYPE_I18N_KEY[normalized];
  if (key) return t(key);
  return normalized || '-';
}

export function buildMaterialSourceTypeOptions(t: TFunction): Array<{ label: string; value: string }> {
  return MATERIAL_SOURCE_TYPE_VALUES.map((value) => ({
    value,
    label: t(SOURCE_TYPE_I18N_KEY[value]),
  }));
}
