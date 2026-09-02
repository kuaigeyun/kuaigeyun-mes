/**
 * 仓储 Hub 聚合列表：多底层表自定义字段合并为单列（同 label 不重复展示）。
 */

import type { ProColumns } from '@ant-design/pro-components'
import type { CustomField } from '../../services/customField'
import { renderCustomFieldListCell } from './customFieldListDisplay'

export type HubCustomFieldDocTypeField = 'receipt_type' | 'outbound_type'

export type HubCustomFieldListGroup = {
  /** Hub 行类型取值，如 purchase / sales_delivery */
  docTypes: readonly string[]
  customFields: CustomField[]
}

function normalizeCustomFieldLabel(field: CustomField): string {
  return (field.label || field.name || field.code).trim()
}

function labelToColumnSlug(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_\u4e00-\u9fff-]/g, '')
  return slug || 'field'
}

type HubFieldEntry = {
  docTypes: readonly string[]
  field: CustomField
  sortOrder: number
}

/** 同表多字段 label 重复时保留 sort_order 最小的一条 */
export function dedupeCustomFieldsByLabel(fields: CustomField[]): CustomField[] {
  const sorted = [...fields]
    .filter((f) => f.is_active)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id)
  const seen = new Set<string>()
  const out: CustomField[] = []
  for (const field of sorted) {
    const labelKey = normalizeCustomFieldLabel(field).toLowerCase()
    if (!labelKey || seen.has(labelKey)) continue
    seen.add(labelKey)
    out.push(field)
  }
  return out
}

/**
 * 将多组自定义字段合并为 Hub 列表列：同 label 只保留一列，按 docType 解析字段定义与取值。
 */
export function buildHubMergedCustomFieldColumns<
  TRecord extends Record<string, unknown> & {
    receipt_type?: string
    outbound_type?: string
  },
>(
  groups: HubCustomFieldListGroup[],
  typeField: HubCustomFieldDocTypeField,
): ProColumns<TRecord>[] {
  const byLabel = new Map<string, HubFieldEntry[]>()

  for (const group of groups) {
    for (const field of dedupeCustomFieldsByLabel(group.customFields)) {
      const label = normalizeCustomFieldLabel(field)
      if (!label) continue
      const list = byLabel.get(label) ?? []
      list.push({
        docTypes: group.docTypes,
        field,
        sortOrder: field.sort_order ?? 0,
      })
      byLabel.set(label, list)
    }
  }

  const merged = Array.from(byLabel.entries()).map(([label, entries]) => {
    const sortedEntries = [...entries].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.field.id - b.field.id,
    )
    const minSort = sortedEntries[0]?.sortOrder ?? 0
    const sharedCode = sortedEntries.every(
      (entry) => entry.field.code === sortedEntries[0].field.code,
    )
    const columnKey =
      sortedEntries.length === 1 || sharedCode
        ? `custom_${sortedEntries[0].field.code}`
        : `custom_hub_${labelToColumnSlug(label)}`

    return {
      sortKey: minSort,
      column: {
        title: label,
        dataIndex: columnKey,
        key: columnKey,
        width: 150,
        ellipsis: true,
        hideInSearch: true,
        sorter: false,
        defaultShow: false,
        render: (_: unknown, record: TRecord) => {
          const docType = String(record[typeField] ?? '')
          const matched = sortedEntries.find((entry) => entry.docTypes.includes(docType))
          if (!matched) {
            return renderCustomFieldListCell(sortedEntries[0].field, undefined)
          }
          const value = record[`custom_${matched.field.code}`]
          return renderCustomFieldListCell(matched.field, value)
        },
      } satisfies ProColumns<TRecord>,
    }
  })

  merged.sort((a, b) => a.sortKey - b.sortKey)
  return merged.map((item) => item.column)
}
