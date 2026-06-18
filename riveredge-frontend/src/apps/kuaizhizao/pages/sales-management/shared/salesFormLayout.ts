/** 销售单据头表单 Row 间距（与 FormModalTemplate GRID_GUTTER 一致） */
export const SALES_FORM_ROW_GUTTER = 16;

/**
 * 24 栅格下均分 n 列的 span 数组。
 * 例：4 列 → [6,6,6,6]；5 列 → [5,5,5,5,4]（余数优先分给前几列）。
 */
export function salesFormEqualColSpans(columnCount: number): number[] {
  const base = Math.floor(24 / columnCount);
  const remainder = 24 % columnCount;
  return Array.from({ length: columnCount }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** 四列等分（各占 1/4） */
export const SALES_FORM_COL_SPAN_QUARTER = 6;
