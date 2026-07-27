/**
 * 加载取单分段：可加载 / 全部（前端过滤 + 分页切片）。
 */

export const UNI_PULL_SCOPE_PULLABLE = 'pullable';
export const UNI_PULL_SCOPE_ALL = 'all';

export function isPullableScope(scope?: string): boolean {
  return (scope || UNI_PULL_SCOPE_PULLABLE) !== UNI_PULL_SCOPE_ALL;
}

export function filterByPullScope<T>(
  rows: T[],
  scope: string | undefined,
  isPullable: (row: T) => boolean,
): T[] {
  if (!isPullableScope(scope)) return rows;
  return rows.filter(isPullable);
}

export function paginatePullRows<T>(
  rows: T[],
  page: number,
  pageSize: number,
): { data: T[]; total: number } {
  const begin = Math.max(0, (page - 1) * pageSize);
  return {
    data: rows.slice(begin, begin + pageSize),
    total: rows.length,
  };
}
