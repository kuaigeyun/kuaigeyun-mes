/**
 * 瀑布流卡可见性：加载中可挂载；有数据可挂载；
 * 全部无数据时若 `emptyFallback` 为 true，仍挂载空白卡壳（避免事项区整块留白）。
 */
export function showMasonryCard(
  loading: boolean,
  hasData: boolean,
  emptyFallback = false,
): boolean {
  return loading || hasData || emptyFallback;
}

/** balanced 装箱权重：表/列表/动态按行数，封顶 8 */
export function masonryWeightFromRows(rowCount: number, cap = 8): number {
  return Math.min(cap, Math.max(1, rowCount));
}

/** 瀑布流相关请求均已结束且无一有数据 → 各卡 emptyFallback */
export function resolveMasonryEmptyFallback(
  masonryLoading: boolean,
  hasDataFlags: boolean[],
): boolean {
  return !masonryLoading && !hasDataFlags.some(Boolean);
}
