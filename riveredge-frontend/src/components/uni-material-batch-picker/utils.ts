import { apiRequest } from '../../services/api';

/** 批量获取物料可用库存汇总 */
export async function fetchBatchMaterialInventory(
  materialIds: number[],
): Promise<Record<number, number>> {
  if (materialIds.length === 0) return {};
  try {
    const res = await apiRequest<{ material_totals?: Record<string, number> }>(
      '/apps/kuaizhizao/reports/inventory/batch-query',
      {
        method: 'GET',
        params: {
          material_ids: materialIds,
          summary_only: true,
          include_expired: false,
        },
      },
    );
    const totals = res?.material_totals ?? {};
    const result: Record<number, number> = {};
    for (const [k, v] of Object.entries(totals)) {
      const id = parseInt(k, 10);
      if (!Number.isNaN(id)) result[id] = Number(v) || 0;
    }
    for (const id of materialIds) {
      if (!(id in result)) result[id] = 0;
    }
    return result;
  } catch {
    return {};
  }
}

/** 批量检查物料是否有 BOM */
export async function fetchBatchMaterialHasBom(
  materialIds: number[],
): Promise<Record<number, boolean>> {
  if (materialIds.length === 0) return {};
  try {
    const res = await apiRequest<Record<string, boolean>>(
      '/apps/master-data/materials/bom/batch-check',
      {
        method: 'GET',
        params: { material_ids: materialIds, only_active: true },
      },
    );
    const result: Record<number, boolean> = {};
    for (const [k, v] of Object.entries(res ?? {})) {
      const id = parseInt(k, 10);
      if (!Number.isNaN(id)) result[id] = !!v;
    }
    for (const id of materialIds) {
      if (!(id in result)) result[id] = false;
    }
    return result;
  } catch {
    return {};
  }
}

export function getMaterialField(m: Record<string, unknown>, field: string): unknown {
  let v = m[field];
  if (v !== undefined && v !== null) return v;
  const snake = field.replace(/([A-Z])/g, '_$1').toLowerCase();
  return m[snake];
}

export type MaterialGroupTreeNode = { title: string; value: number; key: string; children?: MaterialGroupTreeNode[] };

export function mapMaterialGroupTree(nodes: unknown[]): MaterialGroupTreeNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((raw, idx) => {
    const n = raw as Record<string, unknown>;
    const id = (n.id as number) ?? 0;
    const code = String(n.code ?? '');
    const name = String(n.name ?? '');
    const childrenRaw = n.children as unknown[] | undefined;
    const node: MaterialGroupTreeNode = {
      value: id,
      key: String(id),
      title: [code, name].filter(Boolean).join(' ') || String(id),
      children: childrenRaw?.length ? mapMaterialGroupTree(childrenRaw) : undefined,
    };
    return node;
  });
}
