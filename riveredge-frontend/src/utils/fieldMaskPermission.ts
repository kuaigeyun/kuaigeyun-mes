/**
 * 字段权限掩码（与后端 PermissionPolicyService 字段 canonical 名一致）
 */

export type FieldMaskLevel = 'full' | 'masked' | 'hidden';

export type UserFieldMaskMap = Record<string, Record<string, FieldMaskLevel>>;

const FIELD_CANONICAL_ALIAS: Record<string, string> = {
  amountwithtax: 'amount_with_tax',
  amount_with_tax: 'amount_with_tax',
  amountwithouttax: 'amount_without_tax',
  amount_without_tax: 'amount_without_tax',
  untaxed_amount: 'amount_without_tax',
  taxamount: 'tax_amount',
  tax_amount: 'tax_amount',
  totalamount: 'total_amount',
  total_amount: 'total_amount',
  unitprice: 'unit_price',
  unit_price: 'unit_price',
  customername: 'customer_name',
  customer_name: 'customer_name',
  clientname: 'customer_name',
  client_name: 'customer_name',
};

export function canonicalizeFieldName(raw: string): string {
  const snake = String(raw ?? '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase()
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const compact = snake.replace(/_/g, '');
  return FIELD_CANONICAL_ALIAS[snake] || FIELD_CANONICAL_ALIAS[compact] || snake;
}

export function normalizeFieldMaskResource(resource: string): string {
  return String(resource ?? '').trim().toLowerCase();
}

/** 解析用户对某资源某字段的有效掩码；无策略时返回 undefined */
export function resolveFieldMaskLevel(
  masks: UserFieldMaskMap | undefined,
  resource: string | undefined,
  fieldName: string | undefined,
): FieldMaskLevel | undefined {
  if (!masks || !resource?.trim() || !fieldName?.trim()) return undefined;
  const resKey = normalizeFieldMaskResource(resource);
  const fieldKey = canonicalizeFieldName(fieldName);
  return masks[resKey]?.[fieldKey];
}

export type AmountFieldVisibility = 'show' | 'mask' | 'hide';

/** AmountDisplay 与表单只读金额展示共用 */
export function resolveAmountFieldVisibility(
  masks: UserFieldMaskMap | undefined,
  resource: string | undefined,
  fieldName: string | undefined,
  legacyPricingAllowed: boolean,
): AmountFieldVisibility {
  const fieldMask = resolveFieldMaskLevel(masks, resource, fieldName);
  if (fieldMask === 'full') return 'show';
  if (fieldMask === 'masked') return 'mask';
  if (fieldMask === 'hidden') return 'hide';
  return legacyPricingAllowed ? 'show' : 'mask';
}
