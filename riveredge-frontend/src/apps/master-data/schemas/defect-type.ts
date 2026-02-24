/**
 * 不良品类型表单 Schema 配置
 */

import type { FieldConfig } from './form-schemas';

export const defectTypeFormSchema: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.defectType.code',
    placeholderKey: 'field.defectType.codePlaceholder',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.defectType.codeRequired' }],
    fieldProps: { style: { textTransform: 'uppercase' } },
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.defectType.name',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.defectType.nameRequired' }],
  },
  {
    name: 'category',
    type: 'text',
    labelKey: 'field.defectType.category',
    colSpan: 12,
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.defectType.description',
    colSpan: 24,
    fieldProps: { rows: 3 },
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.defectType.isActive',
    colSpan: 12,
  },
];
