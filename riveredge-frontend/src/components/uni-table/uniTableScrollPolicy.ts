/**
 * UniTable 表体纵向滚动唯一决策入口。
 *
 * 与以下配对，页面层不得再手写 scroll.y 或分散判断：
 * - `components/uni-table/index.tsx`（注入 scroll.y / natural-height class）
 * - `global.less`（`.uni-table-natural-height` / `.uni-table-scroll-y-mode`）
 * - `layout-templates/constants.ts`（`getListPageTableScrollOffsetPx` 视口扣减）
 */

export interface UniTableScrollPolicyInput {
  /** 白名单：页面显式传入 scroll.y 时由页面接管 */
  allowCustomScrollY: boolean
  /** 页面传入的 scroll.y（allowCustomScrollY 为 true 时生效） */
  restTableScrollY?: unknown
  /** 始终占满视口剩余高度（报表等场景，忽略「当前页未装满」natural-height 规则） */
  fillViewportBody?: boolean
  virtualized: boolean
  restTableVirtual: boolean
  /** 当前页表格行数（树表为根节点数） */
  tableDataLength: number
  /** 当前分页大小 */
  currentPageSize: number
}

/**
 * 是否使用 natural-height（不注入 scroll.y，关闭表体纵向滚动）。
 *
 * 规则：当前页未装满或空表 → 优先 natural-height；若实测内容高度超出视口，
 * 由 UniTable 的 `viewportScrollForced` 补开 scroll.y（见 measureTableBodyOverflowsViewport）。
 */
export function shouldUseUniTableNaturalHeight(input: UniTableScrollPolicyInput): boolean {
  if (input.fillViewportBody) return false
  if (input.allowCustomScrollY) return false
  if (input.virtualized || input.restTableVirtual) return false

  if (input.tableDataLength === 0 || input.tableDataLength < input.currentPageSize) {
    return true
  }

  return false
}

/** 是否向 ProTable 注入 scroll.y（限高模式） */
export function shouldEnableUniTableBodyScrollY(input: UniTableScrollPolicyInput): boolean {
  if (input.fillViewportBody) return true
  if (input.allowCustomScrollY && input.restTableScrollY != null) return true
  if (input.virtualized || input.restTableVirtual) return true
  return !shouldUseUniTableNaturalHeight(input)
}

const VIEWPORT_SCROLL_MEASURE_BOTTOM_GAP_PX = 16
const VIEWPORT_SCROLL_MIN_AVAILABLE_PX = 80

/**
 * natural-height 模式下实测表体是否超出可视区域（多行单元格、树表展开等）。
 * 返回 true 时应由 UniTable 强制开启 scroll.y。
 */
export function measureTableBodyOverflowsViewport(root: HTMLElement | null): boolean {
  if (!root || typeof window === 'undefined') return false
  const tableWrapper = root.querySelector('.ant-table-wrapper')
  const tbody = root.querySelector('.ant-table-tbody')
  if (!tableWrapper || !tbody) return false

  const pager = root.querySelector('.ant-table-pagination') as HTMLElement | null
  const header = root.querySelector('.ant-table-thead') as HTMLElement | null
  const headerBottom =
    header?.getBoundingClientRect().bottom ?? tableWrapper.getBoundingClientRect().top
  const pagerHeight = pager?.offsetHeight ?? 56
  const available = window.innerHeight - headerBottom - pagerHeight - VIEWPORT_SCROLL_MEASURE_BOTTOM_GAP_PX
  const content = (tbody as HTMLElement).scrollHeight
  return content > available && available > VIEWPORT_SCROLL_MIN_AVAILABLE_PX
}
