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

/** Configure 已废弃，展示与业务逻辑归并为 Buy */
export function normalizeMaterialSourceType(raw?: string | null): string {
  const v = String(raw ?? '').trim();
  if (v === 'Configure') return 'Buy';
  return v;
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
