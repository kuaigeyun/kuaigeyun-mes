/**
 * 加载取单分段：可加载 / 全部（前端过滤 + 分页切片）。
 */

export const UNI_PULL_SCOPE_PULLABLE = 'pullable';
export const UNI_PULL_SCOPE_ALL = 'all';

/** 与后端 pull-candidates 接口 Query(limit, le=100) 一致，取单弹窗批量拉取上限 */
export const UNI_PULL_QUERY_MAX_FETCH_LIMIT = 100;

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
