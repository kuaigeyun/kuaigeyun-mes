/**
 * UniTable 视图类型用户偏好（排除 help）。
 * 本地 LS + 服务端 preferences.ui.tables.{id}.viewType 双写，列偏好同路径约定。
 */

export const UNI_TABLE_VIEW_TYPE_HELP = 'help'

export function uniTableViewTypeStorageKey(tableId: string): string {
  return `ui.tables.${tableId}.viewType`
}

export function uniTableViewTypePreferencePath(tableId: string): string {
  return `ui.tables.${tableId}.viewType`
}

function isAllowedViewType(viewType: string, allowed?: readonly string[]): boolean {
  if (!viewType || viewType === UNI_TABLE_VIEW_TYPE_HELP) return false
  if (allowed && allowed.length > 0 && !allowed.includes(viewType)) return false
  return true
}

/** 从 localStorage 读取上次非 help 视图 */
export function readPersistedUniTableViewType(
  tableId: string | undefined | null,
  fallback: string,
  allowedViewTypes?: readonly string[],
): string {
  if (!tableId || typeof window === 'undefined') return fallback
  try {
    const saved = window.localStorage.getItem(uniTableViewTypeStorageKey(tableId))
    if (saved && isAllowedViewType(saved, allowedViewTypes)) return saved
  } catch {
    /* ignore */
  }
  return fallback
}

/** 写入 localStorage；help 不写入、不覆盖上次业务视图 */
export function writePersistedUniTableViewType(tableId: string, viewType: string): void {
  if (!tableId || viewType === UNI_TABLE_VIEW_TYPE_HELP || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(uniTableViewTypeStorageKey(tableId), viewType)
  } catch {
    /* ignore quota */
  }
}

/** 服务端偏好拉取后，把各表 viewType 同步到 localStorage */
export function syncTableViewTypesToLocalStorage(preferences: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  const ui = preferences?.ui as Record<string, unknown> | undefined
  const tables = ui?.tables
  if (!tables || typeof tables !== 'object') return
  Object.keys(tables as Record<string, unknown>).forEach((tableId) => {
    const tablePref = (tables as Record<string, unknown>)[tableId]
    if (!tablePref || typeof tablePref !== 'object') return
    const viewType = (tablePref as Record<string, unknown>).viewType
    if (typeof viewType === 'string' && isAllowedViewType(viewType)) {
      writePersistedUniTableViewType(tableId, viewType)
    }
  })
}
