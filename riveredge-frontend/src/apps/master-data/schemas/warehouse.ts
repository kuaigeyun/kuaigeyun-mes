/**
 * 仓库表单 Schema 配置
 */

import type { FieldConfig } from './form-schemas';

export const warehouseFormSchema: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.warehouse.code',
    placeholderKey: 'field.warehouse.codePlaceholder',
    required: true,
    colSpan: 12,
    rules: [
      { required: true, messageKey: 'field.warehouse.codeRequired' },
    ],
    fieldProps: { style: { textTransform: 'uppercase' } },
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.warehouse.name',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.warehouse.nameRequired' }],
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.warehouse.description',
    colSpan: 24,
    fieldProps: { rows: 3 },
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.warehouse.isActive',
    colSpan: 12,
  },
];
