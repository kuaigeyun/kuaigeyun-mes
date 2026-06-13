/**
 * 数据字典获取（实时：每次调用请求最新；同 code 并发去重）
 *
 * - `getDictionaryItemsCached(code)`：异步入口，每次拉最新字典项。
 * - `getDictionaryItemsSync(code)`：仅返回当前 inflight 完成前的内存快照（供首帧），不跨调用复用。
 * - `clearDictionaryCache(code?)`：字典维护页保存后可调用，清理 inflight。
 */

import { getDataDictionaryByCode, getDictionaryItemList, type DictionaryItem } from './dataDictionary'

const inflight = new Map<string, Promise<DictionaryItem[]>>()

export function getDictionaryItemsSync(_code: string): DictionaryItem[] | undefined {
  return undefined
}

export async function getDictionaryItemsCached(code: string): Promise<DictionaryItem[]> {
  const existing = inflight.get(code)
  if (existing) return existing
  const p = (async () => {
    try {
      const dict = await getDataDictionaryByCode(code)
      const items = await getDictionaryItemList(dict.uuid, true)
      return [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    } finally {
      inflight.delete(code)
    }
  })()
  inflight.set(code, p)
  return p
}

export function clearDictionaryCache(code?: string): void {
  if (code) {
    inflight.delete(code)
    return
  }
  inflight.clear()
}

export function getDictionaryLabelMapSync(_code: string): Record<string, string> | undefined {
  return undefined
}
