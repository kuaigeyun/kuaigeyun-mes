import { describe, expect, it } from 'vitest'
import type { CustomField } from '../../services/customField'
import {
  buildHubMergedCustomFieldColumns,
  dedupeCustomFieldsByLabel,
} from './hubCustomFieldListColumns'

function field(partial: Partial<CustomField> & Pick<CustomField, 'code' | 'label'>): CustomField {
  return {
    id: partial.id ?? 1,
    uuid: partial.uuid ?? 'u1',
    tenant_id: 1,
    table_name: partial.table_name ?? 't',
    name: partial.name ?? partial.label,
    code: partial.code,
    label: partial.label,
    field_type: partial.field_type ?? 'date',
    is_active: partial.is_active ?? true,
    is_required: false,
    sort_order: partial.sort_order ?? 0,
    config: partial.config ?? {},
    created_at: '',
    updated_at: '',
  } as CustomField
}

describe('dedupeCustomFieldsByLabel', () => {
  it('keeps first active field per label', () => {
    const out = dedupeCustomFieldsByLabel([
      field({ id: 1, code: 'a', label: '制单日期', sort_order: 2 }),
      field({ id: 2, code: 'b', label: '制单日期', sort_order: 1 }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].code).toBe('b')
  })
})

describe('buildHubMergedCustomFieldColumns', () => {
  it('merges same label from multiple doc groups into one column', () => {
    const columns = buildHubMergedCustomFieldColumns(
      [
        {
          docTypes: ['purchase'],
          customFields: [field({ id: 1, code: 'doc_date', label: '制单日期' })],
        },
        {
          docTypes: ['production_return'],
          customFields: [field({ id: 2, code: 'doc_date', label: '制单日期' })],
        },
      ],
      'receipt_type',
    )
    expect(columns).toHaveLength(1)
    expect(columns[0].key).toBe('custom_doc_date')
  })

  it('uses hub key when same label but different codes', () => {
    const columns = buildHubMergedCustomFieldColumns(
      [
        {
          docTypes: ['purchase'],
          customFields: [field({ id: 1, code: 'doc_date', label: '制单日期' })],
        },
        {
          docTypes: ['production_return'],
          customFields: [field({ id: 2, code: 'zhi_dan', label: '制单日期' })],
        },
      ],
      'receipt_type',
    )
    expect(columns).toHaveLength(1)
    expect(columns[0].key).toBe('custom_hub_制单日期')
  })
})
