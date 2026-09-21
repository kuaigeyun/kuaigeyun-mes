/** 外推配置层：只列已连接应用。目录存在不等于可写回。 */

export const CONNECTOR_CATEGORY_ORDER = [
  'collaboration',
  'erp',
  'plm',
  'crm',
  'oa',
  'wms',
  'iot',
  'storage',
  'ai',
  'other',
] as const;

export interface ConnectedAppRow {
  key: string;
  categoryKey: string;
  displayName: string;
  pushRegistered: boolean;
}

/** @deprecated 品类卡片网格已弃用；保留导出以免外部引用断裂。 */
export interface ConnectorCategoryGroup {
  key: string;
  connections: number;
  pushRegistered: boolean;
}

/** @deprecated 改用 buildConnectedAppRows。 */
export function buildConnectorCategoryGroups(input: {
  categories?: Array<{ key: string }> | null;
  definitions?: Array<{ type: string; category: string }> | null;
  connections?: Array<{ type: string; is_active?: boolean }> | null;
  writableCategories?: Iterable<string> | null;
}): ConnectorCategoryGroup[] {
  const rows = buildConnectedAppRows(input);
  const counts = new Map<string, number>();
  const writable = new Set(
    [...(input.writableCategories || [])].map((key) => String(key || '').trim()).filter(Boolean),
  );
  for (const row of rows) {
    counts.set(row.categoryKey, (counts.get(row.categoryKey) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => categorySortIndex(a[0]) - categorySortIndex(b[0]))
    .map(([key, connections]) => ({
      key,
      connections,
      pushRegistered: writable.has(key),
    }));
}

function categorySortIndex(key: string): number {
  const idx = CONNECTOR_CATEGORY_ORDER.indexOf(key as (typeof CONNECTOR_CATEGORY_ORDER)[number]);
  return idx === -1 ? 999 : idx;
}

/**
 * 仅输出已接通的应用连接行。
 * is_active 且 is_connected；未连接品类/预设不占位。
 */
export function buildConnectedAppRows(input: {
  definitions?: Array<{ type: string; category: string }> | null;
  connections?: Array<{
    uuid?: string;
    code?: string;
    name?: string;
    type?: string;
    is_active?: boolean;
    is_connected?: boolean;
  }> | null;
  writableCategories?: Iterable<string> | null;
}): ConnectedAppRow[] {
  const typeToCategory = new Map<string, string>();
  for (const definition of input.definitions || []) {
    const type = String(definition.type || '').trim();
    const category = String(definition.category || '').trim();
    if (type && category && category !== 'all') {
      typeToCategory.set(type, category);
    }
  }
  const writable = new Set(
    [...(input.writableCategories || [])].map((key) => String(key || '').trim()).filter(Boolean),
  );

  const rows: ConnectedAppRow[] = [];
  for (const connection of input.connections || []) {
    if (connection.is_active === false) continue;
    if (connection.is_connected !== true) continue;
    const type = String(connection.type || '').trim();
    const categoryKey = typeToCategory.get(type) || 'other';
    const displayName =
      String(connection.name || '').trim() ||
      String(connection.code || '').trim() ||
      type ||
      '—';
    const key =
      String(connection.uuid || '').trim() ||
      String(connection.code || '').trim() ||
      `${type}:${displayName}`;
    rows.push({
      key,
      categoryKey,
      displayName,
      pushRegistered: writable.has(categoryKey),
    });
  }

  return rows.sort((a, b) => {
    const byCat = categorySortIndex(a.categoryKey) - categorySortIndex(b.categoryKey);
    if (byCat !== 0) return byCat;
    return a.displayName.localeCompare(b.displayName, 'zh');
  });
}
