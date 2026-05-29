/**
 * UniTable 布局列（生命周期 / 操作）— 全局唯一宽度与识别约定
 *
 * 页面列定义禁止再写 lifecycle / operation 的 width（由 UniTable 注入）；
 * 识别规则、宽度常量与 scroll.x 列宽贡献仅在此维护。
 */

import { isUniTableOperationColumn } from '../components/uni-action/operationColumn';
import {
  LEGACY_LIST_LIFECYCLE_FIELD,
  LIST_LIFECYCLE_STAGE_FIELD,
} from './listLifecycleStage';

/** 生命周期列：非 fixed 时的收缩锚点（配合 minWidth + CSS fit-content） */
export const UNI_TABLE_LIFECYCLE_WIDTH_ANCHOR = 1;

/** 生命周期列最小宽度 */
export const UNI_TABLE_LIFECYCLE_MIN_WIDTH = 80;

/** 操作列最小宽度 */
export const UNI_TABLE_OPERATION_MIN_WIDTH = 120;

/** 勾选列宽度（空表 scroll.x 求和） */
export const UNI_TABLE_SELECTION_COL_WIDTH = 48;

/** 无 width/minWidth 时的回退列宽（空表 scroll.x 求和） */
export const UNI_TABLE_EMPTY_FALLBACK_COL_WIDTH = 120;

/** 生命周期列：fixed right 时表头/表身额外 class（避免 1px 收缩锚点 CSS 与操作列重叠） */
export const UNI_TABLE_LIFECYCLE_FIXED_RIGHT_CELL_CLASS = 'uni-table-lifecycle-fixed-right';

const LIFECYCLE_COLUMN_KEYS = new Set([
  'lifecycle',
  LIST_LIFECYCLE_STAGE_FIELD,
  LEGACY_LIST_LIFECYCLE_FIELD,
]);

function parseUniTableColumnWidth(width: unknown): number | undefined {
  if (typeof width === 'number' && Number.isFinite(width)) return width;
  if (typeof width === 'string') {
    const n = parseInt(width, 10);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function isUniTableLifecycleColumnFixedRight(col: unknown): boolean {
  if (!col || typeof col !== 'object') return false;
  return (col as { fixed?: unknown }).fixed === 'right';
}

/** 与 UniTable 内生命周期列判定一致（key 或 dataIndex） */
export function isUniTableLifecycleColumn(col: unknown): boolean {
  if (!col || typeof col !== 'object') return false;
  const c = col as { key?: unknown; dataIndex?: unknown };
  const key = String(c.key ?? c.dataIndex ?? '');
  const dataIndex = Array.isArray(c.dataIndex)
    ? c.dataIndex.join('.')
    : String(c.dataIndex ?? '');
  return (
    LIFECYCLE_COLUMN_KEYS.has(key) ||
    LIFECYCLE_COLUMN_KEYS.has(dataIndex)
  );
}

/** 生命周期列注入 ProTable 的 width（fixed right 须用 minWidth，否则固定列定位重叠） */
export function resolveUniTableLifecycleColumnWidth(col: { fixed?: unknown }): number {
  if (isUniTableLifecycleColumnFixedRight(col)) {
    return UNI_TABLE_LIFECYCLE_MIN_WIDTH;
  }
  return UNI_TABLE_LIFECYCLE_WIDTH_ANCHOR;
}

/** 操作列注入 ProTable 的 width；非 fixed right 返回 undefined 由内容撑开 */
export function resolveUniTableOperationColumnWidth(col: {
  width?: unknown;
  minWidth?: unknown;
  fixed?: unknown;
}): number | undefined {
  if (col.fixed !== 'right') return undefined;
  const pageWidth = parseUniTableColumnWidth(col.width);
  const minWidth = parseUniTableColumnWidth(col.minWidth) ?? UNI_TABLE_OPERATION_MIN_WIDTH;
  return Math.max(pageWidth ?? 0, minWidth);
}

export function getUniTableLifecycleCellClassName(col: { fixed?: unknown }): string {
  return isUniTableLifecycleColumnFixedRight(col)
    ? `uni-table-lifecycle-cell ${UNI_TABLE_LIFECYCLE_FIXED_RIGHT_CELL_CLASS}`
    : 'uni-table-lifecycle-cell';
}

/**
 * 单列对 scroll.x 的宽度贡献（空表 + 固定列时求和）。
 */
export function getUniTableColumnScrollContribution(col: unknown): number {
  if (!col || typeof col !== 'object') return UNI_TABLE_EMPTY_FALLBACK_COL_WIDTH;
  const c = col as { hideInTable?: boolean; width?: unknown; minWidth?: unknown; fixed?: unknown };
  if (c.hideInTable) return 0;

  if (isUniTableLifecycleColumn(col)) {
    const resolved = parseUniTableColumnWidth(c.width);
    if (resolved != null && resolved >= UNI_TABLE_LIFECYCLE_MIN_WIDTH) return resolved;
    return resolveUniTableLifecycleColumnWidth(c);
  }
  if (isUniTableOperationColumn(col)) {
    const resolved = parseUniTableColumnWidth(c.width);
    if (resolved != null && resolved > 0) return resolved;
    return resolveUniTableOperationColumnWidth(c) ?? UNI_TABLE_OPERATION_MIN_WIDTH;
  }

  const width = parseUniTableColumnWidth(c.width);
  const minWidth = parseUniTableColumnWidth(c.minWidth);
  if (width != null && minWidth != null && width < minWidth) {
    return minWidth;
  }
  return width ?? minWidth ?? UNI_TABLE_EMPTY_FALLBACK_COL_WIDTH;
}

/** 空表 + 固定列：按列宽求和得到 scroll.x，保证表头与固定列对齐（antd 固定列依赖 scroll.x）。 */
export function computeUniTableMinScrollX(
  columns: readonly unknown[],
  options?: { includeSelection?: boolean },
): number {
  let total = options?.includeSelection ? UNI_TABLE_SELECTION_COL_WIDTH : 0;
  for (const col of columns) {
    total += getUniTableColumnScrollContribution(col);
  }
  return total;
}
