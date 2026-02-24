/**
 * 工艺路线表单 Schema 配置（基础字段，工序序列由 OperationSequenceEditor 单独渲染）
 */

import type { FieldConfig } from './form-schemas';

export const routeFormSchema: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.route.code',
    placeholderKey: 'field.route.codePlaceholder',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.route.codeRequired' }],
    fieldProps: { style: { textTransform: 'uppercase' } },
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.route.name',
    placeholderKey: 'field.route.namePlaceholder',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.route.nameRequired' }],
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.route.description',
    colSpan: 24,
    fieldProps: { rows: 4, maxLength: 1000 },
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.route.isActive',
    colSpan: 12,
  },
];
