/**
 * UniTable 表体纵向滚动唯一决策入口。
 *
 * 与以下配对，页面层不得再手写 scroll.y 或分散判断：
 * - `components/uni-table/index.tsx`（注入 scroll.y / natural-height class）
 * - `components/uni-table/uni-table.less`（natural / scrollY 唯一 CSS 控制面）
 * - `layout-templates/constants.ts`（`getListPageTableScrollOffsetPx` 视口扣减）
 */

export interface UniTableScrollPolicyInput {
  /** 白名单：页面显式传入 scroll.y 时由页面接管 */
  allowCustomScrollY: boolean
  /** 页面传入的 scroll.y（allowCustomScrollY 为 true 时生效） */
  restTableScrollY?: unknown
  /** 始终占满视口剩余高度（非报表；报表走 uniReportScrollPolicy） */
  fillViewportBody?: boolean
  /** 报表账表：不参与列表页 pageSize / vh 公式，限高只走 uniReportScrollPolicy */
  reportLayout?: boolean
  virtualized: boolean
  restTableVirtual: boolean
  /** 当前页表格行数（树表为根节点数） */
  tableDataLength: number
  /** 当前分页大小 */
  currentPageSize: number
  /** 列表 request 进行中：保持与满页一致的 scroll.y，避免 natural-height ↔ 限高切换 */
  requestInFlight?: boolean
}

/**
 * 是否使用 natural-height（不注入 scroll.y，关闭表体纵向滚动）。
 *
 * 规则：当前页未装满或空表 → 优先 natural-height；若实测内容高度超出视口，
 * 由 UniTable 的 `viewportScrollForced` 补开 scroll.y（见 measureTableBodyOverflowsViewport）。
 */
export function shouldUseUniTableNaturalHeight(input: UniTableScrollPolicyInput): boolean {
  if (input.reportLayout) return true
  if (input.fillViewportBody) return false
  if (input.allowCustomScrollY) return false
  if (input.virtualized || input.restTableVirtual) return false
  if (input.requestInFlight) return false

  if (input.tableDataLength === 0 || input.tableDataLength < input.currentPageSize) {
    return true
  }

  return false
}

/** 是否向 ProTable 注入 scroll.y（限高模式） */
export function shouldEnableUniTableBodyScrollY(input: UniTableScrollPolicyInput): boolean {
  if (input.reportLayout) return false
  if (input.fillViewportBody) return true
  if (input.allowCustomScrollY && input.restTableScrollY != null) return true
  if (input.virtualized || input.restTableVirtual) return true
  return !shouldUseUniTableNaturalHeight(input)
}

const VIEWPORT_SCROLL_MEASURE_BOTTOM_GAP_PX = 16
const VIEWPORT_SCROLL_MIN_AVAILABLE_PX = 80
const FILL_VIEWPORT_SCROLL_GAP_PX = 8
/** 分页尚未挂载时的占位（mini 行高 + margin-block 16×2） */
const FILL_VIEWPORT_PAGINATION_BLOCK_FALLBACK_PX = 56

function measureElementHeight(el: Element | null | undefined): number {
  if (!el) return 0
  return el.getBoundingClientRect().height
}

/** 含 margin-block 的占位高度（分页区须计入 margin，否则 scroll.y 过大裁切分页） */
function measureElementBlockHeight(el: Element | null | undefined): number {
  if (!el || !(el instanceof HTMLElement)) return 0
  const style = getComputedStyle(el)
  const marginTop = parseFloat(style.marginTop) || 0
  const marginBottom = parseFloat(style.marginBottom) || 0
  return el.getBoundingClientRect().height + marginTop + marginBottom
}

/**
 * fillViewportBody：按 UniTable 容器实测高度扣减工具栏/表头/吸底合计/分页，得到 scroll.y。
 * 避免 100vh 扣减未计入报表标题区与合计行导致分页挤出视口。
 */
export function measureFillViewportTableBodyScrollY(root: HTMLElement | null): number | undefined {
  if (!root) return undefined
  const total = root.clientHeight
  if (total <= 0) return undefined

  const wrapper = root.querySelector('.ant-table-wrapper') as HTMLElement | null
  if (!wrapper) return undefined

  let chrome = 0
  chrome += measureElementHeight(root.querySelector('.pro-table-button-container'))
  chrome += measureElementHeight(root.querySelector('.ant-pro-table-list-toolbar'))

  const cardBody = root.querySelector('.ant-pro-card-body') as HTMLElement | null
  if (cardBody) {
    const style = getComputedStyle(cardBody)
    chrome += parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
  }

  chrome += measureElementHeight(wrapper.querySelector('.ant-table-header'))
  chrome += measureElementHeight(wrapper.querySelector('.ant-table-summary'))
  const pager = root.querySelector('.ant-table-pagination')
  chrome += pager
    ? measureElementBlockHeight(pager)
    : FILL_VIEWPORT_PAGINATION_BLOCK_FALLBACK_PX

  return Math.max(
    VIEWPORT_SCROLL_MIN_AVAILABLE_PX,
    Math.floor(total - chrome - FILL_VIEWPORT_SCROLL_GAP_PX),
  )
}

/**
 * 实测表体是否超出可视区域（多行单元格、树表展开等）。
 * 返回 true 时应由 UniTable 强制开启 scroll.y。
 *
 * 限高后 antd 拆成 header/body 两张表：第一张 `.ant-table-tbody` 可能是表头占位，
 * 必须量 `.ant-table-body` 内的 tbody / scrollHeight。即便量准，调用方也不得
 * 在已限高时仅凭一次 false 关回 natural（列宽/loading 重跑会形成 React #185）。
 */
export function measureTableBodyOverflowsViewport(root: HTMLElement | null): boolean {
  if (!root || typeof window === 'undefined') return false
  const tableWrapper = root.querySelector('.ant-table-wrapper')
  if (!tableWrapper) return false

  const scrollBody = root.querySelector('.ant-table-body') as HTMLElement | null
  const tbody = (scrollBody?.querySelector('.ant-table-tbody') ??
    root.querySelector('.ant-table-tbody')) as HTMLElement | null
  if (!tbody) return false

  const pager = root.querySelector('.ant-table-pagination') as HTMLElement | null
  const header = root.querySelector('.ant-table-thead') as HTMLElement | null
  const headerBottom =
    header?.getBoundingClientRect().bottom ?? tableWrapper.getBoundingClientRect().top
  const pagerHeight = pager?.offsetHeight ?? 56
  const available = window.innerHeight - headerBottom - pagerHeight - VIEWPORT_SCROLL_MEASURE_BOTTOM_GAP_PX
  const content = scrollBody ? scrollBody.scrollHeight : tbody.scrollHeight
  return content > available && available > VIEWPORT_SCROLL_MIN_AVAILABLE_PX
}
