/**
 * 与 UniTable + TanStack Query 的 queryKey 片段一致，供列表预取与缓存键对齐。
 */
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
