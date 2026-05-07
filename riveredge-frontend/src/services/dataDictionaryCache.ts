/**
 * 数据字典统一缓存（会话级 module 缓存）
 *
 * 所有列表页/表单的字典获取入口收敛到这里：首次拉取后缓存按 code 共享；
 * 同 code 的并发请求会去重；后续任意页面同步即可拿到字典项，避免列表初次渲染时
 * 出现「原始 code → 标签」的闪烁。
 *
 * - `getDictionaryItemsCached(code)`：首选异步入口，结果缓存。
 * - `getDictionaryItemsSync(code)`：同步读取，未命中返回 `undefined`，用于初始化 state。
 * - `clearDictionaryCache(code?)`：可在字典维护页面更新后局部清理。
 */

import { getDataDictionaryByCode, getDictionaryItemList, type DictionaryItem } from './dataDictionary'

const itemsCache = new Map<string, DictionaryItem[]>()
const inflight = new Map<string, Promise<DictionaryItem[]>>()

export function getDictionaryItemsSync(code: string): DictionaryItem[] | undefined {
  return itemsCache.get(code)
}

export async function getDictionaryItemsCached(code: string): Promise<DictionaryItem[]> {
  const cached = itemsCache.get(code)
  if (cached) return cached
  const existing = inflight.get(code)
  if (existing) return existing
  const p = (async () => {
    try {
      const dict = await getDataDictionaryByCode(code)
      const items = await getDictionaryItemList(dict.uuid, true)
      const sorted = [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      itemsCache.set(code, sorted)
      return sorted
    } finally {
      inflight.delete(code)
    }
  })()
  inflight.set(code, p)
  return p
}

export function clearDictionaryCache(code?: string): void {
  if (code) {
    itemsCache.delete(code)
    inflight.delete(code)
    return
  }
  itemsCache.clear()
  inflight.clear()
}

/** 同步标签映射；未命中返回 `undefined`（页面据此决定是初始化还是异步加载） */
export function getDictionaryLabelMapSync(code: string): Record<string, string> | undefined {
  const items = itemsCache.get(code)
  if (!items) return undefined
  const map: Record<string, string> = {}
  for (const it of items) map[String(it.value)] = it.label
  return map
}
