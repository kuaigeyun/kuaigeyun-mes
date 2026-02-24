/**
 * 厂区表单 Schema 配置
 */

import type { FieldConfig } from './form-schemas';

export const plantFormSchema: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.plant.code',
    placeholderKey: 'field.plant.codePlaceholder',
    required: true,
    colSpan: 12,
    rules: [
      { required: true, messageKey: 'field.plant.codeRequired' },
    ],
    fieldProps: { style: { textTransform: 'uppercase' } },
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.plant.name',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.plant.nameRequired' }],
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.plant.description',
    colSpan: 24,
    fieldProps: { rows: 3 },
  },
  {
    name: 'address',
    type: 'textarea',
    labelKey: 'field.plant.address',
    colSpan: 24,
    fieldProps: { rows: 2 },
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.plant.isActive',
    colSpan: 12,
  },
];
