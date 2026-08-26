/**
 * 列表分页拉取（对齐后端常见 le=1000 上限）。
 * 导出「全部」时禁止单次传超大 limit。
 */

export const LIST_API_MAX_LIMIT = 1000;
/** 报表类接口 current/page_size 上限（与后端 REPORT_LIST_MAX_LIMIT 一致） */
export const REPORT_API_MAX_PAGE_SIZE = 10_000;

export type ListPageParams = { skip: number; limit: number };

export type CurrentPageParams = { current: number; page_size: number };

export type ListPageResult<T> =
  | T[]
  | {
      items?: T[];
      data?: T[];
      total?: number;
    };

function extractItems<T>(res: ListPageResult<T>): T[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.items)) return res.items;
  if (Array.isArray(res.data)) return res.data;
  return [];
}

function extractTotal<T>(res: ListPageResult<T>): number | undefined {
  if (Array.isArray(res)) return undefined;
  return typeof res.total === 'number' ? res.total : undefined;
}

/**
 * 按页拉取直至取完。pageSize 默认且上限为 LIST_API_MAX_LIMIT。
 */
export async function fetchAllListItems<T>(
  fetchPage: (params: ListPageParams) => Promise<ListPageResult<T>>,
  options?: { pageSize?: number; maxPages?: number },
): Promise<T[]> {
  const pageSize = Math.min(
    Math.max(1, options?.pageSize ?? LIST_API_MAX_LIMIT),
    LIST_API_MAX_LIMIT,
  );
  const maxPages = options?.maxPages ?? 200;
  const all: T[] = [];
  let skip = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const res = await fetchPage({ skip, limit: pageSize });
    const items = extractItems(res);
    all.push(...items);
    if (items.length < pageSize) break;
    const total = extractTotal(res);
    if (typeof total === 'number' && all.length >= total) break;
    skip += pageSize;
  }

  return all;
}

/**
 * 按 current/page_size 分页拉取直至取完（报表 material-balances、batch-lines 等）。
 */
export async function fetchAllCurrentPageItems<T>(
  fetchPage: (params: CurrentPageParams) => Promise<ListPageResult<T>>,
  options?: { pageSize?: number; maxPages?: number },
): Promise<T[]> {
  const pageSize = Math.min(
    Math.max(1, options?.pageSize ?? REPORT_API_MAX_PAGE_SIZE),
    REPORT_API_MAX_PAGE_SIZE,
  );
  const maxPages = options?.maxPages ?? 200;
  const all: T[] = [];
  let current = 1;

  for (let page = 0; page < maxPages; page += 1) {
    const res = await fetchPage({ current, page_size: pageSize });
    const items = extractItems(res);
    all.push(...items);
    if (items.length < pageSize) break;
    const total = extractTotal(res);
    if (typeof total === 'number' && all.length >= total) break;
    current += 1;
  }

  return all;
}
