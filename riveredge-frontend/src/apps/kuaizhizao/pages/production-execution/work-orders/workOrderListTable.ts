/**
 * 工单列表与 UniTable + TanStack 共用的请求与 queryKey（预取与表格缓存键一致）
 */
import type { QueryClient } from '@tanstack/react-query'
import type { ReactText } from 'react'
import dayjs from 'dayjs'
import { stableJsonForQueryKey } from '../../../../../utils/tableQueryKey'
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

function listSnapshotStorageKey(queryKey: readonly unknown[]): string {
  /* v3：列表默认 include_readiness，齐套率有值；升级键避免 session 中仍为未计算快照 */
  return `riveredge.woList.v3:${tenantIdForSnapshot()}:${stableJsonForQueryKey(queryKey)}`
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

/**
 * 列表请求（无 UI 提示，供预取与表格共用；失败时 throw 避免写入坏缓存）
 */
export async function fetchWorkOrderListForTable(
  params: { current: number; pageSize: number },
  sort: Record<string, 'ascend' | 'descend' | null>,
  filter: Record<string, ReactText[] | null>,
  searchFormValues: Record<string, any> | undefined
): Promise<WorkOrderListTableResult> {
  const apiParams: Record<string, any> = {
    skip: (params.current - 1) * params.pageSize,
    limit: params.pageSize,
    /** 为 true 时后端按 BOM+库存计算齐套率（列表列可显示进度条）；数据量大时略慢 */
    include_readiness: true,
  }
  const s = searchFormValues || {}
  if (s.code) apiParams.code = s.code
  if (s.name) apiParams.name = s.name
  if (s.product_name) apiParams.product_name = s.product_name
  if (s.production_mode) apiParams.production_mode = s.production_mode
  if (s.status) apiParams.status = s.status
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
  const response = await workOrderApi.list(apiParams)
  const result = normalizeListResponse(response)
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
