import { listMolds, type MoldRow } from '../services/haoligo';

const PAGE_SIZE = 200;

/**
 * 模具选择弹窗：有 keyword 时走后端模糊查询；无 keyword 时分页拉全量（避免只取前 200 条导致搜不到）。
 */
export async function fetchMoldsForPicker(params: {
  status: string;
  keyword?: string;
}): Promise<MoldRow[]> {
  const status = params.status.trim();
  const kw = (params.keyword ?? '').trim();
  if (kw) {
    const res = await listMolds({ limit: PAGE_SIZE, skip: 0, status, keyword: kw });
    return res.items ?? [];
  }
  const out: MoldRow[] = [];
  let skip = 0;
  for (let guard = 0; guard < 500; guard++) {
    const res = await listMolds({ limit: PAGE_SIZE, skip, status });
    const batch = res.items ?? [];
    out.push(...batch);
    if (out.length >= res.total || batch.length === 0) break;
    skip += PAGE_SIZE;
  }
  return out;
}

export type MoldPrimaryLineItem = {
  mold_code?: string | null;
  mold_name?: string | null;
};

export type MoldPrimaryDisplayRow = {
  primary_mold_code?: string | null;
  primary_mold_name?: string | null;
  line_items?: MoldPrimaryLineItem[] | null;
};

/** 列表「首件模具」堆叠列：上行名称、下行编号 */
export function resolvePrimaryMoldStacked(row: MoldPrimaryDisplayRow): { name: string; code: string } {
  const lines = row.line_items || [];
  const primary = (row.primary_mold_code && String(row.primary_mold_code).trim()) || '';
  if (primary) {
    const hit = lines.find((it) => String(it.mold_code ?? '').trim() === primary);
    const fromHeader = (row.primary_mold_name || '').trim();
    const nm = fromHeader || (hit?.mold_name != null ? String(hit.mold_name).trim() : '');
    return { name: nm || '—', code: primary };
  }
  const first = lines.find((it) => String(it.mold_code ?? '').trim());
  if (!first) return { name: '—', code: '—' };
  const code = String(first.mold_code ?? '').trim();
  const nm = first.mold_name != null ? String(first.mold_name).trim() : '';
  return { name: nm || '—', code };
}
