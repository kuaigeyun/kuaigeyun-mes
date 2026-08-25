/**
 * 高级搜索 → 报表/列表共用的 column_filters 契约。
 * 唯一真源：{ field, op, value?, value_to? }，禁止 field__ne 等旁路键。
 */

import type { FilterOperator } from './types';

export type AdvancedColumnFilterOp =
  | 'contains'
  | 'eq'
  | 'ne'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'between'
  | 'in'
  | 'nin'
  | 'startswith'
  | 'endswith'
  | 'isnull';

export type AdvancedColumnFilter = {
  field: string;
  op: AdvancedColumnFilterOp;
  value?: string | number | boolean | string[] | number[];
  value_to?: string | number;
};

/** uni-query 操作符 → column_filters.op */
export function mapFilterOperatorToColumnFilterOp(
  operator: FilterOperator,
): AdvancedColumnFilterOp | null {
  switch (operator) {
    case 'contains':
      return 'contains';
    case 'equals':
      return 'eq';
    case 'not_equals':
      return 'ne';
    case 'greater_than':
    case 'after':
      return 'gt';
    case 'greater_than_or_equal':
      return 'gte';
    case 'less_than':
    case 'before':
      return 'lt';
    case 'less_than_or_equal':
      return 'lte';
    case 'between':
    case 'today':
    case 'this_week':
    case 'this_month':
    case 'this_year':
      return 'between';
    case 'in':
      return 'in';
    case 'not_in':
      return 'nin';
    case 'starts_with':
      return 'startswith';
    case 'ends_with':
      return 'endswith';
    case 'is_empty':
    case 'is_not_empty':
      return 'isnull';
    default:
      return null;
  }
}

export function parseColumnFiltersParam(raw: unknown): AdvancedColumnFilter[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is AdvancedColumnFilter => x != null && typeof x === 'object');
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((x): x is AdvancedColumnFilter => x != null && typeof x === 'object')
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function serializeColumnFiltersParam(
  filters: AdvancedColumnFilter[],
): string | undefined {
  if (!filters.length) return undefined;
  return JSON.stringify(filters);
}

export function mergeColumnFilters(
  ...groups: Array<AdvancedColumnFilter[] | undefined | null>
): AdvancedColumnFilter[] {
  const out: AdvancedColumnFilter[] = [];
  for (const group of groups) {
    if (!group?.length) continue;
    out.push(...group);
  }
  return out;
}
