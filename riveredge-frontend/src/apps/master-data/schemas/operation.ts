/**
 * 工序表单 Schema 配置
 */

import type { FieldConfig } from './form-schemas';

export const operationFormSchema: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.operation.code',
    placeholderKey: 'field.operation.codePlaceholder',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.operation.codeRequired' }],
    fieldProps: { style: { textTransform: 'uppercase' } },
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.operation.name',
    placeholderKey: 'field.operation.namePlaceholder',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.operation.nameRequired' }],
  },
  {
    name: 'defectTypeUuids',
    type: 'select',
    labelKey: 'field.operation.defectTypeUuids',
    placeholderKey: 'field.operation.defectTypeUuidsPlaceholder',
    colSpan: 24,
    mode: 'multiple',
    fieldProps: { allowClear: true },
  },
  {
    name: 'defaultOperatorUuids',
    type: 'select',
    labelKey: 'field.operation.defaultOperatorUuids',
    placeholderKey: 'field.operation.defaultOperatorUuidsPlaceholder',
    colSpan: 24,
    mode: 'multiple',
    fieldProps: { allowClear: true },
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.operation.description',
    colSpan: 24,
    fieldProps: { rows: 4, maxLength: 500 },
  },
  {
    name: 'reportingType',
    type: 'select',
    labelKey: 'field.operation.reportingType',
    placeholderKey: 'field.operation.reportingTypePlaceholder',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.operation.reportingTypeRequired' }],
    extraKey: 'field.operation.reportingTypeExtra',
    options: [
      { labelKey: 'field.operation.reportingTypeQuantity', value: 'quantity' },
      { labelKey: 'field.operation.reportingTypeStatus', value: 'status' },
    ],
  },
  {
    name: 'allowJump',
    type: 'switch',
    labelKey: 'field.operation.allowJump',
    colSpan: 12,
    extraKey: 'field.operation.allowJumpExtra',
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.operation.isActive',
    colSpan: 12,
  },
];
