/**
 * 车间表单 Schema 配置
 */

import type { FieldConfig } from './form-schemas';

export const workshopFormSchema: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.workshop.code',
    placeholderKey: 'field.workshop.codePlaceholder',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.workshop.codeRequired' }],
    fieldProps: { style: { textTransform: 'uppercase' } },
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.workshop.name',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.workshop.nameRequired' }],
  },
  {
    name: 'plantId',
    type: 'select',
    labelKey: 'field.workshop.plantId',
    placeholderKey: 'field.workshop.plantIdPlaceholder',
    colSpan: 12,
    allowClear: true,
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.workshop.description',
    colSpan: 24,
    fieldProps: { rows: 4, maxLength: 1000 },
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.workshop.isActive',
    colSpan: 12,
  },
];
