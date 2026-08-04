/**
 * 与 UniTable + TanStack Query 的 queryKey 片段一致，供列表预取与缓存键对齐。
 */
import dayjs from 'dayjs'
export function stableJsonForQueryKey(value: unknown): string {
  const walk = (v: any, depth: number): any => {
    if (depth > 14) return '[MaxDepth]'
    if (v == null) return v
    const t = typeof v
    if (t === 'string' || t === 'number' || t === 'boolean') return v
    if (v instanceof Date) return v.toISOString()
    if (typeof v?.format === 'function' && (typeof v?.$y === 'number' || v?.constructor?.name === 'Dayjs')) {
      try {
        return typeof v.toISOString === 'function' ? v.toISOString() : v.format('YYYY-MM-DD HH:mm:ss.SSS')
      } catch {
        return String(v)
      }
    }
    if (Array.isArray(v)) return v.map((x) => walk(x, depth + 1))
    if (t !== 'object') return String(v)
    const keys = Object.keys(v).sort()
    const out: Record<string, unknown> = {}
    for (const k of keys) out[k] = walk(v[k], depth + 1)
    return out
  }
  try {
    return JSON.stringify(walk(value, 0))
  } catch {
    return String(value)
  }
}

/**
 * 从 ProTable / UniTable 的 sort 对象解析首个有效排序（含列头排序）。
 */
export function extractProTableSort(
  sort: Record<string, 'ascend' | 'descend' | null | undefined>
): { sortBy?: string; sortOrder?: 'asc' | 'desc' } {
  const entries = Object.entries(sort || {}).filter(
    ([, v]) => v === 'ascend' || v === 'descend'
  ) as [string, 'ascend' | 'descend'][]
  if (entries.length === 0) return {}
  const [field, order] = entries[0]
  return {
    sortBy: field,
    sortOrder: order === 'ascend' ? 'asc' : 'desc',
  }
}

/** ProTable 列 dataIndex → 工艺主数据列表接口 sortBy（后端 snake_case） */
export function mapProcessListSortField(sortBy?: string): string | undefined {
  if (!sortBy) return undefined
  const map: Record<string, string> = {
    createdAt: 'created_at',
    isActive: 'is_active',
    reportingType: 'reporting_type',
    operationId: 'operation_id',
  }
  return map[sortBy] ?? sortBy
}

/** 客户/供应商列表接口 sortBy（后端 snake_case） */
export function mapSupplyChainSortField(sortBy?: string): string | undefined {
  if (!sortBy) return undefined
  const map: Record<string, string> = {
    createdAt: 'created_at',
    isActive: 'is_active',
    shortName: 'short_name',
    contactPerson: 'contact_person',
    salesmanName: 'salesman_name',
    buyerName: 'buyer_name',
    industryCode: 'industry_code',
    customerLevelCode: 'customer_level_code',
    leadSourceCode: 'lead_source_code',
    sourceChannelCode: 'source_channel_code',
    estimatedAnnualPurchase: 'estimated_annual_purchase',
    creditLimit: 'credit_limit',
    contactTitle: 'contact_title',
  }
  return map[sortBy] ?? sortBy
}

/** UniTable 顶栏模糊词 + 可选表单字段合并为单一搜索串 */
export function mergeListKeyword(
  searchFormValues: Record<string, unknown> | undefined,
  ...fallbackKeys: string[]
): string {
  const fuzzy = String(searchFormValues?.keyword ?? '').trim()
  if (fuzzy) return fuzzy
  for (const k of fallbackKeys) {
    const v = searchFormValues?.[k]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return ''
}

/** UniTable 顶栏模糊词 → API keyword（空则 undefined） */
export function pickListSearchKeyword(
  searchFormValues?: Record<string, unknown> | null,
): string | undefined {
  const kw = String(searchFormValues?.keyword ?? '').trim()
  return kw || undefined
}

/** 高级搜索字符串字段（空则 undefined） */
export function pickSearchString(
  searchFormValues: Record<string, unknown> | undefined | null,
  key: string,
): string | undefined {
  const raw = searchFormValues?.[key]
  if (raw == null) return undefined
  const trimmed = String(raw).trim()
  return trimmed || undefined
}

/** 高级搜索日期字段 → YYYY-MM-DD（兼容 dayjs / Date / ISO 字符串） */
export function pickSearchDate(
  searchFormValues: Record<string, unknown> | undefined | null,
  key: string,
): string | undefined {
  const raw = searchFormValues?.[key]
  if (raw == null || raw === '') return undefined
  const parsed = dayjs(raw as never)
  if (parsed.isValid()) return parsed.format('YYYY-MM-DD')
  const fallback = String(raw).trim()
  return fallback || undefined
}

/** 高级搜索日期区间：优先 from/to 键，否则读取 rangeKey 数组 */
export function pickSearchDateRange(
  searchFormValues: Record<string, unknown> | undefined | null,
  fromKey: string,
  toKey: string,
  rangeKey?: string,
): { from?: string; to?: string } {
  const from = pickSearchDate(searchFormValues, fromKey)
  const to = pickSearchDate(searchFormValues, toKey)
  if (from || to) return { from, to }
  if (!rangeKey) return {}
  const raw = searchFormValues?.[rangeKey]
  if (!Array.isArray(raw) || raw.length < 2) return {}
  const start = pickSearchDate({ [fromKey]: raw[0] }, fromKey)
  const end = pickSearchDate({ [toKey]: raw[1] }, toKey)
  return { from: start, to: end }
}

/** 客户端列表：模糊词匹配若干文本字段（OR） */
export function filterRowsByListKeyword<T>(
  rows: T[],
  keyword: string | undefined,
  pickTexts: (row: T) => (string | null | undefined)[],
): T[] {
  if (!keyword) return rows
  const q = keyword.toLowerCase()
  return rows.filter((row) =>
    pickTexts(row).some((text) => String(text ?? '').toLowerCase().includes(q)),
  )
}

/** 权限列表 sortBy → 后端字段（snake_case） */
export function mapPermissionListSortField(sortBy?: string): string | undefined {
  if (!sortBy) return undefined
  const map: Record<string, string> = {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    permissionType: 'permission_type',
  }
  return map[sortBy] ?? sortBy
}

/** 接口管理列表 sortBy → 后端字段 */
export function mapApiListSortField(sortBy?: string): string | undefined {
  if (!sortBy) return undefined
  const map: Record<string, string> = {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    isActive: 'is_active',
  }
  return map[sortBy] ?? sortBy
}

/** 集成配置 / 数据源列表 sortBy → 后端字段 */
export function mapIntegrationConfigListSortField(sortBy?: string): string | undefined {
  if (!sortBy) return undefined
  const map: Record<string, string> = {
    lastConnectedAt: 'last_connected_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    isActive: 'is_active',
  }
  return map[sortBy] ?? sortBy
}
