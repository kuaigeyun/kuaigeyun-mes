/**
 * 工单列表与 UniTable + TanStack 共用的请求与 queryKey（预取与表格缓存键一致）
 */
import type { QueryClient } from '@tanstack/react-query'
import type { ReactText } from 'react'
import dayjs from 'dayjs'
import { stableJsonForQueryKey } from '../../../../../utils/tableQueryKey'
import { resolveWorkOrderListStatusFilter } from '../../../utils/workOrderLifecycle'
import { workOrderApi } from '../../../services/production'

export const WORK_ORDER_LIST_TANSTACK_PREFIX = ['kuaizhizao', 'work-orders', 'list'] as const

export const WORK_ORDER_LIST_STALE_MS = 5 * 60 * 1000

export type WorkOrderListTableResult = {
  data: any[]
  success: boolean
  total: number
}

/** 与 UniTable handleRequest 中 tanstack 分支的 queryKey 完全一致 */
export function buildWorkOrderListUniTableQueryKey(
  current: number,
  pageSize: number,
  sort: Record<string, 'ascend' | 'descend' | null>,
  filter: Record<string, ReactText[] | null>,
  searchFormValues: Record<string, any> | undefined
) {
  return [
    'uniTable',
    ...WORK_ORDER_LIST_TANSTACK_PREFIX,
    current,
    pageSize,
    stableJsonForQueryKey(sort),
    stableJsonForQueryKey(filter),
    stableJsonForQueryKey(searchFormValues ?? {}),
  ] as const
}

const emptySort: Record<string, 'ascend' | 'descend' | null> = {}
const emptyFilter: Record<string, ReactText[] | null> = {}

function tenantIdForSnapshot(): string {
  if (typeof window === 'undefined') return '0'
  try {
    return localStorage.getItem('tenant_id')?.trim() || '0'
  } catch {
    return '0'
  }
}

const SPLIT_CHILD_CODE = /^(.+)-(\d{3})$/

type WorkOrderListRow = Record<string, any>

/** 拆分工单子行继承主工单工序步骤摘要 */
function inheritOperationStepsFromParent(rows: WorkOrderListRow[]): WorkOrderListRow[] {
  return rows.map((row) => {
    if (!Array.isArray(row.children) || row.children.length === 0) {
      return row
    }
    const children = row.children.map((child: WorkOrderListRow) => ({
      ...child,
      operation_steps:
        Array.isArray(child.operation_steps) && child.operation_steps.length > 0
          ? child.operation_steps
          : row.operation_steps,
    }))
    return {
      ...row,
      children: inheritOperationStepsFromParent(children),
    }
  })
}

/**
 * 将列表行组装为 ProTable 树形 dataSource：
 * - API 已带 children 时原样返回（仅补 row_kind）
 * - 扁平列表时按 parent_work_order_id / 编码 xxx-NNN 挂到主工单下
 */
export function normalizeWorkOrderListTreeData(rows: WorkOrderListRow[]): WorkOrderListRow[] {
  if (!rows?.length) return []

  if (rows.some((r) => Array.isArray(r.children) && r.children.length > 0)) {
    return inheritOperationStepsFromParent(
      rows.map((row) => ({
        ...row,
        row_kind: row.row_kind || 'work_order',
        children: Array.isArray(row.children)
          ? row.children.map((child: WorkOrderListRow) => ({
              ...child,
              row_kind: child.row_kind || 'split',
            }))
          : row.children,
      })),
    )
  }

  const rowById = new Map<number, WorkOrderListRow>()
  const rowByCode = new Map<string, WorkOrderListRow>()
  for (const row of rows) {
    if (row.id == null) continue
    const copy = { ...row, children: undefined as WorkOrderListRow[] | undefined }
    rowById.set(Number(row.id), copy)
    if (row.code) rowByCode.set(String(row.code), copy)
  }

  const childIds = new Set<number>()

  const attachChild = (parent: WorkOrderListRow, child: WorkOrderListRow) => {
    if (child.id == null || parent.id == null || child.id === parent.id) return
    if (!parent.children) parent.children = []
    parent.children.push({
      ...child,
      row_kind: child.row_kind || 'split',
      parent_work_order_id: parent.id,
      operation_steps:
        Array.isArray(child.operation_steps) && child.operation_steps.length > 0
          ? child.operation_steps
          : parent.operation_steps,
    })
    childIds.add(Number(child.id))
  }

  for (const row of rowById.values()) {
    let parent: WorkOrderListRow | undefined
    const parentId = row.parent_work_order_id
    if (parentId != null) {
      parent = rowById.get(Number(parentId))
    }
    if (!parent && row.code) {
      const match = SPLIT_CHILD_CODE.exec(String(row.code))
      if (match) {
        parent = rowByCode.get(match[1])
      }
    }
    if (parent) {
      attachChild(parent, row)
    }
  }

  const roots = [...rowById.values()].filter((row) => row.id == null || !childIds.has(Number(row.id)))
  for (const root of roots) {
    if (root.children?.length) {
      root.children.sort((a, b) => {
        const order = (row: WorkOrderListRow) => {
          const kind = row.row_kind || 'split'
          if (kind === 'split') return 0
          if (kind === 'rework') return 1
          if (kind === 'outsource') return 2
          return 3
        }
        const kindDiff = order(a) - order(b)
        return kindDiff !== 0 ? kindDiff : String(a.code ?? '').localeCompare(String(b.code ?? ''))
      })
    }
  }
  return inheritOperationStepsFromParent(roots)
}

function listSnapshotStorageKey(queryKey: readonly unknown[]): string {
  /* v10：返工子行工序摘要 + 创建返工弹窗增强 */
  return `riveredge.woList.v10:${tenantIdForSnapshot()}:${stableJsonForQueryKey(queryKey)}`
}

/** 将上次成功的列表写入 sessionStorage，下次进页可瞬时 hydrate */
export function persistWorkOrderListSnapshot(
  queryKey: readonly unknown[],
  result: WorkOrderListTableResult
): void {
  if (typeof window === 'undefined' || !result?.success || !Array.isArray(result.data)) return
  try {
    sessionStorage.setItem(
      listSnapshotStorageKey(queryKey),
      JSON.stringify({
        data: result.data,
        total: result.total,
        success: result.success,
        savedAt: Date.now(),
      })
    )
  } catch {
    /* 配额或隐私模式 */
  }
}

/**
 * 从 sessionStorage 灌入 QueryClient；updatedAt 置为过期以触发 staleWhileRevalidate（先显旧数据再静默刷新）
 */
export function hydrateWorkOrderListQueryFromSession(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  staleTimeMs: number
): void {
  if (typeof window === 'undefined') return
  try {
    const raw = sessionStorage.getItem(listSnapshotStorageKey(queryKey))
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<WorkOrderListTableResult> & { savedAt?: number }
    if (!Array.isArray(parsed.data) || typeof parsed.total !== 'number') return
    const maxAge = 24 * 60 * 60 * 1000
    if (parsed.savedAt != null && Date.now() - parsed.savedAt > maxAge) return
    queryClient.setQueryData(
      [...queryKey],
      {
        data: parsed.data,
        total: parsed.total,
        success: parsed.success !== false,
      },
      { updatedAt: Date.now() - staleTimeMs - 1 }
    )
  } catch {
    /* ignore */
  }
}

/** 首屏常用：第 1 页、无排序/筛选/搜索，与默认进入工单列表一致 */
export function hydrateDefaultWorkOrderListPageFromSession(
  queryClient: QueryClient,
  pageSize: number,
  staleTimeMs: number
): void {
  const key = buildWorkOrderListUniTableQueryKey(1, pageSize, emptySort, emptyFilter, {})
  hydrateWorkOrderListQueryFromSession(queryClient, key, staleTimeMs)
}

function normalizeListResponse(response: unknown): WorkOrderListTableResult {
  if (Array.isArray(response)) {
    return {
      data: response,
      success: true,
      total: response.length,
    }
  }
  if (response && typeof response === 'object') {
    const r = response as Record<string, any>
    const rows = r.data || r.items || []
    return {
      data: rows,
      success: r.success !== false,
      total: r.total ?? rows.length,
    }
  }
  return { data: [], success: false, total: 0 }
}

function buildWorkOrderListApiParams(
  params: { current: number; pageSize: number },
  sort: Record<string, 'ascend' | 'descend' | null>,
  searchFormValues: Record<string, any> | undefined,
  options: { include_readiness: boolean; include_scores: boolean; include_operation_steps: boolean }
): Record<string, any> {
  const apiParams: Record<string, any> = {
    skip: (params.current - 1) * params.pageSize,
    limit: params.pageSize,
    include_readiness: options.include_readiness,
    include_scores: options.include_scores,
    include_operation_steps: options.include_operation_steps,
  }
  const s = searchFormValues || {}
  if (s.code) apiParams.code = s.code
  if (s.name) apiParams.name = s.name
  if (s.product_name) apiParams.product_name = s.product_name
  if (s.production_mode) apiParams.production_mode = s.production_mode
  const statusFilter = resolveWorkOrderListStatusFilter(s)
  if (statusFilter) apiParams.status = statusFilter
  if (s.keyword) apiParams.keyword = s.keyword
  if (s.planned_start_date && Array.isArray(s.planned_start_date) && s.planned_start_date.length === 2) {
    const [start, end] = s.planned_start_date
    if (start) apiParams.planned_start_from = dayjs(start).format('YYYY-MM-DD')
    if (end) apiParams.planned_start_to = dayjs(end).format('YYYY-MM-DD')
  }
  if (s.planned_end_date && Array.isArray(s.planned_end_date) && s.planned_end_date.length === 2) {
    const [start, end] = s.planned_end_date
    if (start) apiParams.planned_end_from = dayjs(start).format('YYYY-MM-DD')
    if (end) apiParams.planned_end_to = dayjs(end).format('YYYY-MM-DD')
  }
  if (sort && Object.keys(sort).length > 0) {
    const key = Object.keys(sort)[0]
    const order = sort[key]
    if (order) {
      apiParams.order_by = order === 'ascend' ? key : `-${key}`
    }
  }
  return apiParams
}

/**
 * 列表请求（无 UI 提示，供预取与表格共用；失败时 throw 避免写入坏缓存）
 */
export async function fetchWorkOrderListForTable(
  params: { current: number; pageSize: number },
  sort: Record<string, 'ascend' | 'descend' | null>,
  filter: Record<string, ReactText[] | null>,
  searchFormValues: Record<string, any> | undefined
): Promise<WorkOrderListTableResult> {
  const apiParams = buildWorkOrderListApiParams(params, sort, searchFormValues, {
    /** 列表读库表持久化字段；导出等场景可传 include_readiness=true 强制重算 */
    include_readiness: false,
    /** 列表首屏关闭；避免 batch_ensure_scores 触发大量快照计算 */
    include_scores: false,
    /** 工序列：与运营看板同口径的步骤摘要 */
    include_operation_steps: true,
  })
  const response = await workOrderApi.list(apiParams)
  const result = normalizeListResponse(response)
  if (result.success && Array.isArray(result.data)) {
    result.data = normalizeWorkOrderListTreeData(result.data)
  }
  if (result.success) {
    const qk = buildWorkOrderListUniTableQueryKey(
      params.current,
      params.pageSize,
      sort,
      filter,
      searchFormValues
    )
    persistWorkOrderListSnapshot(qk, result)
  }
  return result
}

/** 默认第一页 + 空条件，与刚进页时 ProTable 首次请求一致（pageSize 与偏好不一致时会再拉一次，仍暖一部分缓存） */
export function prefetchDefaultWorkOrderList(queryClient: QueryClient, pageSize: number): void {
  const key = buildWorkOrderListUniTableQueryKey(1, pageSize, emptySort, emptyFilter, {})
  void queryClient.prefetchQuery({
    queryKey: [...key],
    queryFn: () => fetchWorkOrderListForTable({ current: 1, pageSize }, emptySort, emptyFilter, {}),
    staleTime: WORK_ORDER_LIST_STALE_MS,
  })
}
