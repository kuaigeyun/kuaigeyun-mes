export interface MaterialDedupMatchItem {
  uuid: string
  mainCode: string
  name: string
  specification?: string | null
  model?: string | null
}

export interface MaterialDedupCheckParams {
  matchFields: string[]
  values: Record<string, unknown>
  excludeUuid?: string
  mastersOnly?: boolean
}

export interface MaterialDedupCheckResult {
  matched: boolean
  matches: MaterialDedupMatchItem[]
  skipped?: boolean
  skipReason?: string | null
}

/** 内置防重字段（默认：名称+规格+型号） */
export const MATERIAL_DEDUP_BUILTIN_FIELDS = [
  'name',
  'specification',
  'model',
  'brand',
  'base_unit',
  'main_code',
] as const

export type MaterialDedupBuiltinField = (typeof MATERIAL_DEDUP_BUILTIN_FIELDS)[number]

export const MATERIAL_DEDUP_DEFAULT_FIELDS: MaterialDedupBuiltinField[] = [
  'name',
  'specification',
  'model',
]

export const MATERIAL_DEDUP_PREFERENCE_KEY = 'ui.masterData.materialDedup.matchFields'

export function materialDedupCustomFieldKey(code: string): string {
  return `cf:${code}`
}

export function isMaterialDedupCustomFieldKey(key: string): boolean {
  return key.startsWith('cf:')
}

export function parseMaterialDedupCustomFieldCode(key: string): string | null {
  if (!isMaterialDedupCustomFieldKey(key)) return null
  const code = key.slice(3).trim()
  return code || null
}
