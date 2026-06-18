/**
 * 自定义字段表单布局（唯一真源）
 *
 * 栅格常量、CSS 类名、ProForm 控件 props 均由此文件导出；
 * 视觉规则见 customFieldFormLayout.less。
 *
 * 渲染策略（CustomFieldsFormSection 内自动判断）：
 * - 父级 ProForm grid={true}：字段带 colProps，直接参与页面 Row（与标准字段同一栅格）
 * - embedInParentRow：仅 Col 片段，嵌在页面 Row 内
 * - 默认：独立 Row gutter={16}，与页面其它 Row 同级
 */

import type { CustomField } from '../../services/customField';

/** 与 Ant Design 24 栅格对齐：4 栏 → span 6，2 栏 → span 12 */
export type CustomFieldGridColumns = 1 | 2 | 3 | 4;

export const CUSTOM_FIELD_FORM_CLASS_NAMES = {
  /** 单个字段 Col */
  fieldCol: 'custom-fields-form-field-col',
  /** JSON 字段容器 */
  jsonItem: 'custom-fields-form-json-item',
  /** 标题旁「自定义字段」标签 */
  labelTag: 'custom-fields-form-label-tag',
} as const;

const GRID_COL_SPAN: Record<CustomFieldGridColumns, number> = {
  1: 24,
  2: 12,
  3: 8,
  4: 6,
};

export const CUSTOM_FIELD_FULL_ROW_COL_SPAN = 24;

const FULL_ROW_FIELD_TYPES = new Set<CustomField['field_type']>([
  'textarea',
  'image',
  'file',
  'json',
]);

export const isCustomFieldFullRowType = (fieldType: CustomField['field_type']) =>
  FULL_ROW_FIELD_TYPES.has(fieldType);

export const resolveCustomFieldColSpan = (
  fieldType: CustomField['field_type'],
  gridColumns: CustomFieldGridColumns,
) => (isCustomFieldFullRowType(fieldType) ? CUSTOM_FIELD_FULL_ROW_COL_SPAN : GRID_COL_SPAN[gridColumns]);

/** 从表单 schema 推断栏位数（24 栅格：colSpan 12 → 2 栏，6 → 4 栏） */
export function inferCustomFieldGridColumns(
  schema: Array<{ type?: string; colSpan?: number }>,
): CustomFieldGridColumns {
  const spans = schema
    .filter((field) => field.type !== 'slot' && (field.colSpan ?? 12) < CUSTOM_FIELD_FULL_ROW_COL_SPAN)
    .map((field) => field.colSpan ?? 12);
  if (spans.length === 0) return 2;

  const counts = new Map<number, number>();
  for (const span of spans) {
    counts.set(span, (counts.get(span) ?? 0) + 1);
  }
  let dominantSpan = 12;
  let dominantCount = 0;
  for (const [span, count] of counts) {
    if (count > dominantCount) {
      dominantSpan = span;
      dominantCount = count;
    }
  }

  const columns = CUSTOM_FIELD_FULL_ROW_COL_SPAN / dominantSpan;
  if (columns === 1 || columns === 2 || columns === 3 || columns === 4) {
    return columns as CustomFieldGridColumns;
  }
  return 2;
}

/** ProForm grid 模式：传 colProps 参与父级 Row；非 grid 模式：由外层 Col 控制栏宽 */
export function customFieldControlLayout(colProps?: { span?: number }) {
  if (colProps) {
    return { width: '100%' as const, colProps };
  }
  return {};
}

/** 输入控件 fieldProps（唯一宽度来源，禁止页面内联 style.width） */
export function customFieldFieldProps(
  extra?: Record<string, unknown>,
): { style: { width: '100%' } } & Record<string, unknown> {
  return { style: { width: '100%' }, ...extra };
}

/** @deprecated 使用 customFieldFieldProps */
export const fullWidthFieldProps = customFieldFieldProps();
