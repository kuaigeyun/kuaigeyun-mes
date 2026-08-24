/** UniTable 全局斑马纹用户偏好（跨设备同步） */
export const TABLE_ZEBRA_STRIPE_PREFERENCE_PATH = 'ui.table_zebra_stripe'

const LOCAL_STORAGE_KEY = 'ui.table_zebra_stripe'

export function readPersistedTableZebraStripe(defaultValue = false): boolean {
  if (typeof window === 'undefined') return defaultValue
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw === '1' || raw === 'true') return true
    if (raw === '0' || raw === 'false') return false
  } catch {
    /* ignore */
  }
  return defaultValue
}

export function writePersistedTableZebraStripe(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore quota */
  }
}
