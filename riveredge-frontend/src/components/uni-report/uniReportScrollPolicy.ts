/**
 * 报表表体限高唯一真源。
 *
 * 两种 DOM 形态（不是两套公式）：
 * - 有固定合计：表体下有合计行 + 分页
 * - 无合计：表体下只有分页
 *
 * 表体下占位 = 托盘底 − 表体底（当时已挂上的合计/分页都在这段里）。
 * 不因合计或分页尚未出现而推迟整表布局。
 *
 *   滚动口内容底 = port.top + clientTop + clientHeight
 *   表体边框盒可用 = 滚动口内容底 − 表体顶 − 表体下占位
 *   scroll.y = 该边框盒按 box-sizing 换成 maxHeight
 */

export type UniReportScrollMode = 'withFixedSummary' | 'withoutSummary';

export function resolveUniReportScrollMode(hasFixedSummary: boolean): UniReportScrollMode {
  return hasFixedSummary ? 'withFixedSummary' : 'withoutSummary';
}

function findVerticalScrollPort(el: HTMLElement): HTMLElement {
  let current: HTMLElement | null = el.parentElement;
  while (current) {
    const overflowY = getComputedStyle(current).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return current;
    }
    current = current.parentElement;
  }
  return document.documentElement;
}

function measureContentBottom(el: HTMLElement): number {
  return el.getBoundingClientRect().top + el.clientTop + el.clientHeight;
}

function measureVerticalChrome(el: HTMLElement): number {
  const style = getComputedStyle(el);
  return (
    parseFloat(style.borderTopWidth) +
    parseFloat(style.borderBottomWidth) +
    parseFloat(style.paddingTop) +
    parseFloat(style.paddingBottom)
  );
}

/** rc-table 把 scroll.y 写到 maxHeight；content-box 时边框/内边距不在 maxHeight 里 */
function toScrollYMaxHeight(body: HTMLElement, borderBoxHeight: number): number {
  const style = getComputedStyle(body);
  if (style.boxSizing === 'border-box') {
    return borderBoxHeight;
  }
  return borderBoxHeight - measureVerticalChrome(body);
}

export type UniReportTableScrollMeasure = {
  mode: UniReportScrollMode;
  contentPx: number;
  availableBorderBoxPx: number;
  belowBodyPx: number;
};

export function measureUniReportTableScroll(
  root: HTMLElement | null,
  hasFixedSummary: boolean,
): UniReportTableScrollMeasure | undefined {
  if (!root || typeof window === 'undefined') return undefined;

  const tray = root.querySelector('.ant-pro-card') as HTMLElement | null;
  const body =
    (root.querySelector('.ant-table-body') as HTMLElement | null) ??
    (root.querySelector('.ant-table-tbody') as HTMLElement | null);
  if (!tray || !body) return undefined;

  const belowBodyPx = tray.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom;
  const availableBorderBoxPx =
    measureContentBottom(findVerticalScrollPort(root)) - body.getBoundingClientRect().top - belowBodyPx;
  if (availableBorderBoxPx <= 0) return undefined;

  return {
    mode: resolveUniReportScrollMode(hasFixedSummary),
    contentPx: body.scrollHeight,
    availableBorderBoxPx,
    belowBodyPx,
  };
}

export function resolveUniReportTableBodyScrollY(
  root: HTMLElement | null,
  hasFixedSummary: boolean,
): number | undefined {
  const measure = measureUniReportTableScroll(root, hasFixedSummary);
  if (!measure) return undefined;
  if (measure.contentPx <= measure.availableBorderBoxPx) return undefined;

  const body =
    (root?.querySelector('.ant-table-body') as HTMLElement | null) ??
    (root?.querySelector('.ant-table-tbody') as HTMLElement | null);
  if (!body) return undefined;

  const next = toScrollYMaxHeight(body, measure.availableBorderBoxPx);
  return next > 0 ? next : undefined;
}
