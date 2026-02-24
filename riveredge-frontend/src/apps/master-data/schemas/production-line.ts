/**
 * 产线表单 Schema 配置
 */

import type { FieldConfig } from './form-schemas';

export const productionLineFormSchema: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.productionLine.code',
    placeholderKey: 'field.productionLine.codePlaceholder',
    required: true,
    colSpan: 12,
    rules: [
      { required: true, messageKey: 'field.productionLine.codeRequired' },
    ],
    fieldProps: { style: { textTransform: 'uppercase' } },
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.productionLine.name',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.productionLine.nameRequired' }],
  },
  {
    name: 'workshopId',
    type: 'select',
    labelKey: 'field.productionLine.workshopId',
    placeholderKey: 'field.productionLine.workshopIdPlaceholder',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.productionLine.workshopIdRequired' }],
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.productionLine.description',
    colSpan: 24,
    fieldProps: { rows: 4, maxLength: 1000 },
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.productionLine.isActive',
    colSpan: 12,
  },
];
