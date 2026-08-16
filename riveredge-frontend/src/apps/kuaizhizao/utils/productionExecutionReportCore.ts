/** 生产执行报表 → 后端 /reports/production 表单字段（排序走 extractReportProTableSort 统一路径） */
export function resolveProductionReportFormParams(
  searchFormValues?: Record<string, unknown> | null,
): Record<string, string | undefined> {
  const s = searchFormValues ?? {};
  const pick = (key: string) => {
    const v = s[key];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };
  const keyword = pick('keyword');
  return {
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

/** @deprecated 使用 resolveProductionReportFormParams + extractReportProTableSort */
export function resolveProductionReportApiParams(
  searchFormValues?: Record<string, unknown> | null,
  _sort?: Record<string, unknown>,
): Record<string, string | undefined> {
  return resolveProductionReportFormParams(searchFormValues);
}
