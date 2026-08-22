/**
 * 瀑布流卡可见性：始终挂载全部卡片；无数据时由面板内 Empty / 空表文案展示。
 */
export function showMasonryCard(
  _loading?: boolean,
  _hasData?: boolean,
  _emptyFallback?: boolean,
): boolean {
  return true;
}

/** balanced 装箱权重：表/列表/动态按行数，封顶 8 */
export function masonryWeightFromRows(rowCount: number, cap = 8): number {
  return Math.min(cap, Math.max(1, rowCount));
}

/**
 * @deprecated 瀑布流卡不再按数据隐藏；保留 API 供各工作台页兼容调用。
 */
export function resolveMasonryEmptyFallback(
  _masonryLoading: boolean,
  _hasDataFlags: boolean[],
): boolean {
  return false;
}
