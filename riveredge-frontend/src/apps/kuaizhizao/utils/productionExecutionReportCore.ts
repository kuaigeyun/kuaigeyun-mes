import { extractProTableSort } from '../../../utils/tableQueryKey';

/** 生产执行报表 → 后端 /reports/production 查询参数 */
export function resolveProductionReportApiParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | undefined> {
  const { sortBy, sortOrder } = extractProTableSort(sort ?? {});
  const order_by =
    sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
  const s = searchFormValues ?? {};
  const pick = (key: string) => {
    const v = s[key];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };
  const keyword = pick('keyword');
  return {
    order_by,
    keyword,
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    order_code: pick('order_code') ?? pick('code'),
    product_name: pick('product_name') ?? pick('material_name'),
    supplier_name: pick('supplier_name'),
    work_order_code:
      pick('work_order_code') ??
      pick('order_code') ??
      pick('code') ??
      pick('outsource_work_order_code'),
  };
}
