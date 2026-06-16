/** 主题字号范围（Slider 逐步 1px） */
export const THEME_FONT_SIZE_MIN = 12;
export const THEME_FONT_SIZE_MAX = 18;

/** 滑块刻度文案位置（仅展示标签，不影响可选步进） */
export const THEME_FONT_SIZE_MARKS = [12, 14, 16, 18] as const;

/** 将字号限制在 12–18px 整数 */
export function clampFontSize(value: unknown, fallback = 14): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(THEME_FONT_SIZE_MAX, Math.max(THEME_FONT_SIZE_MIN, Math.round(n)));
}

export function readFontSize(value: unknown, fallback = 14): number {
  return clampFontSize(value, fallback);
}
