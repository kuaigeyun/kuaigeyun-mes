/** 图表卡装箱权重：约等于 6 行小表 + 240px 图区，与默认表卡封顶对齐 */
export const MASONRY_CHART_WEIGHT = 6;

/**
 * 瀑布流卡可见性：加载中挂载；有数据挂载；全无数据且 emptyFallback 时挂空白壳。
 */
export function showMasonryCard(
  loading?: boolean,
  hasData?: boolean,
  emptyFallback?: boolean,
): boolean {
  if (loading) return true;
  if (hasData) return true;
  return Boolean(emptyFallback);
}

/** balanced 装箱权重：表/列表/动态按行数，封顶 8 */
export function masonryWeightFromRows(rowCount: number, cap = 8): number {
  return Math.min(cap, Math.max(1, rowCount));
}

/** 全部卡加载结束且皆无数据时，仍挂空白壳避免事项区整块留白 */
export function resolveMasonryEmptyFallback(
  masonryLoading: boolean,
  hasDataFlags: boolean[],
): boolean {
  if (masonryLoading) return false;
  return !hasDataFlags.some(Boolean);
}
