/**
 * 列表单元格展示自定义字段值（与详情区块语义对齐，日期走站点时区契约）。
 */

import React from 'react'
import { Typography } from 'antd'
import type { CustomField } from '../../services/customField'
import { normalizeCustomFieldFileUuids } from './customFieldFileUtils'
import { formatJsonText, isEmptyJsonValue } from './customFieldJsonUtils'
import { formatAssociatedDetailValue } from './customFieldAssociatedDisplayMode'
import {
  formatBusinessDateOnly,
  formatDateTimeBySiteSetting,
} from '../../utils/format'

function formatMultiselectListValue(
  value: unknown,
  options?: { label: string; value: string }[],
): string {
  const arr = Array.isArray(value) ? value : value != null && value !== '' ? [value] : []
  if (!arr.length) return ''
  const opts = options || []
  return arr
    .map((v) => opts.find((o) => o.value === v || String(o.value) === String(v))?.label ?? String(v))
    .join('、')
}

const emptyCell = <Typography.Text type="secondary">-</Typography.Text>

/** 将自定义字段值格式化为列表可展示的 ReactNode */
export function renderCustomFieldListCell(field: CustomField, value: unknown): React.ReactNode {
  if (field.field_type === 'image' || field.field_type === 'file') {
    const n = normalizeCustomFieldFileUuids(value).length
    return n > 0 ? String(n) : emptyCell
  }
  if (field.field_type === 'json') {
    if (isEmptyJsonValue(value)) return emptyCell
    const text = formatJsonText(value)
    return text ? (
      <Typography.Text ellipsis={{ tooltip: text }} style={{ maxWidth: 140 }}>
        {text}
      </Typography.Text>
    ) : (
      emptyCell
    )
  }
  if (field.field_type === 'multiselect') {
    const text = formatMultiselectListValue(value, field.config?.options)
    return text || emptyCell
  }
  if (value === null || value === undefined || value === '') {
    return emptyCell
  }
  if (field.field_type === 'associated_object' || field.field_type === 'associated_attribute') {
    const text = formatAssociatedDetailValue(value)
    return text || emptyCell
  }
  if (field.field_type === 'date') {
    return formatBusinessDateOnly(value as string) || emptyCell
  }
  if (field.field_type === 'datetime') {
    return formatDateTimeBySiteSetting(value as string) || emptyCell
  }
  if (field.field_type === 'select' && field.config?.options && Array.isArray(field.config.options)) {
    const opt = field.config.options.find(
      (o: { value?: unknown; id?: unknown; label?: string; name?: string }) =>
        (o.value ?? o.id) === value || String(o.value ?? o.id) === String(value),
    )
    return opt ? String(opt.label ?? opt.name ?? value) : String(value)
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const display =
      obj.label ?? obj.name ?? obj.title ?? obj.code ?? (obj.id != null ? String(obj.id) : null)
    return display != null ? String(display) : emptyCell
  }
  return String(value)
}
