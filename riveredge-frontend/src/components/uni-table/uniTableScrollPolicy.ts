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
 * 规则：当前页未装满或空表 → natural-height；满页 → 视口限高 scroll.y。
 * ListPageTemplate 内外一致，不因模板类型特例。
 */
export function shouldUseUniTableNaturalHeight(input: UniTableScrollPolicyInput): boolean {
  if (input.allowCustomScrollY) return false
  if (input.virtualized || input.restTableVirtual) return false

  if (input.tableDataLength === 0 || input.tableDataLength < input.currentPageSize) {
    return true
  }

  return false
}

/** 是否向 ProTable 注入 scroll.y（限高模式） */
export function shouldEnableUniTableBodyScrollY(input: UniTableScrollPolicyInput): boolean {
  if (input.allowCustomScrollY && input.restTableScrollY != null) return true
  if (input.virtualized || input.restTableVirtual) return true
  return !shouldUseUniTableNaturalHeight(input)
}
