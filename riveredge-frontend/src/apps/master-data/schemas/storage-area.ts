/**
 * 库区表单 Schema 配置
 */

import type { FieldConfig } from './form-schemas';

export const storageAreaFormSchema: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.storageArea.code',
    placeholderKey: 'field.storageArea.codePlaceholder',
    required: true,
    colSpan: 12,
    rules: [
      { required: true, messageKey: 'field.storageArea.codeRequired' },
    ],
    fieldProps: { style: { textTransform: 'uppercase' } },
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.storageArea.name',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.storageArea.nameRequired' }],
  },
  {
    name: 'warehouseId',
    type: 'select',
    labelKey: 'field.storageArea.warehouseId',
    placeholderKey: 'field.storageArea.warehouseIdPlaceholder',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.storageArea.warehouseIdRequired' }],
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.storageArea.description',
    colSpan: 24,
    fieldProps: { rows: 4, maxLength: 1000 },
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.storageArea.isActive',
    colSpan: 12,
  },
];
