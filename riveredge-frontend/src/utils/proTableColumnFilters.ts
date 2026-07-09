import type { ProColumns } from '@ant-design/pro-components';
import type { Key } from 'react';

type ValueEnumItem = { text: string } | string;

/** 将 ProColumns valueEnum 转为 Ant Design Table 表头筛选项 */
export function valueEnumToColumnFilters(
  valueEnum: Record<string, ValueEnumItem>,
): { text: string; value: string }[] {
  return Object.entries(valueEnum).map(([value, item]) => ({
    text:
      typeof item === 'object' && item !== null && 'text' in item
        ? String(item.text)
        : String(item),
    value,
  }));
}

/** 将 ProTable request 的 filter 参数转为 API 单值查询（服务端筛选） */
export function mergeProTableFilterParams(
  filter: Record<string, (Key | boolean)[] | null> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!filter) return out;
  for (const [field, values] of Object.entries(filter)) {
    if (!values?.length) continue;
    out[field] = String(values[0]);
  }
  return out;
}

/** 为枚举列启用表头筛选（服务端筛选，不设 onFilter） */
export function withColumnHeaderFilters<T>(
  column: ProColumns<T>,
  valueEnum: Record<string, ValueEnumItem>,
): ProColumns<T> {
  return {
    ...column,
    filters: valueEnumToColumnFilters(valueEnum),
    filterMultiple: false,
  };
}
