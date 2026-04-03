/**
 * 采购申请头 source_type（后端多为 PascalCase，如 DemandComputation）→ 用户可见文案
 * 与 components.documentTrackingPanel.docType.* 对齐，避免界面出现内部类型码。
 */

import type { TFunction } from 'i18next';

/** 后端写入值 → docType i18n 后缀（蛇形，与 locales 键一致） */
const SOURCE_TYPE_TO_DOC_SUFFIX: Record<string, string> = {
  DemandComputation: 'demand_computation',
  demand_computation: 'demand_computation',
};

function pascalToSnakeCase(s: string): string {
  return s
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

export function formatPurchaseRequisitionSourceType(
  raw: string | undefined | null,
  t: TFunction
): string {
  if (raw == null || !String(raw).trim()) return '-';
  const norm = String(raw).trim();
  const suffix = SOURCE_TYPE_TO_DOC_SUFFIX[norm] ?? pascalToSnakeCase(norm);
  return t(`components.documentTrackingPanel.docType.${suffix}`, { defaultValue: norm });
}
