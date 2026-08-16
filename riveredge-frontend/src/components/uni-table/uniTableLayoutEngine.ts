/**
 * UniTable 布局唯一真源：列宽策略、scroll.x、primary 分配、columnsState、固定列契约。
 * index.tsx 只消费 resolveLayoutPlan / columnsState 工具，禁止再散落布局计算。
 *
 * 固定列（对齐 antd 原生 sticky 实现，禁止第二套 DOM/CSS 补丁）：
 * 1. 列上声明 `fixed: 'left'|'right'` + 引擎产出数值 `scroll.x`（及显式 width）
 * 2. 左固定连续置前、右固定连续垫后（下推进度 → 执行状态 → 操作），避免 hasGapFixed
 * 3. columnsState 不可改写代码声明的 fixed
 * 4. 不强制 Table `sticky` prop（那是页内粘性表头，与列固定无关）
 */

import type { ColumnsState } from '@ant-design/pro-table'
import { isUniTableOperationColumn } from '../uni-action/operationColumn'
import {
  computeUniTableMinScrollX,
  getUniTableColumnScrollContribution,
  getUniTableVerticalScrollbarWidth,
  isUniTableDetailProgressColumn,
  isUniTableLifecycleColumn,
  isUniTableProgressColumn,
  resolveUniTableColumnLayoutWidth,
  UNI_TABLE_EMPTY_FALLBACK_COL_WIDTH,
} from '../../utils/uniTableLayoutColumns'

export type UniTableLayoutMode = 'natural' | 'scrollY'

export type UniTableLayoutPlan = {
  columns: Record<string, unknown>[]
  scrollX: number
  mode: UniTableLayoutMode
  scrollbarSlotPx: number
}

/** 与 ProTable genColumnKey / 列设置持久化 key 一致 */
export function getProColumnStateKey(col: unknown, columnIndex: number): string {
  if (!col || typeof col !== 'object') return String(columnIndex)
  const c = col as { key?: unknown; dataIndex?: unknown }
  const key = c.key ?? c.dataIndex
  if (key != null && key !== '') {
    return Array.isArray(key) ? key.join('-') : String(key)
  }
  return String(columnIndex)
}

function parseUniTableColumnWidthValue(width: unknown): number | undefined {
  if (typeof width === 'number' && Number.isFinite(width)) return width
  if (typeof width === 'string') {
    const n = parseInt(width, 10)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

/** 短人名类字段保留页面 width，不做内容撑宽 */
const UNI_TABLE_SHORT_NAME_FIELDS = new Set([
  'salesman_name',
  'buyer_name',
  'operator_name',
  'user_name',
  'creator_name',
  'updater_name',
  'auditor_name',
])

const UNI_TABLE_STRUCTURED_VALUE_TYPES = new Set([
  'date',
  'dateTime',
  'dateRange',
  'time',
  'money',
  'digit',
  'digitRange',
  'select',
  'progress',
  'index',
  'indexBorder',
])

/** 与 stackedPrimaryColumn UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS 一致 */
const UNI_TABLE_PRIMARY_FLEX_DEFAULT_WIDTH = 200
const UNI_TABLE_PRIMARY_FLEX_DEFAULT_MAX_WIDTH = 280

function isUniTableLayoutColumn(col: Record<string, unknown>): boolean {
  return (
    col.hideInTable === true ||
    isUniTableOperationColumn(col) ||
    isUniTableLifecycleColumn(col) ||
    isUniTableProgressColumn(col) ||
    isUniTableDetailProgressColumn(col)
  )
}

/** 右固定组内顺序：其它 right → 下推进度 → 执行状态 → 操作 */
function getUniTableRightFixedOrderRank(col: Record<string, unknown>): number {
  if (isUniTableOperationColumn(col)) return 3
  if (isUniTableLifecycleColumn(col)) return 2
  if (isUniTableDetailProgressColumn(col)) return 1
  return 0
}

/**
 * 明细表格：下推进度须紧邻执行状态左侧（数组顺序 + columnsState order 双保险）。
 */
export function ensureDetailProgressImmediatelyBeforeLifecycle<T extends Record<string, unknown>>(
  columns: T[],
): T[] {
  if (!columns?.length) return columns
  const progressIdx = columns.findIndex((c) => isUniTableDetailProgressColumn(c))
  const lifecycleIdx = columns.findIndex((c) => isUniTableLifecycleColumn(c))
  if (progressIdx < 0 || lifecycleIdx < 0 || progressIdx === lifecycleIdx - 1) return columns
  const progressCol = columns[progressIdx]
  const rest = columns.filter((_, i) => i !== progressIdx)
  const insertAt = rest.findIndex((c) => isUniTableLifecycleColumn(c))
  if (insertAt < 0) return columns
  return [...rest.slice(0, insertAt), progressCol, ...rest.slice(insertAt)]
}

/** 强制下推进度 order 小于执行状态（columnsMap 真源） */
function enforceProgressLifecyclePairOrderInColumnsState(
  map: Record<string, ColumnsState>,
  columns: Record<string, unknown>[],
): void {
  let progressKey: string | undefined
  let lifecycleKey: string | undefined
  const operationKeys: string[] = []
  const otherRightKeys: string[] = []

  columns.forEach((col, index) => {
    if (col.hideInTable || col.fixed !== 'right') return
    const columnKey = getProColumnStateKey(col, index)
    if (isUniTableDetailProgressColumn(col)) {
      progressKey = columnKey
      return
    }
    if (isUniTableLifecycleColumn(col)) {
      lifecycleKey = columnKey
      return
    }
    if (isUniTableOperationColumn(col)) {
      operationKeys.push(columnKey)
      return
    }
    otherRightKeys.push(columnKey)
  })

  if (!progressKey || !lifecycleKey) return

  let order = UNI_TABLE_CODE_OWNED_RIGHT_ORDER_BASE
  for (const k of otherRightKeys) {
    map[k] = {
      ...map[k],
      show: map[k]?.show ?? true,
      fixed: 'right',
      order: order++,
    }
  }
  map[progressKey] = {
    ...map[progressKey],
    show: map[progressKey]?.show ?? true,
    fixed: 'right',
    order: order++,
  }
  map[lifecycleKey] = {
    ...map[lifecycleKey],
    show: map[lifecycleKey]?.show ?? true,
    fixed: 'right',
    order: order++,
  }
  for (const k of operationKeys) {
    map[k] = {
      ...map[k],
      show: map[k]?.show ?? true,
      fixed: 'right',
      order: order++,
    }
  }
}

function isUniTableFlexTextColumn(col: Record<string, unknown>): boolean {
  if (isUniTableLayoutColumn(col)) return false
  if (col.fixed) return false
  if (col.resizable === false || col.uniTableKeepWidth === true) return false

  const dataIndex = typeof col.dataIndex === 'string' ? col.dataIndex : ''
  if (!dataIndex) return false
  if (UNI_TABLE_SHORT_NAME_FIELDS.has(dataIndex)) return false
  if (col.valueType && UNI_TABLE_STRUCTURED_VALUE_TYPES.has(String(col.valueType))) return false
  if (/(^code$|_code$)/.test(dataIndex)) return false
  if (/(^unit$|_unit$)/.test(dataIndex)) return false

  if (
    /_(name|title|remark|description|desc|note|notes|comment|address|specification)$|^(name|title|remark|description|note|comment)$/.test(
      dataIndex,
    )
  ) {
    return true
  }

  return col.ellipsis === true && !col.valueType
}

function isUniTablePrimaryFlexColumn(col: Record<string, unknown>): boolean {
  return col.uniTablePrimaryFlex === true
}

function resolveUniTablePrimaryFlexMaxWidth(col: Record<string, unknown>): number {
  const fromCol =
    parseUniTableColumnWidthValue(col.uniTablePrimaryFlexMaxWidth) ??
    parseUniTableColumnWidthValue(col.maxWidth)
  if (fromCol != null && fromCol > 0) return fromCol
  return UNI_TABLE_PRIMARY_FLEX_DEFAULT_MAX_WIDTH
}

/**
 * 列宽物化（首帧 table-layout:fixed）：主文本 / primaryFlex 写入显式 width。
 * 仅由 resolveLayoutPlan 调用。
 */
export function applyColumnWidthPolicy(
  columns: Record<string, unknown>[],
  preserveWidths = false,
): Record<string, unknown>[] {
  if (!columns?.length || preserveWidths) return columns

  return columns.map((col) => {
    if (isUniTableLayoutColumn(col)) return col
    if (col.width != null) return col

    if (isUniTableFlexTextColumn(col) || isUniTablePrimaryFlexColumn(col)) {
      const resolved =
        parseUniTableColumnWidthValue(col.minWidth) ??
        (isUniTablePrimaryFlexColumn(col)
          ? UNI_TABLE_PRIMARY_FLEX_DEFAULT_WIDTH
          : UNI_TABLE_EMPTY_FALLBACK_COL_WIDTH)
      return { ...col, width: resolved, minWidth: resolved }
    }

    const minW = parseUniTableColumnWidthValue(col.minWidth)
    if (minW != null) return { ...col, width: minW }

    return col
  })
}

function applyPrimaryFlexWidthPatch(
  columns: Record<string, unknown>[],
  containerWidth: number,
  options: {
    includeSelection: boolean
    includeExpandable?: boolean
    reserveVerticalScrollbar: boolean
  },
): Record<string, unknown>[] {
  if (containerWidth <= 0 || !columns?.length) return columns

  const layoutWidth = resolveUniTableColumnLayoutWidth(
    containerWidth,
    options.reserveVerticalScrollbar,
  )
  if (layoutWidth <= 0) return columns

  const baseScrollX = computeUniTableMinScrollX(columns, {
    includeSelection: options.includeSelection,
    includeExpandable: options.includeExpandable === true,
  })
  if (layoutWidth <= baseScrollX) return columns

  const flexTargets: { index: number; base: number; max: number }[] = []
  columns.forEach((col, index) => {
    if (col?.hideInTable || !isUniTablePrimaryFlexColumn(col)) return
    flexTargets.push({
      index,
      base: getUniTableColumnScrollContribution(col),
      max: resolveUniTablePrimaryFlexMaxWidth(col),
    })
  })
  if (flexTargets.length === 0) return columns

  let remaining = layoutWidth - baseScrollX
  if (remaining <= 0) return columns

  const next = columns.map((col) => ({ ...col }))
  for (const { index, base, max } of flexTargets) {
    const expandable = Math.max(0, max - base)
    const add = Math.min(remaining, expandable)
    if (add > 0) {
      next[index] = { ...next[index], width: base + add }
      remaining -= add
    }
  }
  // 余量必须受 uniTablePrimaryFlexMaxWidth 约束；禁止再把剩余像素无上限灌进首列，
  // 否则所有使用 UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS 的物料/主列会被撑到半屏。
  return next
}

export interface ResolveLayoutPlanInput {
  columns: Record<string, unknown>[]
  containerWidth: number
  includeSelection: boolean
  /** 存在 expandable 时须计入展开列，否则 scroll.x 偏短 → 表头/表体列错位 */
  includeExpandable?: boolean
  scrollYEnabled: boolean
}

function isFixedLeft(fixed: unknown): boolean {
  return fixed === 'left' || fixed === true || fixed === 'start'
}

function isFixedRight(fixed: unknown): boolean {
  return fixed === 'right' || fixed === 'end'
}

/** antd 原生：固定列必须有显式 width，否则表头/表体错位 */
function ensureFixedColumnWidths(columns: Record<string, unknown>[]): Record<string, unknown>[] {
  return columns.map((col) => {
    if (col.hideInTable) return col
    if (!isFixedLeft(col.fixed) && !isFixedRight(col.fixed)) return col
    const width = parseUniTableColumnWidthValue(col.width)
    if (width != null && width > 0) {
      const minWidth = parseUniTableColumnWidthValue(col.minWidth) ?? width
      return { ...col, width, minWidth }
    }
    const fallback = getUniTableColumnScrollContribution(col)
    return { ...col, width: fallback, minWidth: fallback }
  })
}

/** 唯一布局计划入口：列宽物化 + primary flex + scroll.x + 滚动条占位 */
export function resolveLayoutPlan(input: ResolveLayoutPlanInput): UniTableLayoutPlan {
  const mode: UniTableLayoutMode = input.scrollYEnabled ? 'scrollY' : 'natural'
  const scrollbarSlotPx = mode === 'scrollY' ? getUniTableVerticalScrollbarWidth() : 0

  const ordered = normalizeFixedColumnOrder(input.columns)
  const prepared = applyColumnWidthPolicy(ordered)
  const withFixedWidths = ensureFixedColumnWidths(prepared)
  const columns = applyPrimaryFlexWidthPatch(withFixedWidths, input.containerWidth, {
    includeSelection: input.includeSelection,
    includeExpandable: input.includeExpandable === true,
    reserveVerticalScrollbar: input.scrollYEnabled,
  })

  const scrollX = computeUniTableMinScrollX(columns, {
    includeSelection: input.includeSelection,
    includeExpandable: input.includeExpandable === true,
  })

  return { columns, scrollX, mode, scrollbarSlotPx }
}

export function hasUniTableFixedColumns(columns: readonly unknown[]): boolean {
  return columns.some((c) => {
    if (!c || typeof c !== 'object') return false
    const col = c as { hideInTable?: boolean; fixed?: unknown }
    return !col.hideInTable && (isFixedLeft(col.fixed) || isFixedRight(col.fixed))
  })
}

export function hasUniTableFixedLeftColumns(columns: readonly unknown[]): boolean {
  return columns.some((c) => {
    if (!c || typeof c !== 'object') return false
    const col = c as { hideInTable?: boolean; fixed?: unknown }
    return !col.hideInTable && isFixedLeft(col.fixed)
  })
}

function isCodeOwnedFixed(fixed: unknown): fixed is 'left' | 'right' {
  return fixed === 'left' || fixed === 'right'
}

/**
 * 右固定列 order 的代码保留区起点。
 * 该区间（含历史 overlay 用过的 1_000_000+）只能由代码契约产生，
 * 持久化层（localStorage / 服务器偏好）不得写入或回灌，否则旧残留会把
 * 普通列排到右固定组之后，形成 hasGapFixed 让原生固定列失效。
 */
export const UNI_TABLE_CODE_OWNED_RIGHT_ORDER_BASE = 900_000

function isCodeOwnedOrder(order: unknown): boolean {
  return typeof order === 'number' && order >= UNI_TABLE_CODE_OWNED_RIGHT_ORDER_BASE
}

/**
 * ProTable 列设置默认映射（含代码声明的 fixed / order）。
 *
 * 注意：ProTable `genColumnKey(key||dataIndex)` 在 key 存在时忽略 index，
 * 同 dataIndex 的「表内列 + hideInTable 搜索列」会共用一个 columnsMap 槽；
 * 后写覆盖会把 `fixed` 冲成 undefined，导致固定列随横滚移动。
 */
export function buildDefaultColumnsStateMap(columns: Record<string, unknown>[]): Record<string, ColumnsState> {
  const map: Record<string, ColumnsState> = {}
  columns.forEach((col, index) => {
    const columnKey = getProColumnStateKey(col, index)
    const prev = map[columnKey]
    const colFixed = isCodeOwnedFixed(col.fixed) ? col.fixed : undefined
    const fixed = colFixed ?? (isCodeOwnedFixed(prev?.fixed) ? prev.fixed : undefined)
    const defaultShow = col.defaultShow === false ? false : true
    map[columnKey] = {
      show: prev?.show ?? defaultShow,
      ...(fixed ? { fixed } : {}),
      disable: (col.disable as ColumnsState['disable']) ?? prev?.disable,
    }
  })
  // 表内可见列的 fixed 为最终真源（覆盖同 key 的搜索列）
  columns.forEach((col, index) => {
    if (col.hideInTable || !isCodeOwnedFixed(col.fixed)) return
    const columnKey = getProColumnStateKey(col, index)
    map[columnKey] = {
      ...map[columnKey],
      show: map[columnKey]?.show ?? true,
      fixed: col.fixed,
    }
  })
  // 左/右固定连续：columnsState.order 与 normalizeFixedColumnOrder 一致，避免 hasGapFixed
  let leftOrder = 0
  columns.forEach((col, index) => {
    if (col.hideInTable || col.fixed !== 'left') return
    const columnKey = getProColumnStateKey(col, index)
    map[columnKey] = {
      ...map[columnKey],
      order: leftOrder++,
      fixed: 'left',
      show: true,
    }
  })
  const rightFixedCols: { col: Record<string, unknown>; index: number }[] = []
  columns.forEach((col, index) => {
    if (col.hideInTable || col.fixed !== 'right') return
    rightFixedCols.push({ col, index })
  })
  rightFixedCols.sort((a, b) => {
    const rankDiff = getUniTableRightFixedOrderRank(a.col) - getUniTableRightFixedOrderRank(b.col)
    return rankDiff !== 0 ? rankDiff : a.index - b.index
  })
  rightFixedCols.forEach(({ col, index }, i) => {
    const columnKey = getProColumnStateKey(col, index)
    map[columnKey] = {
      ...map[columnKey],
      order: UNI_TABLE_CODE_OWNED_RIGHT_ORDER_BASE + i,
      fixed: 'right',
      show: true,
    }
  })
  return map
}

/** 持久化层只存 show/order；代码保留区 order（右固定契约）不落盘 */
export function stripColumnsStateForPersistence(
  map: Record<string, ColumnsState> | undefined,
): Record<string, Pick<ColumnsState, 'show' | 'order'>> {
  if (!map) return {}
  const out: Record<string, Pick<ColumnsState, 'show' | 'order'>> = {}
  for (const [k, v] of Object.entries(map)) {
    if (!v) continue
    out[k] = {
      ...(v.show !== undefined ? { show: v.show } : {}),
      ...(v.order !== undefined && !isCodeOwnedOrder(v.order) ? { order: v.order } : {}),
    }
  }
  return out
}

/** 合并 LS 中的 show/order 与代码 fixed 契约 */
export function mergeColumnsStateWithCodeContract(
  columns: Record<string, unknown>[],
  persisted: Record<string, Partial<ColumnsState>> | undefined,
): Record<string, ColumnsState> {
  const codeDefaults = buildDefaultColumnsStateMap(columns)
  const merged: Record<string, ColumnsState> = { ...codeDefaults }

  if (persisted && Object.keys(persisted).length > 0) {
    for (const [k, v] of Object.entries(persisted)) {
      if (!v) continue
      const { fixed: _dropPersistedFixed, ...showOrder } = v
      merged[k] = {
        ...merged[k],
        ...(showOrder.show !== undefined ? { show: showOrder.show } : {}),
        // 代码保留区 order 是旧版契约残留（900_000 / 1_000_000+），回灌会打乱固定列连续性
        ...(showOrder.order !== undefined && !isCodeOwnedOrder(showOrder.order)
          ? { order: showOrder.order }
          : {}),
      }
    }
  }

  // 代码声明的 fixed / 左/右固定 order 不可被 LS / 列设置改写（须连续，否则 hasGapFixed）
  return lockCodeOwnedFixedInColumnsState(merged, columns)
}

/**
 * 渲染前再锁一次：ProTable `genProColumnToColumn` 用 columnsMap.fixed 覆盖列定义；
 * map 条目缺 fixed 时会把原生固定列打成普通列。
 */
export function lockCodeOwnedFixedInColumnsState(
  map: Record<string, ColumnsState> | undefined,
  columns: Record<string, unknown>[],
): Record<string, ColumnsState> {
  const codeDefaults = buildDefaultColumnsStateMap(columns)
  const merged: Record<string, ColumnsState> = { ...(map || {}) }

  for (const [k, v] of Object.entries(codeDefaults)) {
    if (isCodeOwnedFixed(v.fixed)) {
      merged[k] = {
        ...merged[k],
        show: merged[k]?.show ?? true,
        fixed: v.fixed,
        ...(v.order !== undefined ? { order: v.order } : {}),
      }
    } else if (merged[k] && 'fixed' in merged[k] && !isCodeOwnedFixed(merged[k].fixed)) {
      const { fixed: _omit, ...rest } = merged[k]
      merged[k] = rest
    }
  }

  // 按当前列定义再扫一遍，防止 key 与 default map 偶发不一致
  columns.forEach((col, index) => {
    if (col.hideInTable || !isCodeOwnedFixed(col.fixed)) return
    const columnKey = getProColumnStateKey(col, index)
    merged[columnKey] = {
      ...merged[columnKey],
      show: merged[columnKey]?.show ?? true,
      fixed: col.fixed,
      ...(codeDefaults[columnKey]?.order !== undefined
        ? { order: codeDefaults[columnKey].order }
        : {}),
    }
  })

  enforceProgressLifecyclePairOrderInColumnsState(merged, columns)
  return merged
}

export function readPersistedColumnsState(
  persistenceKey: string | undefined,
): Record<string, Partial<ColumnsState>> | undefined {
  if (typeof window === 'undefined' || !persistenceKey) return undefined
  try {
    const raw = window.localStorage.getItem(persistenceKey)
    if (!raw) return undefined
    return JSON.parse(raw) as Record<string, Partial<ColumnsState>>
  } catch {
    return undefined
  }
}

export function writePersistedColumnsState(
  persistenceKey: string | undefined,
  map: Record<string, ColumnsState> | undefined,
): void {
  if (typeof window === 'undefined' || !persistenceKey || !map) return
  try {
    window.localStorage.setItem(persistenceKey, JSON.stringify(stripColumnsStateForPersistence(map)))
  } catch {
    /* ignore quota errors */
  }
}

export function clearPersistedColumnsState(persistenceKey: string | undefined): void {
  if (typeof window === 'undefined' || !persistenceKey) return
  try {
    window.localStorage.removeItem(persistenceKey)
  } catch {
    /* ignore */
  }
}

/** 右侧固定列顺序：lifecycle → operation → 其它 right（兼容旧调用） */
export function normalizeFixedRightColumnOrder<T extends Record<string, unknown>>(columns: T[]): T[] {
  return normalizeFixedColumnOrder(columns)
}

/**
 * 原生固定列顺序契约：左固定连续置前 → 中间滚动列 → 右固定连续垫后。
 * 右固定组内：其它 right → 下推进度 → lifecycle → operation（操作列最右）。
 */
export function normalizeFixedColumnOrder<T extends Record<string, unknown>>(columns: T[]): T[] {
  if (!columns?.length) return columns
  const left: T[] = []
  const middle: T[] = []
  const right: T[] = []
  for (const col of columns) {
    const fixed = (col as { fixed?: unknown }).fixed
    if (isFixedLeft(fixed)) left.push(col)
    else if (isFixedRight(fixed)) right.push(col)
    else middle.push(col)
  }
  if (right.length > 1) {
    right.sort((a, b) => {
      const rankDiff = getUniTableRightFixedOrderRank(a) - getUniTableRightFixedOrderRank(b)
      return rankDiff
    })
  }
  return [...left, ...middle, ...right]
}
