/**
 * 物料导入：解析 Excel 中的物料分组列（编号 / 代号 / 名称 / 列表展示文案）
 */

import type { MaterialGroup } from '../types/material';
import { formatMaterialGroupLabel } from '../types/material';

function norm(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * 将导入单元格值解析为物料分组；空值返回 null（表示不指定分组）。
 */
export function resolveMaterialGroupForImport(
  groupList: MaterialGroup[],
  raw: string,
): MaterialGroup | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  const lowered = norm(text);

  const byCode = groupList.find((g) => norm(g.code || '') === lowered);
  if (byCode) return byCode;

  const byAlias = groupList.find((g) => g.alias && norm(g.alias) === lowered);
  if (byAlias) return byAlias;

  const byName = groupList.find((g) => norm(g.name || '') === lowered);
  if (byName) return byName;

  const byLabel = groupList.find(
    (g) => formatMaterialGroupLabel(g) === text || norm(formatMaterialGroupLabel(g)) === lowered,
  );
  if (byLabel) return byLabel;

  const dashMatch = text.match(/^(.+?)\s*-\s*(.+)$/);
  if (dashMatch) {
    const prefix = dashMatch[1].trim();
    const namePart = dashMatch[2].trim();
    const prefixLower = norm(prefix);
    const nameLower = norm(namePart);
    const byParts = groupList.find((g) => {
      const codeMatch = norm(g.code || '') === prefixLower;
      const aliasMatch = g.alias ? norm(g.alias) === prefixLower : false;
      return (codeMatch || aliasMatch) && norm(g.name || '') === nameLower;
    });
    if (byParts) return byParts;
  }

  return null;
}

export function buildMaterialGroupImportOptions(groupList: MaterialGroup[]): string[] {
  return groupList
    .filter((g) => g.isActive !== false)
    .map((g) => formatMaterialGroupLabel(g))
    .filter(Boolean);
}
