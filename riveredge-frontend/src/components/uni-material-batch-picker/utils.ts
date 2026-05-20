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
      key: `g-${id}-${idx}`,
      title: [code, name].filter(Boolean).join(' ') || String(id),
      children: childrenRaw?.length ? mapMaterialGroupTree(childrenRaw) : undefined,
    };
    return node;
  });
}
