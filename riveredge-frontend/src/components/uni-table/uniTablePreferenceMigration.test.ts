import { describe, expect, it } from 'vitest'
import {
  findLegacyTablePreferenceEntry,
  isColumnsPreferenceEmpty,
  listLegacyTablePersistenceIds,
  parseVersionedTablePersistenceId,
  resolveMigratedTablePreference,
} from './uniTablePreferenceMigration'

describe('parseVersionedTablePersistenceId', () => {
  it('parses -vN suffix', () => {
    expect(parseVersionedTablePersistenceId('apps.foo.list-v3')).toEqual({
      base: 'apps.foo.list',
      version: 3,
    })
    expect(parseVersionedTablePersistenceId('pages.personal.tasks.list-v2')).toEqual({
      base: 'pages.personal.tasks.list',
      version: 2,
    })
  })

  it('returns null without version suffix', () => {
    expect(parseVersionedTablePersistenceId('apps.foo.list')).toBeNull()
    expect(parseVersionedTablePersistenceId('')).toBeNull()
  })
})

describe('listLegacyTablePersistenceIds', () => {
  it('lists older versions then base', () => {
    expect(listLegacyTablePersistenceIds('apps.foo.list-v3')).toEqual([
      'apps.foo.list-v2',
      'apps.foo.list-v1',
      'apps.foo.list',
    ])
  })

  it('returns empty for unversioned id', () => {
    expect(listLegacyTablePersistenceIds('apps.foo.list')).toEqual([])
  })
})

describe('resolveMigratedTablePreference', () => {
  it('migrates columns from legacy cloud key when current is empty', () => {
    const preferences = {
      ui: {
        tables: {
          'apps.foo.list-v2': {
            columns: { code: { show: false } },
          },
        },
      },
    }
    const { merged, migratedFrom } = resolveMigratedTablePreference({
      tableId: 'apps.foo.list-v3',
      preferences,
    })
    expect(migratedFrom).toBe('apps.foo.list-v2')
    expect(merged.columns).toEqual({ code: { show: false } })
  })

  it('does not overwrite current columns', () => {
    const preferences = {
      ui: {
        tables: {
          'apps.foo.list-v3': { columns: { name: { show: false } } },
          'apps.foo.list-v2': { columns: { code: { show: false } } },
        },
      },
    }
    const { merged, migratedFrom } = resolveMigratedTablePreference({
      tableId: 'apps.foo.list-v3',
      preferences,
    })
    expect(migratedFrom).toBeNull()
    expect(merged.columns).toEqual({ name: { show: false } })
  })

  it('findLegacyTablePreferenceEntry picks nearest legacy', () => {
    const preferences = {
      ui: {
        tables: {
          'apps.foo.list-v1': { columns: { a: { show: false } } },
          'apps.foo.list-v2': { columns: { b: { show: false } } },
        },
      },
    }
    expect(findLegacyTablePreferenceEntry(preferences, 'apps.foo.list-v4')?.legacyTableId).toBe(
      'apps.foo.list-v2',
    )
  })
})

describe('isColumnsPreferenceEmpty', () => {
  it('treats missing and {} as empty', () => {
    expect(isColumnsPreferenceEmpty(undefined)).toBe(true)
    expect(isColumnsPreferenceEmpty({})).toBe(true)
    expect(isColumnsPreferenceEmpty({ x: { show: true } })).toBe(false)
  })
})
