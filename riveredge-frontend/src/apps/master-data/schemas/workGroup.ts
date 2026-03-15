/**
 * 工作小组表单 Schema 配置
 */

import type { FieldConfig } from './form-schemas';

export const workGroupFormSchema: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.workGroup.code',
    placeholderKey: 'field.workGroup.codePlaceholder',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.workGroup.codeRequired' }],
    fieldProps: { style: { textTransform: 'uppercase' } },
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.workGroup.name',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.workGroup.nameRequired' }],
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.workGroup.description',
    colSpan: 24,
    fieldProps: { rows: 3 },
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.workGroup.isActive',
    colSpan: 12,
  },
];
