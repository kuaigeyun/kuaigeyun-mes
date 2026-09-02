/**
 * UniTable 列/视图偏好：columnPersistenceId bump（-v2 → -v3）时从旧 key 自动迁移。
 * 真源仍为 preferences.ui.tables；localStorage 同步迁移作同设备缓存。
 */

import type { ColumnsState } from '@ant-design/pro-components'
import { useUserPreferenceStore } from '../../stores/userPreferenceStore'
import {
  uniTableColumnsLocalStorageKey,
  uniTableColumnsPreferenceField,
  type UniTableColumnsPreferenceField,
} from './uniTableColumnPreference'
import {
  readPersistedColumnsState,
  writePersistedColumnsState,
} from './uniTableLayoutEngine'
import {
  readPersistedUniTableViewType,
  uniTableViewTypeStorageKey,
  writePersistedUniTableViewType,
} from './uniTableViewPreference'

export type UniTableStoredPreference = {
  columns?: Record<string, Partial<ColumnsState>>
  columnsDetailTable?: Record<string, Partial<ColumnsState>>
  viewType?: string
}

const VERSION_SUFFIX_RE = /^(.+)-v(\d+)$/

/** 解析带 -vN 后缀的 persistence id */
export function parseVersionedTablePersistenceId(
  tableId: string,
): { base: string; version: number } | null {
  const m = tableId.match(VERSION_SUFFIX_RE)
  if (!m) return null
  const version = Number(m[2])
  if (!Number.isFinite(version) || version < 1) return null
  return { base: m[1], version }
}

/** 自近到远列出可回落的旧 persistence id（含无后缀 base） */
export function listLegacyTablePersistenceIds(tableId: string): string[] {
  const parsed = parseVersionedTablePersistenceId(tableId)
  if (!parsed) return []
  const ids: string[] = []
  for (let v = parsed.version - 1; v >= 1; v -= 1) {
    ids.push(`${parsed.base}-v${v}`)
  }
  if (tableId !== parsed.base) {
    ids.push(parsed.base)
  }
  return ids
}

export function isColumnsPreferenceEmpty(
  value: Record<string, Partial<ColumnsState>> | undefined | null,
): boolean {
  return !value || typeof value !== 'object' || Object.keys(value).length === 0
}

function isViewTypeEmpty(viewType: unknown): boolean {
  return typeof viewType !== 'string' || !viewType.trim()
}

function readLocalColumnsPreference(
  legacyTableId: string,
  field: UniTableColumnsPreferenceField,
): Record<string, Partial<ColumnsState>> | undefined {
  const key = uniTableColumnsLocalStorageKey(
    legacyTableId,
    field === 'columnsDetailTable',
  )
  const fromLs = readPersistedColumnsState(key)
  return isColumnsPreferenceEmpty(fromLs) ? undefined : fromLs
}

function readLocalViewType(legacyTableId: string): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const saved = window.localStorage.getItem(uniTableViewTypeStorageKey(legacyTableId))
    return saved && saved.trim() ? saved : undefined
  } catch {
    return undefined
  }
}

/** 从 preferences.ui.tables 读取单表偏好片段 */
export function readTablePreferenceEntry(
  preferences: Record<string, unknown> | undefined | null,
  tableId: string,
): UniTableStoredPreference | undefined {
  const tables = (preferences as { ui?: { tables?: Record<string, unknown> } })?.ui?.tables
  if (!tables || typeof tables !== 'object') return undefined
  const entry = tables[tableId]
  if (!entry || typeof entry !== 'object') return undefined
  const raw = entry as Record<string, unknown>
  const out: UniTableStoredPreference = {}
  if (!isColumnsPreferenceEmpty(raw.columns as Record<string, Partial<ColumnsState>>)) {
    out.columns = raw.columns as Record<string, Partial<ColumnsState>>
  }
  if (
    !isColumnsPreferenceEmpty(
      raw.columnsDetailTable as Record<string, Partial<ColumnsState>>,
    )
  ) {
    out.columnsDetailTable = raw.columnsDetailTable as Record<string, Partial<ColumnsState>>
  }
  if (!isViewTypeEmpty(raw.viewType)) {
    out.viewType = String(raw.viewType)
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** 在云端偏好中查找同 base 的旧版 table 条目（任字段非空即命中） */
export function findLegacyTablePreferenceEntry(
  preferences: Record<string, unknown> | undefined | null,
  tableId: string,
): { legacyTableId: string; entry: UniTableStoredPreference } | undefined {
  for (const legacyTableId of listLegacyTablePersistenceIds(tableId)) {
    const entry = readTablePreferenceEntry(preferences, legacyTableId)
    if (entry) return { legacyTableId, entry }
  }
  return undefined
}

function findLegacyFieldPreference(params: {
  tableId: string
  preferences: Record<string, unknown> | undefined | null
  field: keyof UniTableStoredPreference
  readLocal: (legacyTableId: string) => unknown
  hasValue: (value: unknown) => boolean
}): { legacyTableId: string; value: unknown } | undefined {
  for (const legacyTableId of listLegacyTablePersistenceIds(params.tableId)) {
    const entry = readTablePreferenceEntry(params.preferences, legacyTableId)
    const cloudVal = entry?.[params.field]
    if (params.hasValue(cloudVal)) {
      return { legacyTableId, value: cloudVal }
    }
    const localVal = params.readLocal(legacyTableId)
    if (params.hasValue(localVal)) {
      return { legacyTableId, value: localVal }
    }
  }
  return undefined
}

export type MigratedTablePreferenceResult = {
  merged: UniTableStoredPreference
  migratedFrom: string | null
}

/**
 * 将当前 tableId 缺失的 columns / columnsDetailTable / viewType 从旧版 key 补齐。
 * 优先云端旧 key，其次 localStorage 旧 key。
 */
export function resolveMigratedTablePreference(params: {
  tableId: string
  preferences: Record<string, unknown> | undefined | null
}): MigratedTablePreferenceResult {
  const { tableId, preferences } = params
  const currentRaw =
    ((preferences as { ui?: { tables?: Record<string, unknown> } })?.ui?.tables?.[
      tableId
    ] as Record<string, unknown> | undefined) ?? {}

  const merged: UniTableStoredPreference = {}
  let migratedFrom: string | null = null

  const fields: Array<{
    field: keyof UniTableStoredPreference
    lsField: UniTableColumnsPreferenceField | 'viewType'
  }> = [
    { field: 'columns', lsField: 'columns' },
    { field: 'columnsDetailTable', lsField: 'columnsDetailTable' },
    { field: 'viewType', lsField: 'viewType' },
  ]

  for (const { field, lsField } of fields) {
    const currentVal = currentRaw[field as string]
    const currentColumns =
      field === 'columns' || field === 'columnsDetailTable'
        ? (currentVal as Record<string, Partial<ColumnsState>> | undefined)
        : undefined
    const currentHasValue =
      field === 'viewType'
        ? !isViewTypeEmpty(currentVal)
        : !isColumnsPreferenceEmpty(currentColumns)

    if (currentHasValue) {
      if (field === 'viewType') merged.viewType = String(currentVal)
      else merged[field] = currentColumns
      continue
    }

    const legacyField = findLegacyFieldPreference({
      tableId,
      preferences,
      field,
      readLocal: (legacyTableId) =>
        lsField === 'viewType'
          ? readLocalViewType(legacyTableId)
          : readLocalColumnsPreference(legacyTableId, lsField),
      hasValue: (value) =>
        field === 'viewType'
          ? !isViewTypeEmpty(value)
          : !isColumnsPreferenceEmpty(
              value as Record<string, Partial<ColumnsState>> | undefined,
            ),
    })

    if (legacyField) {
      if (field === 'viewType') merged.viewType = legacyField.value as string
      else {
        merged[field] = legacyField.value as Record<string, Partial<ColumnsState>>
      }
      if (!migratedFrom) migratedFrom = legacyField.legacyTableId
    }
  }

  return { merged, migratedFrom }
}

function syncMigratedPreferenceToLocalStorage(
  tableId: string,
  merged: UniTableStoredPreference,
): void {
  if (merged.columns) {
    writePersistedColumnsState(
      uniTableColumnsLocalStorageKey(tableId, false),
      merged.columns as Record<string, ColumnsState>,
    )
  }
  if (merged.columnsDetailTable) {
    writePersistedColumnsState(
      uniTableColumnsLocalStorageKey(tableId, true),
      merged.columnsDetailTable as Record<string, ColumnsState>,
    )
  }
  if (merged.viewType) {
    writePersistedUniTableViewType(tableId, merged.viewType)
  }
}

const migrateInflight = new Map<string, Promise<void>>()

/**
 * 打开列表时：若当前 persistence id 无列/视图偏好，从旧版 key 迁移并写回云端。
 */
export function ensureUniTablePreferenceMigrated(tableId: string | undefined | null): Promise<void> {
  if (!tableId || !parseVersionedTablePersistenceId(tableId)) {
    return Promise.resolve()
  }
  const existing = migrateInflight.get(tableId)
  if (existing) return existing

  const task = (async () => {
    const store = useUserPreferenceStore.getState()
    const { merged, migratedFrom } = resolveMigratedTablePreference({
      tableId,
      preferences: store.preferences,
    })
    if (!migratedFrom || Object.keys(merged).length === 0) return

    syncMigratedPreferenceToLocalStorage(tableId, merged)

    const currentEntry = readTablePreferenceEntry(store.preferences, tableId)
    const patch: UniTableStoredPreference = { ...currentEntry }
    let needsCloudWrite = false

    if (
      isColumnsPreferenceEmpty(patch.columns) &&
      !isColumnsPreferenceEmpty(merged.columns)
    ) {
      patch.columns = merged.columns
      needsCloudWrite = true
    }
    if (
      isColumnsPreferenceEmpty(patch.columnsDetailTable) &&
      !isColumnsPreferenceEmpty(merged.columnsDetailTable)
    ) {
      patch.columnsDetailTable = merged.columnsDetailTable
      needsCloudWrite = true
    }
    if (isViewTypeEmpty(patch.viewType) && !isViewTypeEmpty(merged.viewType)) {
      patch.viewType = merged.viewType
      needsCloudWrite = true
    }

    if (!needsCloudWrite) return

    await store.syncTablePreference(tableId, patch as Record<string, unknown>)
  })().finally(() => {
    migrateInflight.delete(tableId)
  })

  migrateInflight.set(tableId, task)
  return task
}

/** 读取列偏好：当前 key → 云端旧 key → 本地当前 → 本地旧 key */
export function readAccountColumnsStateWithMigration(
  tableId: string | undefined | null,
  persistenceKey: string | undefined,
  isDetailTable: boolean,
  getPreference: <T>(key: string, defaultValue?: T) => T,
): Record<string, Partial<ColumnsState>> | undefined {
  const field = uniTableColumnsPreferenceField(isDetailTable)
  const prefPath = tableId ? `ui.tables.${tableId}.${field}` : ''

  if (tableId) {
    const fromPref = getPreference<Record<string, Partial<ColumnsState>> | undefined>(
      prefPath,
      undefined,
    )
    if (!isColumnsPreferenceEmpty(fromPref)) return fromPref

    for (const legacyTableId of listLegacyTablePersistenceIds(tableId)) {
      const legacyCols = readTablePreferenceEntry(
        useUserPreferenceStore.getState().preferences,
        legacyTableId,
      )?.[field]
      if (!isColumnsPreferenceEmpty(legacyCols)) return legacyCols
    }
  }

  const fromCurrentLs = readPersistedColumnsState(persistenceKey)
  if (!isColumnsPreferenceEmpty(fromCurrentLs)) return fromCurrentLs

  if (tableId) {
    for (const legacyTableId of listLegacyTablePersistenceIds(tableId)) {
      const legacyKey = uniTableColumnsLocalStorageKey(legacyTableId, isDetailTable)
      const fromLegacyLs = readPersistedColumnsState(legacyKey)
      if (!isColumnsPreferenceEmpty(fromLegacyLs)) return fromLegacyLs
    }
  }

  return undefined
}

/** 读取视图偏好：当前 key → 云端旧 key → 本地旧 key */
export function readAccountViewTypeWithMigration(
  tableId: string | undefined | null,
  fallback: string,
  allowedViewTypes: readonly string[] | undefined,
  getPreference: <T>(key: string, defaultValue?: T) => T,
  isAllowed: (viewType: string, allowed?: readonly string[]) => boolean,
): string {
  if (!tableId) return fallback

  const fromPref = getPreference<string | undefined>(`ui.tables.${tableId}.viewType`, undefined)
  if (fromPref && isAllowed(fromPref, allowedViewTypes)) return fromPref

  const legacy = findLegacyFieldPreference({
    tableId,
    preferences: useUserPreferenceStore.getState().preferences,
    field: 'viewType',
    readLocal: readLocalViewType,
    hasValue: (value) => !isViewTypeEmpty(value),
  })
  if (legacy?.value && isAllowed(String(legacy.value), allowedViewTypes)) {
    return String(legacy.value)
  }

  return readPersistedUniTableViewType(tableId, fallback, allowedViewTypes)
}
