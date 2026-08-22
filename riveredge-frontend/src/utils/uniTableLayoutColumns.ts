/**
 * UniTable 布局列（生命周期 / 操作）— 全局唯一宽度与识别约定
 *
 * 页面列定义禁止再写 lifecycle / operation 的 width（由 UniTable 注入）；
 * 审核 / 生命周期列不排序（UniTable 覆盖 sorter）。
 * 识别规则、宽度常量与 scroll.x 列宽贡献仅在此维护。
 */

import { isUniTableOperationColumn } from '../components/uni-action/operationColumn';
import { resolveRowActionInlineSlots } from '../components/uni-action/overflow';
import {
  LEGACY_LIST_LIFECYCLE_FIELD,
  LIST_LIFECYCLE_STAGE_FIELD,
} from './listLifecycleStage';

/**
 * 状态徽章列统一宽度：审核状态与执行状态（生命周期）等单徽章列共用这一个真源。
 * 两列必须等宽等对齐，各写各的数字就会漂移。消费方见
 * `sales-management/shared/listAuditPhaseColumn.tsx` 与本文件的生命周期列宽推导。
 * 审核 / 生命周期列不参与排序：UniTable 注入 `sorter: false`。
 */
export const UNI_TABLE_STATUS_BADGE_COLUMN_WIDTH = 80;

/**
 * 下推 / 交货 / 完成进度条列统一宽度。
 * 与状态徽章列同宽，便于右固定组与中间进度列视觉对齐；禁止页面另写数字。
 */
export const UNI_TABLE_PROGRESS_COLUMN_WIDTH = UNI_TABLE_STATUS_BADGE_COLUMN_WIDTH;

/**
 * 操作列宽度布局令牌（1280 视口 / small 表格 / type="link" + 图标，Playwright 实测）：
 * 单槽按**最宽单动作**预算——四字标签 92px（双字实测 64px），
 * 「更多」按钮 70px、Space 间距 4px、单元格左右内边距 8+8=16px。
 * 改令牌即同步改列宽；禁止在页面或引擎里另写数字。
 */
const ROW_ACTION_SLOT_PX = 92;
const ROW_ACTION_MORE_BTN_PX = 70;
const ROW_ACTION_GAP_PX = 4;
export const UNI_TABLE_OPERATION_CELL_PADDING_PX = 16;

/**
 * 操作列宽度的推导分两段，同属一条链、不是两个真源：
 *
 * 1. 首帧预算 `resolveUniTableOperationWidthForSlots`：还没有 DOM 可量时，按槽位契约
 *    取「每槽都是最宽单动作」的上界，保证首帧不裁剪内容。
 * 2. 最终真源 `resolveUniTableOperationWidthFromContent`：UniTable 在 useLayoutEffect
 *    里量出该列各行动作条的实际内容宽（取最大值），在浏览器绘制前替换掉预算。
 *
 * 只用第 1 段会让所有操作列一律按最坏情况撑宽（1280 视口下 374px，而两字三动作实际只要
 * 200px）；只用第 2 段则首帧无宽可用。列宽必须覆盖 nowrap 内容——否则内容溢出单元格、
 * 把滚动区 scrollWidth 撑得比表格宽，多出的滚动距离会把 sticky 右固定列拖离右缘，
 * 并在 scroll.y 的表头/表体双表结构下产生错位。
 */
export function resolveUniTableOperationWidthForSlots(slots: number): number {
  const controls = slots + 1; // 主行槽位 + 「更多」
  return (
    slots * ROW_ACTION_SLOT_PX +
    ROW_ACTION_MORE_BTN_PX +
    (controls - 1) * ROW_ACTION_GAP_PX +
    UNI_TABLE_OPERATION_CELL_PADDING_PX
  );
}

/** 实测动作条内容宽 → 列宽（`.uni-table-operation-actions` 为 max-content，不随列宽变化） */
export function resolveUniTableOperationWidthFromContent(contentPx: number): number {
  return Math.ceil(contentPx) + UNI_TABLE_OPERATION_CELL_PADDING_PX;
}

/** 单元格右内边距（堆叠主列实测已含左内边距与树形缩进，只需补右侧） */
const UNI_TABLE_CELL_TRAILING_PADDING_PX = 8;

/**
 * 堆叠主列（`uniTablePrimaryFlex`）的宽度下界 = 不可截断内容的实测宽度。
 *
 * 入参是「标识行右边缘 − 单元格左边缘」，因此天然含左内边距与树形缩进；
 * 主行文案可省略号截断，不计入下界。页面声明的 minWidth 只是首帧预算，
 * 实测值更大时以实测为准——否则单号会被压出单元格，画到相邻列上。
 */
export function resolveUniTablePrimaryFlexWidthFromContent(requiredPx: number): number {
  return Math.ceil(requiredPx) + UNI_TABLE_CELL_TRAILING_PADDING_PX;
}

/** 首帧预算宽度（directMax 未声明时的槽位契约结果） */
export const UNI_TABLE_OPERATION_MIN_WIDTH = resolveUniTableOperationWidthForSlots(
  resolveRowActionInlineSlots(),
);

/** 勾选列宽度（空表 scroll.x 求和） */
export const UNI_TABLE_SELECTION_COL_WIDTH = 48;

/** 展开列宽度（与 antd/rc-table expand 列一致；须计入 scroll.x，否则表头/表体错位叠字） */
export const UNI_TABLE_EXPAND_COL_WIDTH = 48;

/** 无 width/minWidth 时的回退列宽（空表 scroll.x 求和） */
export const UNI_TABLE_EMPTY_FALLBACK_COL_WIDTH = 120;

/** 浏览器原生纵向滚动条宽度（模块级一次性测量，用于 scroll.y 表头列宽预算） */
let uniTableVerticalScrollbarWidthCache: number | undefined;

export function getUniTableVerticalScrollbarWidth(): number {
  if (uniTableVerticalScrollbarWidthCache !== undefined) {
    return uniTableVerticalScrollbarWidthCache;
  }
  if (typeof document === 'undefined') {
    uniTableVerticalScrollbarWidthCache = 0;
    return 0;
  }
  const outer = document.createElement('div');
  outer.style.visibility = 'hidden';
  outer.style.overflow = 'scroll';
  outer.style.width = '100px';
  outer.style.height = '100px';
  outer.style.position = 'absolute';
  outer.style.top = '-9999px';
  document.body.appendChild(outer);
  const inner = document.createElement('div');
  inner.style.width = '100%';
  inner.style.height = '200px';
  outer.appendChild(inner);
  uniTableVerticalScrollbarWidthCache = Math.max(0, outer.offsetWidth - outer.clientWidth);
  document.body.removeChild(outer);
  return uniTableVerticalScrollbarWidthCache;
}

/** scroll.y 下列宽分配可用宽度：容器宽 − 纵向滚动条占位（首帧预算，禁止等表体挂载后再量） */
export function resolveUniTableColumnLayoutWidth(
  containerWidth: number,
  reserveVerticalScrollbar: boolean,
): number {
  if (containerWidth <= 0) return 0;
  if (!reserveVerticalScrollbar) return containerWidth;
  return Math.max(0, containerWidth - getUniTableVerticalScrollbarWidth());
}

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

/** 列表头表进度列：须 spread `DOCUMENT_PROGRESS_COLUMN_DEFAULTS`（含 uniTableProgressColumn） */
export function isUniTableProgressColumn(col: unknown): boolean {
  if (!col || typeof col !== 'object') return false;
  return (col as { uniTableProgressColumn?: unknown }).uniTableProgressColumn === true;
}

/** 明细表格下推进度列：须 spread `DETAIL_TABLE_PROGRESS_COLUMN_DEFAULTS`（含 uniTableDetailProgressColumn） */
export function isUniTableDetailProgressColumn(col: unknown): boolean {
  if (!col || typeof col !== 'object') return false;
  return (col as { uniTableDetailProgressColumn?: unknown }).uniTableDetailProgressColumn === true;
}

/** 明细表格下推进度列宽：与全局进度列同宽 */
export function resolveUniTableDetailProgressColumnWidth(): number {
  return UNI_TABLE_PROGRESS_COLUMN_WIDTH;
}

/** 列表头表进度列宽（下推 / 交货 / 完成进度） */
export function resolveUniTableProgressColumnWidth(): number {
  return UNI_TABLE_PROGRESS_COLUMN_WIDTH;
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

const AUDIT_PHASE_COLUMN_KEYS = new Set(['audit_phase']);

/** 审核状态列：key=audit_phase，或 dataIndex 为 audit.phase */
export function isUniTableAuditPhaseColumn(col: unknown): boolean {
  if (!col || typeof col !== 'object') return false;
  const c = col as { key?: unknown; dataIndex?: unknown };
  const key = String(c.key ?? '');
  const dataIndex = Array.isArray(c.dataIndex)
    ? c.dataIndex.join('.')
    : String(c.dataIndex ?? '');
  return AUDIT_PHASE_COLUMN_KEYS.has(key) || dataIndex === 'audit.phase';
}

/** 审核状态 + 生命周期：单徽章状态列（等宽、居中、不排序） */
export function isUniTableStatusBadgeColumn(col: unknown): boolean {
  return isUniTableLifecycleColumn(col) || isUniTableAuditPhaseColumn(col);
}

/** 生命周期（执行状态）列宽：与审核状态列同宽，无论是否右固定 */
export function resolveUniTableLifecycleColumnWidth(): number {
  return UNI_TABLE_STATUS_BADGE_COLUMN_WIDTH;
}

/**
 * 操作列注入 ProTable 的 width；非 fixed right 返回 undefined 由内容撑开。
 *
 * 唯一真源 = 该列自己的槽位契约（`uniActionRenderOptions.directMax` → 槽位数 → 宽度）。
 * 页面列定义里的 `width` / `minWidth` 一律忽略：它们与折叠契约无关，
 * 保留就会形成第二真源（页面写 200 而契约需要更宽 → 内容溢出撑坏滚动几何）。
 */
export function resolveUniTableOperationColumnWidth(col: {
  fixed?: unknown;
  uniActionRenderOptions?: unknown;
}): number | undefined {
  if (col.fixed !== 'right') return undefined;
  const options = col.uniActionRenderOptions;
  const slotOptions =
    options && typeof options === 'object'
      ? {
          directMax: (options as { directMax?: unknown }).directMax,
          minPrimaryVisible: (options as { minPrimaryVisible?: unknown }).minPrimaryVisible,
        }
      : undefined;
  const resolvedSlotOptions =
    slotOptions &&
    (typeof slotOptions.directMax === 'number' || typeof slotOptions.minPrimaryVisible === 'number')
      ? {
          ...(typeof slotOptions.directMax === 'number' ? { directMax: slotOptions.directMax } : {}),
          ...(typeof slotOptions.minPrimaryVisible === 'number'
            ? { minPrimaryVisible: slotOptions.minPrimaryVisible }
            : {}),
        }
      : undefined;
  return resolveUniTableOperationWidthForSlots(resolveRowActionInlineSlots(resolvedSlotOptions));
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
    return resolveUniTableLifecycleColumnWidth();
  }
  if (isUniTableProgressColumn(col) || isUniTableDetailProgressColumn(col)) {
    return resolveUniTableProgressColumnWidth();
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
  options?: { includeSelection?: boolean; includeExpandable?: boolean },
): number {
  let total = 0;
  if (options?.includeSelection) total += UNI_TABLE_SELECTION_COL_WIDTH;
  if (options?.includeExpandable) total += UNI_TABLE_EXPAND_COL_WIDTH;
  for (const col of columns) {
    total += getUniTableColumnScrollContribution(col);
  }
  return total;
}
