/** 主题圆角范围（Slider 逐步 1px） */
export const THEME_BORDER_RADIUS_MIN = 0;
export const THEME_BORDER_RADIUS_MAX = 16;

/** 滑块刻度文案位置（仅展示标签，不影响可选步进） */
export const THEME_BORDER_RADIUS_MARKS = [0, 8, 16] as const;

/** 将圆角限制在 0–16px 整数（保留 0） */
export function clampBorderRadius(value: unknown, fallback = 8): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(THEME_BORDER_RADIUS_MAX, Math.max(THEME_BORDER_RADIUS_MIN, Math.round(n)));
}

export function readBorderRadius(value: unknown, fallback = 8): number {
  return clampBorderRadius(value, fallback);
}

/** UniTabs 标签圆角下限：系统圆角低于此值时仍保留最小圆角 */
export const UNI_TABS_BORDER_RADIUS_MIN = 4;

/** 标签顶角 / 底内凹：max(4px, 系统 borderRadius) */
export function readUniTabsBorderRadius(value: unknown, fallback = 8): number {
  return Math.max(UNI_TABS_BORDER_RADIUS_MIN, readBorderRadius(value, fallback));
}
