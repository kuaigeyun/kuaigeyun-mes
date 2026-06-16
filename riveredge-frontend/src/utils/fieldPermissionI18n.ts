/**
 * 字段权限内置字段展示名 i18n（与后端 PermissionPolicyService.FIELD_LABEL_MAP 对齐）
 */

/** 角色字段权限可配置的 canonical 字段名 */
export const FIELD_PERMISSION_CANONICAL_NAMES = new Set<string>([
  'amount',
  'total_amount',
  'tax_amount',
  'untaxed_amount',
  'amount_with_tax',
  'amount_without_tax',
  'unit_price',
  'price',
  'customer_name',
]);

export function resolveFieldPermissionLabel(
  fieldName: string | undefined,
  backendLabel: string | undefined | null,
  t: (key: string, opts?: { defaultValue?: string }) => string,
): string {
  const canonical = (fieldName || '').trim().toLowerCase();
  if (!canonical) {
    const label = (backendLabel || '').trim();
    return label || '—';
  }

  const i18nKey = `permission.fieldName.${canonical}`;
  const translated = t(i18nKey, { defaultValue: '' });
  if (translated && translated !== i18nKey) return translated;

  const label = (backendLabel || '').trim();
  return label || canonical;
}
