/**
 * 库位表单 Schema 配置
 */

import type { FieldConfig } from './form-schemas';

export const storageLocationFormSchema: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.storageLocation.code',
    placeholderKey: 'field.storageLocation.codePlaceholder',
    required: true,
    colSpan: 12,
    rules: [
      { required: true, messageKey: 'field.storageLocation.codeRequired' },
    ],
    fieldProps: { style: { textTransform: 'uppercase' } },
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.storageLocation.name',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.storageLocation.nameRequired' }],
  },
  {
    name: 'storageAreaId',
    type: 'select',
    labelKey: 'field.storageLocation.storageAreaId',
    placeholderKey: 'field.storageLocation.storageAreaIdPlaceholder',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.storageLocation.storageAreaIdRequired' }],
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.storageLocation.description',
    colSpan: 24,
    fieldProps: { rows: 4, maxLength: 1000 },
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.storageLocation.isActive',
    colSpan: 12,
  },
];
