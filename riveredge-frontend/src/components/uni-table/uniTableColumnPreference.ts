/**
 * UniTable 列显示/顺序用户偏好（字段隐藏）。
 * 与视图偏好一致：账号偏好为真源，localStorage 仅作同设备缓存。
 */

import type { ColumnsState } from '@ant-design/pro-components'
import { useUserPreferenceStore } from '../../stores/userPreferenceStore'
import { readPersistedColumnsState } from './uniTableLayoutEngine'

export type UniTableColumnsPreferenceField = 'columns' | 'columnsDetailTable'

export function uniTableColumnsPreferenceField(isDetailTable: boolean): UniTableColumnsPreferenceField {
  return isDetailTable ? 'columnsDetailTable' : 'columns'
}

export function uniTableColumnsPreferencePath(tableId: string, isDetailTable: boolean): string {
  return `ui.tables.${tableId}.${uniTableColumnsPreferenceField(isDetailTable)}`
}

export function uniTableColumnsLocalStorageKey(tableId: string, isDetailTable: boolean): string {
  const base = `ui.tables.${tableId}.columns`
  return isDetailTable ? `${base}::detailTable` : base
}

/** 从账号偏好读取列状态；无则回落 localStorage */
export function readAccountColumnsState(
  tableId: string | undefined | null,
  persistenceKey: string | undefined,
  isDetailTable: boolean,
): Record<string, Partial<ColumnsState>> | undefined {
  if (tableId) {
    const fromPref = useUserPreferenceStore
      .getState()
      .getPreference<Record<string, Partial<ColumnsState>> | undefined>(
        uniTableColumnsPreferencePath(tableId, isDetailTable),
        undefined,
      )
    if (fromPref && typeof fromPref === 'object' && Object.keys(fromPref).length > 0) {
      return fromPref
    }
  }
  return readPersistedColumnsState(persistenceKey)
}

export function columnsStatePreferenceSignature(
  map: Record<string, Partial<ColumnsState>> | Record<string, ColumnsState> | undefined | null,
): string {
  if (!map || typeof map !== 'object') return ''
  try {
    return JSON.stringify(map)
  } catch {
    return ''
  }
}
